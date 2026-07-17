export interface JwtClaims {
  sub?: string;
  username?: string;
  sub_base?: string;
  role?: number;
  tipo_owner?: string;
  ignorar_coleta?: boolean;
  modo_operacao?: string;
  owner_valor?: string;
  motoboy_id?: number;
  pode_ler_coleta?: boolean;
  pode_ler_saida?: boolean;
  pode_digitar_codigo_manual?: boolean;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtClaims {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const payload = JSON.parse(atob(parts[1]));
    return payload as JwtClaims;
  } catch {
    return {};
  }
}
