import type { EntregaListItem } from "../types";

export function unionCamposObrigatorios(
  ...lists: Array<string[] | null | undefined>
): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    for (const raw of list || []) {
      const c = String(raw || "").trim().toLowerCase();
      if (c) out.add(c);
    }
  }
  return [...out].sort();
}

export function camposEntregueFromDeliveries(
  deliveries: Array<
    Pick<EntregaListItem, "campos_obrigatorios_entregue"> | null | undefined
  >
): string[] {
  return unionCamposObrigatorios(...deliveries.map((d) => d?.campos_obrigatorios_entregue));
}

export function camposAusenteFromDeliveries(
  deliveries: Array<
    Pick<EntregaListItem, "campos_obrigatorios_ausente"> | null | undefined
  >
): string[] {
  return unionCamposObrigatorios(...deliveries.map((d) => d?.campos_obrigatorios_ausente));
}

/** Evita apagar regras locais quando a API devolve item sem campos_obrigatorios. */
export function mergeEntregaPreservingCampos(
  prev: EntregaListItem | undefined,
  updated: EntregaListItem
): EntregaListItem {
  if (!prev) return updated;
  const pick = (
    key: "campos_obrigatorios" | "campos_obrigatorios_entregue" | "campos_obrigatorios_ausente"
  ): string[] => {
    const next = updated[key];
    const old = prev[key];
    if (Array.isArray(next) && next.length > 0) return next;
    if (Array.isArray(old) && old.length > 0) return old;
    return Array.isArray(next) ? next : Array.isArray(old) ? old : [];
  };
  return {
    ...prev,
    ...updated,
    campos_obrigatorios: pick("campos_obrigatorios"),
    campos_obrigatorios_entregue: pick("campos_obrigatorios_entregue"),
    campos_obrigatorios_ausente: pick("campos_obrigatorios_ausente"),
  };
}
