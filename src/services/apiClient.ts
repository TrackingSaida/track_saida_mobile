import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../config/api";
import { getSessionEpoch, useAuthStore } from "../store/authStore";
import { isJwtExpired, secondsUntilJwtExpiry } from "../utils/jwt";

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  /** Marca requests públicas isentas do bloqueio pós-invalidação. */
  _publicAuth?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

/** Renova access quando faltam menos que este tempo (segundos). */
const PREVENTIVE_REFRESH_WITHIN_SEC = 15 * 60;

/** POST mutáveis de leitura: após 401+refresh, não reexecutar (evita bip fantasma). */
function isMutableScanPost(config: InternalAxiosRequestConfig): boolean {
  const method = String(config.method || "get").toLowerCase();
  if (method !== "post") return false;
  const url = String(config.url || "");
  return (
    url.includes("/mobile/scan") ||
    /\/mobile\/entrega\/\d+\/assumir/.test(url) ||
    (url.includes("/mobile/saida-sessoes/") && url.includes("/confirmar"))
  );
}

function isPublicAuthUrl(url: string): boolean {
  return (
    url.includes("/auth/motoboy-refresh") ||
    url.includes("/auth/motoboy-login") ||
    url.includes("/auth/motoboy-logout") ||
    url.includes("/auth/token") ||
    url.includes("/auth/root-select") ||
    url.includes("/app-version")
  );
}

export class ScanAuthRetryBlockedError extends Error {
  readonly code = "SCAN_AUTH_RETRY_BLOCKED";
  constructor(message = "Não foi possível confirmar a leitura. Escaneie de novo.") {
    super(message);
    this.name = "ScanAuthRetryBlockedError";
  }
}

function isNetworkOrTimeoutError(e: unknown): boolean {
  if (!axios.isAxiosError(e)) {
    if (e instanceof Error && e.name === "AbortError") return true;
    return false;
  }
  if (e.code === "ECONNABORTED" || e.code === "ERR_NETWORK" || !e.response) {
    return true;
  }
  return false;
}

export function isTransientRefreshError(e: unknown): boolean {
  if (isNetworkOrTimeoutError(e)) return true;
  if (!axios.isAxiosError(e)) return true;
  const status = e.response?.status;
  return status === 408 || status === 429 || (status != null && status >= 500);
}

export function isDefinitiveRefreshRejection(e: unknown): boolean {
  if (!axios.isAxiosError(e)) return false;
  const status = e.response?.status;
  return status === 400 || status === 401 || status === 403;
}

function headerClaimsStale(headers: unknown): boolean {
  if (!headers || typeof headers !== "object") return false;
  const h = headers as Record<string, unknown>;
  const raw =
    h["x-claims-stale"] ??
    h["X-Claims-Stale"] ??
    (typeof (h as { get?: (k: string) => string }).get === "function"
      ? (h as { get: (k: string) => string }).get("x-claims-stale")
      : undefined);
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function sessionStillOwnsRefresh(epoch: number, refreshToken: string): boolean {
  if (getSessionEpoch() !== epoch) return false;
  return useAuthStore.getState().refreshToken === refreshToken;
}

async function tryRefreshToken(attempt = 1): Promise<boolean> {
  const epoch = getSessionEpoch();
  const { refreshToken, setTokens, onSessionExpired } = useAuthStore.getState();
  if (!refreshToken) {
    if (getSessionEpoch() === epoch) await onSessionExpired();
    return false;
  }
  try {
    const { data } = await axios.post<{
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in?: number;
    }>(
      `${API_BASE_URL}/auth/motoboy-refresh`,
      { refresh_token: refreshToken },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    if (!sessionStillOwnsRefresh(epoch, refreshToken)) return false;
    await setTokens(data.access_token, data.refresh_token || refreshToken, epoch);
    return true;
  } catch (e) {
    if (!sessionStillOwnsRefresh(epoch, refreshToken)) return false;
    if (isTransientRefreshError(e) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 800));
      return tryRefreshToken(attempt + 1);
    }
    if (isTransientRefreshError(e)) {
      return false;
    }
    if (isDefinitiveRefreshRejection(e) && sessionStillOwnsRefresh(epoch, refreshToken)) {
      await onSessionExpired();
    }
    return false;
  }
}

/** Renova access token (claims atualizados do banco). Deduplica chamadas paralelas. */
export function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Refresh silencioso: não dispara SessionExpired se falhar por rede.
 * Usado para X-Claims-Stale e renovação preventiva (não interrompe bipagem).
 */
export function refreshSilently(): Promise<boolean> {
  return refreshOnce();
}

/** Renova se o access estiver perto do vencimento (ou já vencido com refresh válido). */
export async function ensureFreshAccessToken(): Promise<void> {
  const { token, refreshToken } = useAuthStore.getState();
  if (!refreshToken) return;
  if (!token || isJwtExpired(token, 0)) {
    await refreshSilently();
    return;
  }
  const left = secondsUntilJwtExpiry(token);
  if (left != null && left <= PREVENTIVE_REFRESH_WITHIN_SEC) {
    await refreshSilently();
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
  },
  timeout: 45_000,
});

apiClient.interceptors.request.use(async (config) => {
  const url = String(config.url || "");
  const publicAuth = isPublicAuthUrl(url);
  if (publicAuth) {
    (config as RetryConfig)._publicAuth = true;
  }
  if (!publicAuth) {
    const { token, refreshToken, sessionExpiredVisible } = useAuthStore.getState();
    // Após invalidação definitiva: bloqueia autenticadas; libera login/refresh/públicos.
    if (sessionExpiredVisible || (!token && !refreshToken)) {
      if (!token) {
        return Promise.reject(
          new AxiosError(
            "Sessão inválida",
            "ERR_SESSION_INVALID",
            config,
            undefined,
            undefined
          )
        );
      }
    }
    try {
      await ensureFreshAccessToken();
    } catch {
      /* não bloqueia a request; 401 cuida do retry */
    }
  }
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (headerClaimsStale(response.headers)) {
      void refreshSilently();
    }
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config as RetryConfig | undefined;
    if (status !== 401 || !config || config._retry) {
      return Promise.reject(error);
    }
    const url = String(config.url || "");
    if (isPublicAuthUrl(url) || config._publicAuth) {
      return Promise.reject(error);
    }
    config._retry = true;
    const ok = await refreshOnce();
    if (!ok) {
      return Promise.reject(error);
    }
    // Integridade das bipagens: não reexecuta POST /mobile/scan após 401.
    if (isMutableScanPost(config)) {
      return Promise.reject(new ScanAuthRetryBlockedError());
    }
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return apiClient.request(config);
  }
);

export function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Indica se o erro parece ser de rede (não expirar sessão). */
export { isNetworkOrTimeoutError };
