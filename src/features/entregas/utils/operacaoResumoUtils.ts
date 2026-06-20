import type { EntregaHistoricoItem, EntregaListItem } from "../types";
import {
  formatDetailDateOnly,
  formatDetailDateTimeFull,
  resolveDetailStatusKind,
} from "../components/detail/detailFormatters";
import { normalizeEventoKey } from "../../operacao/utils/operacaoHistoricoUtils";

export type OperacaoResumoRow = {
  label: string;
  value: string;
};

const ENTRADA_KEYS = new Set(["scan", "lido", "leitura", "lancar_avulso", "nova_saida_mesmo_entregador"]);
const SAIU_KEYS = new Set(["em_rota"]);
const FINALIZADA_KEYS = new Set(["entregue", "entregue_lote"]);
const AUSENTE_KEYS = new Set(["ausente", "ausente_lote"]);
const CANCELADO_KEYS = new Set(["cancelado"]);

function parseTs(value?: string | null): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function formatResumoDateTime(value?: string | null): string | null {
  return formatDetailDateTimeFull(value) ?? formatDetailDateOnly(value);
}

function findFirstEvent(
  historico: EntregaHistoricoItem[],
  keys: Set<string>
): EntregaHistoricoItem | null {
  for (const item of historico) {
    if (keys.has(normalizeEventoKey(item.evento))) return item;
  }
  return null;
}

function findLastEvent(
  historico: EntregaHistoricoItem[],
  keys: Set<string>
): EntregaHistoricoItem | null {
  let last: EntregaHistoricoItem | null = null;
  for (const item of historico) {
    if (keys.has(normalizeEventoKey(item.evento))) last = item;
  }
  return last;
}

function resolveEntrada(entrega: EntregaListItem, historico: EntregaHistoricoItem[]): string | null {
  const fromHist = findFirstEvent(historico, ENTRADA_KEYS);
  if (fromHist?.timestamp) return formatResumoDateTime(fromHist.timestamp);
  const fromCadastro = formatResumoDateTime(entrega.data_hora_cadastro);
  if (fromCadastro) return fromCadastro;
  return formatDetailDateOnly(entrega.data_operacional ?? entrega.data);
}

function resolveSaiuParaEntrega(historico: EntregaHistoricoItem[]): string | null {
  const ev = findLastEvent(historico, SAIU_KEYS);
  return ev?.timestamp ? formatResumoDateTime(ev.timestamp) : null;
}

function resolveFinalizada(entrega: EntregaListItem, historico: EntregaHistoricoItem[]): string | null {
  const ev = findLastEvent(historico, FINALIZADA_KEYS);
  if (ev?.timestamp) return formatResumoDateTime(ev.timestamp);
  return formatResumoDateTime(entrega.data_hora_entrega);
}

function resolveUltimaTentativa(entrega: EntregaListItem, historico: EntregaHistoricoItem[]): string | null {
  const ev = findLastEvent(historico, AUSENTE_KEYS);
  if (ev?.timestamp) return formatResumoDateTime(ev.timestamp);
  return formatResumoDateTime(entrega.data_hora_ocorrencia);
}

function resolveCanceladoEm(historico: EntregaHistoricoItem[]): string | null {
  const ev = findLastEvent(historico, CANCELADO_KEYS);
  return ev?.timestamp ? formatResumoDateTime(ev.timestamp) : null;
}

export function formatOperacaoDuration(startIso?: string | null, endIso?: string | null): string | null {
  const start = parseTs(startIso);
  const end = parseTs(endIso);
  if (start == null || end == null || end < start) return null;
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function resolveEntradaTimestamp(entrega: EntregaListItem, historico: EntregaHistoricoItem[]): string | null {
  const fromHist = findFirstEvent(historico, ENTRADA_KEYS);
  if (fromHist?.timestamp) return fromHist.timestamp;
  if (entrega.data_hora_cadastro) return entrega.data_hora_cadastro;
  const day = entrega.data_operacional ?? entrega.data;
  return day ? `${day}T00:00:00` : null;
}

function pushRow(rows: OperacaoResumoRow[], label: string, value: string | null | undefined) {
  const v = (value ?? "").trim();
  if (v) rows.push({ label, value: v });
}

export function buildOperacaoResumoRows(
  entrega: EntregaListItem,
  historico: EntregaHistoricoItem[],
  now: Date = new Date()
): OperacaoResumoRow[] {
  const kind = resolveDetailStatusKind(entrega);
  const rows: OperacaoResumoRow[] = [];
  const entrada = resolveEntrada(entrega, historico);
  const entradaTs = resolveEntradaTimestamp(entrega, historico);
  const saiu = resolveSaiuParaEntrega(historico);
  const finalizada = resolveFinalizada(entrega, historico);
  const ultimaTentativa = resolveUltimaTentativa(entrega, historico);
  const canceladoEm = resolveCanceladoEm(historico);
  const tentativas = entrega.tentativa ?? 1;
  const motivo = (entrega.motivo_ocorrencia ?? "").trim();
  const motivoCancel = (entrega.motivo_ocorrencia ?? entrega.observacao_ocorrencia ?? "").trim();

  const endTs =
    kind === "entregue"
      ? findLastEvent(historico, FINALIZADA_KEYS)?.timestamp ?? entrega.data_hora_entrega
      : kind === "cancelado"
        ? findLastEvent(historico, CANCELADO_KEYS)?.timestamp
        : now.toISOString();

  const tempo =
    kind === "pendente" || kind === "entregue"
      ? formatOperacaoDuration(entradaTs, endTs ?? undefined)
      : null;

  switch (kind) {
    case "pendente":
      pushRow(rows, "Entrada", entrada);
      pushRow(rows, "Saiu para entrega", saiu);
      pushRow(rows, "Tempo em aberto", tempo);
      if (tentativas > 1) pushRow(rows, "Tentativas", String(tentativas));
      break;
    case "ausente":
      pushRow(rows, "Entrada", entrada);
      pushRow(rows, "Última tentativa", ultimaTentativa);
      pushRow(rows, "Motivo", motivo);
      pushRow(rows, "Tentativas", String(tentativas));
      break;
    case "entregue":
      pushRow(rows, "Entrada", entrada);
      pushRow(rows, "Finalizada", finalizada);
      pushRow(rows, "Tempo na operação", tempo);
      if (tentativas > 1) pushRow(rows, "Tentativas", String(tentativas));
      break;
    case "cancelado":
      pushRow(rows, "Entrada", entrada);
      pushRow(rows, "Cancelado em", canceladoEm);
      pushRow(rows, "Motivo", motivoCancel);
      break;
  }

  return rows;
}
