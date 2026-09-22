import axios from "axios";
import { API_BASE_URL } from "../../config/api";

export type AniversarioGreeting = {
  titulo: string;
  mensagem: string;
  botao: string;
};

export type AuthMeAniversario = {
  id?: number;
  must_change_password?: boolean;
  aniversario?: AniversarioGreeting | null;
};

export async function fetchAuthMeAniversario(token: string): Promise<AuthMeAniversario | null> {
  try {
    const { data } = await axios.get<AuthMeAniversario>(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: 10000,
    });
    return data ?? null;
  } catch {
    return null;
  }
}
