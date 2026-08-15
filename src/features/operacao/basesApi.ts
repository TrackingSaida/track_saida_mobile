import { apiClient as client } from "../../services/apiClient";

export interface BaseItem {
  id_base: number;
  base: string;
  sub_base?: string | null;
  ativo?: boolean;
  /** Endereço corrido vindo de base_seller_dados (quando cadastrado). */
  endereco_completo?: string | null;
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
    }))
    .sort((a, b) => a.base.localeCompare(b.base, "pt-BR", { sensitivity: "base" }));
}
