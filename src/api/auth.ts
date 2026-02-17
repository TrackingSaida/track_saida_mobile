import axios from "axios";
import { API_BASE_URL } from "../config/api";

export interface MotoboyLoginResponse {
  access_token?: string;
  token_type?: string;
  multiple_sub_base?: boolean;
  sub_bases?: string[];
}

export interface MotoboySelectSubBaseResponse {
  access_token: string;
  token_type: string;
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
