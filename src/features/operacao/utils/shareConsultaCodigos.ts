import { listSaidas, type ListSaidasParams, type SaidaListItem } from "../saidasApi";

export const SHARE_LIMIT = 100;

export type ShareConsultaFiltros = Pick<
  ListSaidasParams,
  "status" | "de" | "ate" | "base" | "entregador" | "servico" | "somente_g" | "sort"
>;

function labelStatusAmigavel(status?: string): string | null {
  const t = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (!t) return null;
  if (t === "na base") return "Na base";
  if (t === "entregue") return "Entregue";
  if (t.includes("saiu") || t === "em rota") return "Em rota";
  return status!.trim();
}

function labelPeriodoAmigavel(de?: string, ate?: string): string | null {
  if (!de && !ate) return null;
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, "0");
  const d = String(hoje.getDate()).padStart(2, "0");
  const today = `${y}-${m}-${d}`;
  if (de === today && ate === today) return "Hoje";
  if (de && ate && de === ate) {
    const [yy, mm, dd] = de.split("-");
    return yy && mm && dd ? `${dd}/${mm}/${yy}` : de;
  }
  if (de && ate) {
    const fmt = (iso: string) => {
      const [yy, mm, dd] = iso.split("-");
      return yy && mm && dd ? `${dd}/${mm}/${yy}` : iso;
    };
    return `${fmt(de)} – ${fmt(ate)}`;
  }
  return de || ate || null;
}

export function buildShareTitle(filtros: ShareConsultaFiltros): string {
  const st = String(filtros.status || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (st === "na base") {
    return "Pedidos com entrada na base sem saída:";
  }
  const parts: string[] = [];
  const statusLabel = labelStatusAmigavel(filtros.status);
  const periodoLabel = labelPeriodoAmigavel(filtros.de, filtros.ate);
  if (statusLabel) parts.push(statusLabel);
  if (periodoLabel) parts.push(periodoLabel);
  if (parts.length === 0) return "Pedidos consultados:";
  return `Pedidos consultados (${parts.join(" · ")}):`;
}

export function extractCodigosUnicos(rows: SaidaListItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const codigo = String(row.codigo || "").trim();
    if (!codigo) continue;
    const key = codigo.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(codigo);
  }
  return out;
}

export function buildShareMessage(opts: {
  title: string;
  codigos: string[];
  total?: number | null;
}): string {
  const { title, codigos } = opts;
  const total = typeof opts.total === "number" && Number.isFinite(opts.total) ? opts.total : null;
  const lines = [title, "", ...codigos];
  if (total != null && total > codigos.length) {
    lines.push(`… e mais ${total - codigos.length}`);
  }
  return lines.join("\n");
}

/** Busca até SHARE_LIMIT códigos do filtro e monta o texto para Share.share. */
export async function buildShareConsultaMessage(
  filtros: ShareConsultaFiltros,
  knownTotal?: number | null
): Promise<{ message: string; codigosCount: number; total: number | null }> {
  const res = await listSaidas({
    ...filtros,
    limit: SHARE_LIMIT,
    offset: 0,
    sort: filtros.sort || "recentes",
  });
  const codigos = extractCodigosUnicos(res.rows ?? []);
  const total =
    typeof knownTotal === "number" && Number.isFinite(knownTotal)
      ? knownTotal
      : typeof res.total === "number"
        ? res.total
        : null;
  const title = buildShareTitle(filtros);
  const message = buildShareMessage({ title, codigos, total });
  return { message, codigosCount: codigos.length, total };
}
