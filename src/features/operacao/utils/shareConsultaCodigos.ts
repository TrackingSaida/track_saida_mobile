import { listSaidas, type ListSaidasParams, type SaidaListItem } from "../saidasApi";

export const SHARE_LIMIT = 100;

export type ShareConsultaFiltros = Pick<
  ListSaidasParams,
  "status" | "de" | "ate" | "base" | "entregador" | "servico" | "somente_g" | "sort"
>;

function isStatusNaBase(status?: string): boolean {
  const t = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  return t === "na base";
}

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

export function formatDateBr(iso: string): string {
  const [yy, mm, dd] = iso.slice(0, 10).split("-");
  return yy && mm && dd ? `${dd}/${mm}/${yy}` : iso;
}

export function buildShareTitle(filtros: ShareConsultaFiltros): string {
  if (isStatusNaBase(filtros.status)) {
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

function extractPackageDateIso(row: SaidaListItem): string | null {
  if (typeof row.data === "string" && row.data.trim()) {
    return row.data.trim().slice(0, 10);
  }
  const ts = row.timestamp ?? row.data_hora_acao;
  if (typeof ts === "string" && ts.length >= 10) {
    return ts.slice(0, 10);
  }
  return null;
}

export type CodigosPorData = { date: string; codigos: string[] };

/** Agrupa códigos por data do pacote (Saida.data), mais recente primeiro. */
export function groupCodigosPorData(rows: SaidaListItem[]): CodigosPorData[] {
  const seen = new Set<string>();
  const byDate = new Map<string, string[]>();

  for (const row of rows) {
    const codigo = String(row.codigo || "").trim();
    if (!codigo) continue;
    const key = codigo.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const dateIso = extractPackageDateIso(row) || "sem-data";
    const list = byDate.get(dateIso) ?? [];
    list.push(codigo);
    byDate.set(dateIso, list);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, codigos]) => ({ date, codigos }));
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

export function buildShareMessageGrouped(opts: {
  title: string;
  groups: CodigosPorData[];
  total?: number | null;
}): string {
  const { title, groups } = opts;
  const total = typeof opts.total === "number" && Number.isFinite(opts.total) ? opts.total : null;
  const listed = groups.reduce((sum, g) => sum + g.codigos.length, 0);
  const lines = [title, ""];

  for (const group of groups) {
    const dateLabel = group.date === "sem-data" ? "Sem data" : formatDateBr(group.date);
    lines.push(`${dateLabel}:`);
    lines.push(...group.codigos);
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (total != null && total > listed) {
    lines.push(`… e mais ${total - listed}`);
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
  const rows = res.rows ?? [];
  const codigos = extractCodigosUnicos(rows);
  const total =
    typeof knownTotal === "number" && Number.isFinite(knownTotal)
      ? knownTotal
      : typeof res.total === "number"
        ? res.total
        : null;
  const title = buildShareTitle(filtros);

  if (isStatusNaBase(filtros.status)) {
    const groups = groupCodigosPorData(rows);
    const message = buildShareMessageGrouped({ title, groups, total });
    return { message, codigosCount: codigos.length, total };
  }

  const message = buildShareMessage({ title, codigos, total });
  return { message, codigosCount: codigos.length, total };
}
