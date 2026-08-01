export interface JwtClaims {
  sub?: string;
  username?: string;
  sub_base?: string;
  /** Nome amigável da base (JWT); fallback operacional: sub_base. */
  sub_base_nome?: string;
  role?: number;
  tipo_owner?: string;
  ignorar_coleta?: boolean;
  modo_operacao?: string;
  owner_valor?: string;
  motoboy_id?: number;
  pode_ler_coleta?: boolean;
  pode_ler_saida?: boolean;
  pode_digitar_codigo_manual?: boolean;
  /** Motoboy pode lançar avulso (default true / opt-out). */
  pode_lancar_avulso?: boolean;
  /** Owner habilitou devolução de pacotes à sub_base pelo app. */
  devolucao_sub_base_habilitada?: boolean;
  /** Saída só após Registrar Entrada (NA_BASE). */
  entrada_obrigatoria_habilitada?: boolean;
  /** Conferência de saída após Começar Entrega. */
  conferencia_saida_habilitada?: boolean;
  [key: string]: unknown;
}

function decodeBase64Url(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + pad);
}

export function decodeJwtPayload(token: string): JwtClaims {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload as JwtClaims;
  } catch {
    return {};
  }
}
