import { parseYmd } from "./periodoConsulta";

export function formatInteger(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR");
}

export function formatPercent(value: number, digits = 1): string {
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** Razão percentual com 1 casa. Não limita a 100%. Null se o denominador for 0. */
export function ratioPercent(part: number, total: number): number | null {
  if (!total || Number.isNaN(Number(total))) return null;
  return Math.round((Number(part) / Number(total)) * 1000) / 10;
}

export function ratioPercentOrZero(part: number, total: number): number {
  return ratioPercent(part, total) ?? 0;
}

/** Largura de barra 0–100. */
export function barPercent(part: number, total: number): number {
  const pct = ratioPercent(part, total);
  if (pct == null) return 0;
  return Math.max(0, Math.min(100, pct));
}

export function taxaSaidaPercent(saidas: number, entradas: number): number | null {
  return ratioPercent(saidas, entradas);
}

export type BaseDayAge = "today" | "recent" | "older";

export function baseDayAge(iso: string, today: Date = new Date()): BaseDayAge {
  const d = parseYmd(iso);
  if (!d) return "today";
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((start.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days <= 2) return "recent";
  return "older";
}
