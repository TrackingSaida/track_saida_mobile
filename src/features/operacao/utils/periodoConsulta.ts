/** Helpers de período para consulta de saídas (operação). */

export type PeriodoPreset = "hoje" | "ontem" | "quinzena" | "outro";

export type PeriodoConsulta = {
  preset: PeriodoPreset;
  dataInicio: string;
  dataFim: string;
};

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function parseYmd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Quinzena corrente até a data de referência (1→ref ou 16→ref). */
export function periodoQuinzenaAtual(ref: Date = new Date()): { inicio: string; fim: string } {
  const fim = formatYmd(ref);
  const inicioDate =
    ref.getDate() <= 15
      ? new Date(ref.getFullYear(), ref.getMonth(), 1)
      : new Date(ref.getFullYear(), ref.getMonth(), 16);
  return { inicio: formatYmd(inicioDate), fim };
}

export function buildPeriodo(preset: PeriodoPreset, outroDia?: string): PeriodoConsulta {
  const today = new Date();
  const todayIso = formatYmd(today);

  if (preset === "hoje") {
    return { preset, dataInicio: todayIso, dataFim: todayIso };
  }
  if (preset === "ontem") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const iso = formatYmd(y);
    return { preset, dataInicio: iso, dataFim: iso };
  }
  if (preset === "quinzena") {
    const q = periodoQuinzenaAtual(today);
    return { preset, dataInicio: q.inicio, dataFim: q.fim };
  }
  const iso = outroDia && parseYmd(outroDia) ? outroDia : todayIso;
  return { preset: "outro", dataInicio: iso, dataFim: iso };
}

export function labelPeriodo(p: PeriodoConsulta): string {
  if (p.preset === "hoje") return `Hoje (${formatDateLabel(p.dataFim)})`;
  if (p.preset === "ontem") return `Ontem (${formatDateLabel(p.dataFim)})`;
  if (p.preset === "quinzena") {
    return `Quinzena atual (${formatDateLabel(p.dataInicio)} – ${formatDateLabel(p.dataFim)})`;
  }
  return formatDateLabel(p.dataFim);
}

export function isPeriodoDiaUnico(p: PeriodoConsulta): boolean {
  return p.dataInicio === p.dataFim;
}
