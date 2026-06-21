import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../config/api";
import { useAuthStore } from "../store/authStore";

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<boolean> | null = null;

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

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
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

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config as RetryConfig | undefined;
    if (status !== 401 || !config || config._retry) {
      return Promise.reject(error);
    }
    const url = String(config.url || "");
    if (url.includes("/auth/motoboy-refresh") || url.includes("/auth/motoboy-login")) {
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
