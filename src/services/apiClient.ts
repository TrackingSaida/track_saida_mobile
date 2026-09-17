import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../config/api";
import { useAuthStore } from "../store/authStore";
import { isJwtExpired, secondsUntilJwtExpiry } from "../utils/jwt";

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<boolean> | null = null;

/** Renova access quando faltam menos que este tempo (segundos). */
const PREVENTIVE_REFRESH_WITHIN_SEC = 15 * 60;

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

async function tryRefreshToken(attempt = 1): Promise<boolean> {
  const { refreshToken, setTokens, onSessionExpired } = useAuthStore.getState();
  if (!refreshToken) {
    await onSessionExpired();
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
    await setTokens(data.access_token, data.refresh_token || refreshToken);
    return true;
  } catch (e) {
    if (isNetworkOrTimeoutError(e) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 800));
      return tryRefreshToken(attempt + 1);
    }
    if (isNetworkOrTimeoutError(e)) {
      return false;
    }
    await onSessionExpired();
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
  if (
    !url.includes("/auth/motoboy-refresh") &&
    !url.includes("/auth/motoboy-login") &&
    !url.includes("/auth/token")
  ) {
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
    if (
      url.includes("/auth/motoboy-refresh") ||
      url.includes("/auth/motoboy-login") ||
      url.includes("/auth/token")
    ) {
      return Promise.reject(error);
    }
    config._retry = true;
    const ok = await refreshOnce();
    if (!ok) {
      if (isNetworkOrTimeoutError(error)) {
        return Promise.reject(error);
      }
      return Promise.reject(error);
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
