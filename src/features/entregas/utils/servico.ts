import type { EntregaListItem } from "../types";

export type ServicoTipo = "Shopee" | "Flex" | "Avulso";

export type PrepOrdemModo = "sequencial" | "servico";

export function servicoTipo(serv?: string | null): ServicoTipo {
  const s = (serv || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("mercado") || s.includes("ml") || s.includes("flex")) return "Flex";
  return "Avulso";
}

export const SERVICO_ORDER: ServicoTipo[] = ["Shopee", "Flex", "Avulso"];

export const SERVICO_COLORS: Record<ServicoTipo, string> = {
  Shopee: "#ee4d2d",
  Flex: "#ffe066",
  Avulso: "#6366f1",
};

export function servicoOrdemComPrimeiro(primeiro: ServicoTipo): ServicoTipo[] {
  return [primeiro, ...SERVICO_ORDER.filter((s) => s !== primeiro)];
}

export function buildPrepQueue(
  items: EntregaListItem[],
  opts: { modo: PrepOrdemModo; servicoInicio: ServicoTipo }
): EntregaListItem[] {
  if (opts.modo === "sequencial") return [...items];
  const ordem = servicoOrdemComPrimeiro(opts.servicoInicio);
  return [...items].sort(
    (a, b) => ordem.indexOf(servicoTipo(a.servico)) - ordem.indexOf(servicoTipo(b.servico))
  );
}

export function prepOrdemLabel(modo: PrepOrdemModo, servicoInicio: ServicoTipo): string {
  if (modo === "sequencial") return "Sequencial";
  return `Por serviço — ${servicoInicio} primeiro`;
}

export type EntregasListTab = "pendente" | "ausentes" | "finalizadas";

export type ServiceStatusSummary = {
  pending: number;
  absent: number;
  finished: number;
};

export function serviceCountForTab(
  tab: EntregasListTab,
  summary: ServiceStatusSummary,
  sectionLength: number
): number {
  if (tab === "pendente") return summary.pending;
  if (tab === "ausentes") return summary.absent;
  return sectionLength;
}

export function serviceCountLabelForTab(tab: EntregasListTab, count: number): string {
  const n = String(count);
  if (tab === "pendente") return `${n} Pendentes`;
  if (tab === "ausentes") return `${n} Ausentes`;
  return `${n} Finalizadas`;
}
