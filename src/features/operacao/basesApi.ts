import { apiClient as client } from "../../services/apiClient";

export interface BaseItem {
  id_base: number;
  base: string;
  sub_base?: string | null;
  ativo?: boolean;
  /** Endereço corrido vindo de base_seller_dados (quando cadastrado). */
  endereco_completo?: string | null;
  dias_coleta?: number[] | null;
  agenda_coleta_confirmada?: boolean | null;
  /** PRD-011: seller | base_parceira (owner tipo base). */
  papel?: string | null;
  entrega_pedidos?: boolean;
}

export interface BaseQueEntregaItem {
  id_base: number;
  base: string;
}

export async function listarBasesAtivas(): Promise<BaseItem[]> {
  const { data } = await client.get<BaseItem[]>("/base/", {
    params: { status: "ativo" },
  });
  const list = Array.isArray(data) ? data : [];
  return list
    .filter((b) => b && typeof b.base === "string" && b.base.trim().length > 0)
    .map((b) => ({
      id_base: Number(b.id_base),
      base: String(b.base).trim(),
      sub_base: b.sub_base ?? null,
      ativo: b.ativo !== false,
      endereco_completo:
        typeof b.endereco_completo === "string" && b.endereco_completo.trim()
          ? b.endereco_completo.trim()
          : null,
      dias_coleta: Array.isArray(b.dias_coleta) ? b.dias_coleta.map(Number) : null,
      agenda_coleta_confirmada: Boolean(b.agenda_coleta_confirmada),
      papel: typeof b.papel === "string" && b.papel.trim() ? b.papel.trim() : null,
      entrega_pedidos: Boolean(b.entrega_pedidos),
    }))
    .sort((a, b) => a.base.localeCompare(b.base, "pt-BR", { sensitivity: "base" }));
}

/** Bases parceiras com interruptor de entrega ligado (mesmo contrato do web). */
export async function listarBasesQueEntregam(): Promise<BaseQueEntregaItem[]> {
  const { data } = await client.get<Array<{ id_base?: number; base?: string }>>("/base-repasse/bases");
  const list = Array.isArray(data) ? data : [];
  return list
    .filter((b) => b && b.id_base != null && typeof b.base === "string" && b.base.trim())
    .map((b) => ({
      id_base: Number(b.id_base),
      base: String(b.base).trim(),
    }))
    .sort((a, b) => a.base.localeCompare(b.base, "pt-BR", { sensitivity: "base" }));
}

export function papelClienteLabel(papel?: string | null): "Seller" | "Base" {
  return (papel || "seller") === "base_parceira" ? "Base" : "Seller";
}
