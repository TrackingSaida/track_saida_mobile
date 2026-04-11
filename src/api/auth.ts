import axios from "axios";
import { API_BASE_URL } from "../config/api";

export interface MotoboyLoginResponse {
  access_token?: string;
  token_type?: string;
  multiple_sub_base?: boolean;
  sub_bases?: string[];
  must_change_password?: boolean;
}

export interface MotoboySelectSubBaseResponse {
  access_token: string;
  token_type: string;
  must_change_password?: boolean;
}

export interface UserTokenResponse {
  access_token: string;
  token_type: string;
  must_change_password?: boolean;
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
  const { data } = await axios.post<{ ok: boolean; message?: string }>(
    `${API_BASE_URL}/users/me/password`,
    body,
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function userLogin(
  identifier: string,
  password: string
): Promise<UserTokenResponse> {
  // Sempre enviar strings: undefined em JSON.stringify omite a chave e o backend responde "Field required".
  const { data } = await axios.post<UserTokenResponse>(
    `${API_BASE_URL}/auth/token`,
    { identifier: identifier ?? "", password: password ?? "" },
    { headers: { "Content-Type": "application/json" } }
  );
  return data;
}

export async function motoboyLogin(
  identifier: string,
  password: string
): Promise<MotoboyLoginResponse> {
  const { data } = await axios.post<MotoboyLoginResponse>(
    `${API_BASE_URL}/auth/motoboy-login`,
    { identifier: identifier ?? "", password: password ?? "" },
    { headers: { "Content-Type": "application/json" } }
  );
  return data;
}

export async function motoboySelectSubBase(
  identifier: string,
  password: string,
  subBase: string
): Promise<MotoboySelectSubBaseResponse> {
  const { data } = await axios.post<MotoboySelectSubBaseResponse>(
    `${API_BASE_URL}/auth/motoboy-select-subbase`,
    {
      identifier: identifier ?? "",
      password: password ?? "",
      sub_base: subBase ?? "",
    },
    { headers: { "Content-Type": "application/json" } }
  );
  return data;
}
