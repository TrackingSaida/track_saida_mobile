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

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; message?: string }> {
  const { data } = await axios.post<{ ok: boolean; message?: string }>(
    `${API_BASE_URL}/users/me/password`,
    { current_password: currentPassword, new_password: newPassword },
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function motoboyLogin(
  identifier: string,
  password: string
): Promise<MotoboyLoginResponse> {
  const { data } = await axios.post<MotoboyLoginResponse>(
    `${API_BASE_URL}/auth/motoboy-login`,
    { identifier, password },
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
    { identifier, password, sub_base: subBase },
    { headers: { "Content-Type": "application/json" } }
  );
  return data;
}
