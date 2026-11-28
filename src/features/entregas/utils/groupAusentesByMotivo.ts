import type { EntregaListItem } from "../types";

export const MOTIVO_AUSENCIA_SEM_INFO = "Sem motivo informado";

export type AusenteMotivoSection = {
  motivo: string;
  data: EntregaListItem[];
};

function motivoLabel(item: EntregaListItem): string {
  const raw = String(item.motivo_ocorrencia ?? "").trim();
  return raw || MOTIVO_AUSENCIA_SEM_INFO;
}

/** Agrupa ausentes por motivo; faixas ordenadas pela quantidade (maior primeiro). */
export function groupAusentesByMotivo(items: EntregaListItem[]): AusenteMotivoSection[] {
  const map = new Map<string, EntregaListItem[]>();
  for (const item of items) {
    const key = motivoLabel(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries())
    .map(([motivo, data]) => ({ motivo, data }))
    .sort((a, b) => b.data.length - a.data.length || a.motivo.localeCompare(b.motivo, "pt-BR"));
}
