import type { AcompanhamentoMotoboyItem } from "../acompanhamentoApi";

export const INACTIVE_MINUTES = 120;
export const SLA_CRITICAL = 20;
export const SLA_LOW = 10;

export type QuickFilterKey =
  | "todos"
  | "criticos"
  | "sem_entrega"
  | "finalizados"
  | "em_andamento";

export type MotoboyStatusKey = "sem_entrega" | "finalizado" | "critico" | "em_andamento";

export type StatusTier = "success" | "warning" | "orange" | "danger" | "neutral" | "info";

export function slaTier(pct: number | null | undefined): StatusTier {
  if (pct == null || Number.isNaN(Number(pct))) return "neutral";
  const n = Number(pct);
  if (n >= 80) return "success";
  if (n >= 50) return "warning";
  if (n >= 20) return "orange";
  return "danger";
}

export function fmtSLA(val: number | null | undefined): string {
  if (val == null || val === undefined) return "—";
  return `${Number(val).toFixed(1)}%`;
}

export function minutesSince(isoStr: string | null | undefined, now: Date = new Date()): number | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor((now.getTime() - d.getTime()) / 60000);
  } catch {
    return null;
  }
}

function formatRelativeMinutes(minutes: number | null): string {
  if (minutes == null || minutes < 0) return "";
  if (minutes < 60) return `há ${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `há ${h}h`;
  return `há ${h}h${String(m).padStart(2, "0")}`;
}

export function fmtUltimaEntrega(
  isoStr: string | null | undefined,
  now: Date = new Date()
): { text: string; tier: StatusTier } {
  if (!isoStr) {
    return { text: "Sem entrega", tier: "danger" };
  }
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) {
      return { text: "Sem entrega", tier: "danger" };
    }
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const mins = minutesSince(isoStr, now);
    if (mins == null) return { text: time, tier: "warning" };
    if (mins < 30) return { text: `Última entrega: ${time}`, tier: "success" };
    if (mins < INACTIVE_MINUTES) {
      return { text: `Última entrega: ${time} · ${formatRelativeMinutes(mins)}`, tier: "warning" };
    }
    return { text: `Última entrega: ${time} · ${formatRelativeMinutes(mins)}`, tier: "danger" };
  } catch {
    return { text: "Sem entrega", tier: "danger" };
  }
}

export function isInactive(row: AcompanhamentoMotoboyItem, now: Date = new Date()): boolean {
  if (!row || (row.pedidos ?? 0) === 0) return false;
  if ((row.entregues ?? 0) === 0) return true;
  const mins = minutesSince(row.ultima_entrega, now);
  if (mins == null) return true;
  return mins > INACTIVE_MINUTES;
}

export function isCritico(row: AcompanhamentoMotoboyItem, now: Date = new Date()): boolean {
  if (!row) return false;
  if ((row.entregues ?? 0) === 0) return true;
  const sla = row.sla != null ? Number(row.sla) : null;
  if (sla != null && sla < SLA_CRITICAL) return true;
  return isInactive(row, now);
}

export function deriveStatus(
  row: AcompanhamentoMotoboyItem,
  now: Date = new Date()
): { key: MotoboyStatusKey; label: string } {
  const entregues = row.entregues ?? 0;
  const emRota = row.em_rota ?? 0;

  if (entregues === 0) {
    return { key: "sem_entrega", label: "Sem entrega" };
  }
  if (emRota === 0 && entregues > 0) {
    return { key: "finalizado", label: "Finalizado" };
  }
  if (isCritico(row, now)) {
    return { key: "critico", label: "Crítico" };
  }
  if (emRota > 0 && entregues > 0) {
    return { key: "em_andamento", label: "Em andamento" };
  }
  return { key: "em_andamento", label: "Em andamento" };
}

export function matchesQuickFilter(
  row: AcompanhamentoMotoboyItem,
  filter: QuickFilterKey,
  now: Date = new Date()
): boolean {
  if (!filter || filter === "todos") return true;
  const entregues = row.entregues ?? 0;
  const emRota = row.em_rota ?? 0;

  switch (filter) {
    case "criticos":
      return isCritico(row, now);
    case "sem_entrega":
      return entregues === 0;
    case "finalizados":
      return emRota === 0 && entregues > 0;
    case "em_andamento":
      return emRota > 0 && entregues > 0;
    default:
      return true;
  }
}

export function applyQuickFilter(
  items: AcompanhamentoMotoboyItem[],
  filter: QuickFilterKey,
  now: Date = new Date()
): AcompanhamentoMotoboyItem[] {
  return items.filter((row) => matchesQuickFilter(row, filter, now));
}

export function motoboyStatusColors(key: MotoboyStatusKey): { bg: string; fg: string } {
  switch (key) {
    case "finalizado":
      return { bg: "#dcfce7", fg: "#166534" };
    case "em_andamento":
      return { bg: "#dbeafe", fg: "#1d4ed8" };
    case "critico":
      return { bg: "#fee2e2", fg: "#b91c1c" };
    case "sem_entrega":
      return { bg: "#ffedd5", fg: "#c2410c" };
    default:
      return { bg: "#f3f4f6", fg: "#374151" };
  }
}

export function emptyMessageForFilter(filter: QuickFilterKey): string {
  switch (filter) {
    case "criticos":
      return "Nenhum motoboy crítico.";
    case "sem_entrega":
      return "Nenhum motoboy sem entrega.";
    case "finalizados":
      return "Nenhum motoboy finalizado.";
    case "em_andamento":
      return "Nenhum motoboy em andamento.";
    default:
      return "Sem dados para a data selecionada.";
  }
}
