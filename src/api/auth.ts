import axios from "axios";
import { API_BASE_URL } from "../config/api";

export interface MotoboyLoginResponse {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  multiple_sub_base?: boolean;
  sub_bases?: string[];
  must_change_password?: boolean;
}

export interface MotoboySelectSubBaseResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  must_change_password?: boolean;
}

export interface UserTokenResponse {
  access_token: string;
  token_type: string;
  must_change_password?: boolean;
}

const AUTH_TIMEOUT_MS = 15000;
const AUTH_REQUEST_ERROR_NAME = "AuthRequestError";

type AuthErrorCode = "timeout" | "network" | "http" | "unknown";

export type AuthRequestError = Error & {
  name: typeof AUTH_REQUEST_ERROR_NAME;
  status?: number;
  detail?: string;
  code: AuthErrorCode;
  originalError?: unknown;
};

function pickErrorDetail(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (!data || typeof data !== "object") return "";
  const rec = data as Record<string, unknown>;
  if (typeof rec.detail === "string") return rec.detail.trim();
  if (typeof rec.message === "string") return rec.message.trim();
  return "";
}

export function normalizeAuthError(err: unknown, fallback: string): AuthRequestError {
  if (
    err != null &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: string }).name === AUTH_REQUEST_ERROR_NAME
  ) {
    return err as AuthRequestError;
  }

  const normalized = new Error(fallback) as AuthRequestError;
  normalized.name = AUTH_REQUEST_ERROR_NAME;
  normalized.code = "unknown";
  normalized.originalError = err;

  if (axios.isAxiosError(err)) {
    const detail = pickErrorDetail(err.response?.data);
    const status = err.response?.status;
    normalized.status = status;
    normalized.detail = detail || undefined;

    const isTimeout = err.code === "ECONNABORTED" || (err.message || "").toLowerCase().includes("timeout");
    if (isTimeout) {
      normalized.code = "timeout";
      normalized.message = "Tempo de resposta esgotado. Verifique sua conexão e tente novamente.";
      return normalized;
    }

    if (!err.response) {
      normalized.code = "network";
      normalized.message = "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
      return normalized;
    }

    normalized.code = "http";
    if (detail) {
      normalized.message = detail;
      return normalized;
    }

    normalized.message = fallback;
    return normalized;
  }

  if (err instanceof Error && err.message.trim()) {
    normalized.message = err.message.trim();
  }

  return normalized;
}

/** Troca obrigatória (must_change_password): omita currentPassword. Troca voluntária: informe a senha atual. */
export async function changePassword(
  token: string,
  newPassword: string,
  currentPassword?: string
): Promise<{ ok: boolean; message?: string }> {
  const body: { new_password: string; current_password?: string } = { new_password: newPassword };
  if (currentPassword != null && currentPassword !== "") {
    body.current_password = currentPassword;
  }
  try {
    const { data } = await axios.post<{ ok: boolean; message?: string }>(
      `${API_BASE_URL}/users/me/password`,
      body,
      {
        timeout: AUTH_TIMEOUT_MS,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      }
    );
    return data;
  } catch (err: unknown) {
    throw normalizeAuthError(err, "Não foi possível alterar a senha.");
  }
}

export async function userLogin(
  identifier: string,
  password: string
): Promise<UserTokenResponse> {
  // Sempre enviar strings: undefined em JSON.stringify omite a chave e o backend responde "Field required".
  try {
    const { data } = await axios.post<UserTokenResponse>(
      `${API_BASE_URL}/auth/token`,
      { identifier: identifier ?? "", password: password ?? "" },
      { timeout: AUTH_TIMEOUT_MS, headers: { "Content-Type": "application/json" } }
    );
    return data;
  } catch (err: unknown) {
    throw normalizeAuthError(err, "Falha no login.");
  }
}

export async function motoboyLogin(
  identifier: string,
  password: string
): Promise<MotoboyLoginResponse> {
  try {
    const { data } = await axios.post<MotoboyLoginResponse>(
      `${API_BASE_URL}/auth/motoboy-login`,
      { identifier: identifier ?? "", password: password ?? "" },
      { timeout: AUTH_TIMEOUT_MS, headers: { "Content-Type": "application/json" } }
    );
    return data;
  } catch (err: unknown) {
    throw normalizeAuthError(err, "Falha no login de motoboy.");
  }
}

export async function motoboySelectSubBase(
  identifier: string,
  password: string,
  subBase: string
): Promise<MotoboySelectSubBaseResponse> {
  try {
    const { data } = await axios.post<MotoboySelectSubBaseResponse>(
      `${API_BASE_URL}/auth/motoboy-select-subbase`,
      {
        identifier: identifier ?? "",
        password: password ?? "",
        sub_base: subBase ?? "",
      },
      { timeout: AUTH_TIMEOUT_MS, headers: { "Content-Type": "application/json" } }
    );
    return data;
  } catch (err: unknown) {
    throw normalizeAuthError(err, "Não foi possível selecionar a base.");
  }
}

export async function motoboyRefresh(refreshToken: string): Promise<MotoboySelectSubBaseResponse> {
  try {
    const { data } = await axios.post<MotoboySelectSubBaseResponse>(
      `${API_BASE_URL}/auth/motoboy-refresh`,
      { refresh_token: refreshToken },
      { timeout: AUTH_TIMEOUT_MS, headers: { "Content-Type": "application/json" } }
    );
    return data;
  } catch (err: unknown) {
    throw normalizeAuthError(err, "Não foi possível renovar a sessão.");
  }
}

export async function motoboyLogout(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await axios.post(
      `${API_BASE_URL}/auth/motoboy-logout`,
      { refresh_token: refreshToken },
      { timeout: AUTH_TIMEOUT_MS, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    /* ignore */
  }
}
