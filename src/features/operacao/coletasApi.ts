import { apiClient as client } from "../../services/apiClient";

export type ServicoColeta = "Shopee" | "Mercado Livre" | "Avulso";

export interface ColetaItemPayload {
  codigo: string;
  servico: ServicoColeta | string;
  qr_payload_raw?: string;
  is_grande?: boolean;
}

export interface ResumoLote {
  inseridos: number;
  duplicados: number;
  codigos_duplicados: string[];
  contagem: Record<string, number>;
  precos: Record<string, string>;
  total: string;
}

export interface ColetaOut {
  id_coleta: number;
  timestamp: string;
  base: string;
  sub_base: string;
  username_entregador: string;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  valor_total: string;
  origem: string;
  pacotes_g: number;
  g_shopee: number;
  g_ml: number;
  g_avulso: number;
}

export interface SaidaCriadaLote {
  codigo: string;
  id_saida: number;
}

export interface LoteResponse {
  coleta: ColetaOut;
  resumo: ResumoLote;
  saidas_criadas: SaidaCriadaLote[];
  totais?: TotaisColetaBase | null;
}

export interface TotaisColetaBase {
  total: number;
  shopee: number;
  mercado_livre: number;
  avulso: number;
}

export interface ColetaLancarAvulsoResult {
  quantidade_criada: number;
  codigos: string[];
  saidas: Array<{
    id_saida: number;
    codigo: string;
    servico: string;
    status: string;
  }>;
  coleta: ColetaOut;
  mensagem: string;
  totais?: TotaisColetaBase | null;
}

export interface EnviarColetaParams {
  base: string;
  item: ColetaItemPayload;
  entregadorId?: number | null;
}

export async function enviarColetaUnica({
  base,
  item,
  entregadorId,
}: EnviarColetaParams): Promise<LoteResponse> {
  const body: {
    base: string;
    itens: ColetaItemPayload[];
    entregador_id?: number;
  } = {
    base,
    itens: [
      {
        codigo: item.codigo,
        servico: item.servico,
        ...(item.qr_payload_raw ? { qr_payload_raw: item.qr_payload_raw } : {}),
        ...(item.is_grande ? { is_grande: true } : {}),
      },
    ],
  };

  if (typeof entregadorId === "number") {
    body.entregador_id = entregadorId;
  }

  const { data } = await client.post<LoteResponse>("/coletas/lote", body);
  return data;
}

export async function lancarAvulsoColeta(params: {
  base: string;
  identificacao?: string | null;
  quantidade: number;
}): Promise<ColetaLancarAvulsoResult> {
  const { data } = await client.post<ColetaLancarAvulsoResult>("/coletas/lancar-avulso", {
    base: params.base,
    quantidade: params.quantidade,
    ...(params.identificacao ? { identificacao: params.identificacao } : {}),
  });
  return data;
}

export interface ParticipanteSituacaoColeta {
  user_id: number;
  username: string;
  status: "em_coleta" | "finalizado";
  total: number;
  id_participante?: number;
  shopee?: number;
  mercado_livre?: number;
  avulso?: number;
  versao?: number;
  sem_volume?: boolean;
  valor_total?: string;
  pode_editar?: boolean;
  pode_corrigir?: boolean;
}

export interface SituacaoBaseColeta {
  base_id: number;
  base: string;
  endereco_completo?: string | null;
  /** Dia da coleta (YYYY-MM-DD); útil em períodos multi-dia. */
  data_operacao?: string | null;
  status: "pendente" | "em_coleta" | "coletado" | "sem_volume";
  id_execucao: number | null;
  modo: "codigo" | "coleta_manual" | "ambos" | null;
  total: number;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  valor_total?: string;
  precos?: { shopee: string; mercado_livre: string; avulso: string };
  participantes: ParticipanteSituacaoColeta[];
  participando: boolean;
  pode_ajudar: boolean;
  pode_corrigir?: boolean;
  atualizado_em?: string | null;
}

export interface SituacaoColetasResponse {
  data_operacao: string;
  data_inicio?: string;
  data_fim?: string;
  pode_corrigir_quantidades?: boolean;
  resumo: { pendentes: number; em_coleta: number; coletadas: number };
  itens: SituacaoBaseColeta[];
}

export async function consultarSituacaoColetas(dataOperacao: string): Promise<SituacaoColetasResponse> {
  const { data } = await client.get<SituacaoColetasResponse>("/coletas/operacionais/situacao", {
    params: { data_operacao: dataOperacao },
  });
  return data;
}

export interface ExecucaoOperacionalParticipante {
  id_participante: number;
  user_id: number;
  motoboy_id?: number | null;
  username: string;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  pacotes_g?: number;
  g_shopee?: number;
  g_ml?: number;
  g_avulso?: number;
  sem_volume: boolean;
  status: "em_coleta" | "finalizado" | string;
  versao: number;
  total: number;
  pode_editar?: boolean;
}

export interface ExecucaoOperacional {
  id_execucao: number;
  base_id: number;
  base: string;
  data_operacao: string;
  modo: "codigo" | "coleta_manual" | "ambos" | string;
  status: "em_coleta" | "coletado" | "sem_volume" | string;
  total: number;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  participantes: ExecucaoOperacionalParticipante[];
}

export async function listarExecucoesOperacionais(params: {
  dataInicio: string;
  dataFim: string;
  somenteMinhas?: boolean;
}): Promise<ExecucaoOperacional[]> {
  const { data } = await client.get<ExecucaoOperacional[]>("/coletas/operacionais/", {
    params: {
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
      ...(params.somenteMinhas ? { somente_minhas: true } : {}),
    },
  });
  return Array.isArray(data) ? data : [];
}

function normalizarStatusExecucao(status: string): SituacaoBaseColeta["status"] {
  if (status === "em_coleta" || status === "coletado" || status === "sem_volume" || status === "pendente") {
    return status;
  }
  return "coletado";
}

function mapExecucaoParaSituacao(item: ExecucaoOperacional): SituacaoBaseColeta {
  const dataOp =
    typeof item.data_operacao === "string"
      ? item.data_operacao.slice(0, 10)
      : String(item.data_operacao || "").slice(0, 10);
  const modo =
    item.modo === "codigo" || item.modo === "coleta_manual" || item.modo === "ambos" ? item.modo : null;
  return {
    base_id: item.base_id,
    base: item.base,
    data_operacao: dataOp || null,
    status: normalizarStatusExecucao(item.status),
    id_execucao: item.id_execucao,
    modo,
    total: Number(item.total || 0),
    shopee: Number(item.shopee || 0),
    mercado_livre: Number(item.mercado_livre || 0),
    avulso: Number(item.avulso || 0),
    participantes: (item.participantes || []).map((p) => ({
      id_participante: p.id_participante,
      user_id: p.user_id,
      username: p.username,
      status: p.status === "em_coleta" ? "em_coleta" : "finalizado",
      total: Number(p.total || 0),
      shopee: Number(p.shopee || 0),
      mercado_livre: Number(p.mercado_livre || 0),
      avulso: Number(p.avulso || 0),
      versao: Number(p.versao || 1),
      sem_volume: Boolean(p.sem_volume),
      pode_editar: Boolean(p.pode_editar),
      pode_corrigir: false,
    })),
    participando: false,
    pode_ajudar: false,
    pode_corrigir: false,
  };
}

function resumoDeItens(itens: SituacaoBaseColeta[]): SituacaoColetasResponse["resumo"] {
  let pendentes = 0;
  let em_coleta = 0;
  let coletadas = 0;
  for (const item of itens) {
    if (item.status === "pendente") pendentes += 1;
    else if (item.status === "em_coleta") em_coleta += 1;
    else coletadas += 1;
  }
  return { pendentes, em_coleta, coletadas };
}

/**
 * Dia único → situação (todas as bases).
 * Intervalo → listagem de execuções no período.
 */
export async function carregarConsultaColetasPorPeriodo(
  dataInicio: string,
  dataFim: string
): Promise<SituacaoColetasResponse> {
  if (dataInicio === dataFim) {
    const payload = await consultarSituacaoColetas(dataInicio);
    const itens = (payload.itens || []).map((item) => ({
      ...item,
      data_operacao: item.data_operacao || dataInicio,
    }));
    return {
      ...payload,
      data_operacao: payload.data_operacao || dataInicio,
      data_inicio: dataInicio,
      data_fim: dataFim,
      itens,
      resumo: payload.resumo || resumoDeItens(itens),
    };
  }

  const rows = await listarExecucoesOperacionais({ dataInicio, dataFim });
  const itens = rows.map(mapExecucaoParaSituacao);
  return {
    data_operacao: dataFim,
    data_inicio: dataInicio,
    data_fim: dataFim,
    itens,
    resumo: resumoDeItens(itens),
  };
}

export interface CorrigirQuantidadesPayload {
  shopee: number;
  mercado_livre: number;
  avulso: number;
  versao: number;
  origem_cliente: "mobile" | "web";
}

export interface CorrigirQuantidadesResult {
  id_participante: number;
  base: string;
  data_operacao: string;
  modo: string;
  tipo_ajuste: "manual" | "leitura";
  shopee: number;
  mercado_livre: number;
  avulso: number;
  delta_shopee: number;
  delta_mercado_livre: number;
  delta_avulso: number;
  valor_anterior: string;
  valor_novo: string;
  versao: number;
}

export async function corrigirQuantidadesParticipante(
  idParticipante: number,
  payload: CorrigirQuantidadesPayload
): Promise<CorrigirQuantidadesResult> {
  const { data } = await client.post<CorrigirQuantidadesResult>(
    `/coletas/operacionais/participantes/${idParticipante}/corrigir`,
    payload
  );
  return data;
}

export interface ColetaOperacionalConfig {
  modo_operacao: "desativado" | "codigo" | "coleta_manual" | "ambos";
  coleta_habilitada: boolean;
  permite_leitura: boolean;
  permite_manual: boolean;
}

export async function obterConfigColetaOperacional(): Promise<ColetaOperacionalConfig> {
  const { data } = await client.get<ColetaOperacionalConfig>("/coletas/operacionais/config");
  return data;
}

export interface IniciarColetaOperacionalPayload {
  metodo: "codigo" | "coleta_manual";
  ajudar?: boolean;
}

/** Marca a base como Em coleta para o dia (visível aos demais usuários). */
export async function iniciarColetaOperacional(
  baseId: number,
  payload: IniciarColetaOperacionalPayload
): Promise<unknown> {
  const { data } = await client.post(`/coletas/operacionais/bases/${baseId}/iniciar`, {
    metodo: payload.metodo,
    ajudar: Boolean(payload.ajudar),
  });
  return data;
}

/** Sai da coleta sem volume: base volta a Pendente se ninguém mais estiver nela. */
export async function liberarParticipacaoColeta(idExecucao: number): Promise<void> {
  await client.delete(`/coletas/operacionais/execucoes/${idExecucao}/participacao`);
}

export interface ColetaManualOperacionalPayload {
  base_id: number;
  data_operacao: string;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  sem_volume: boolean;
  origem_cliente: "mobile";
}

export async function lancarColetaManualOperacional(
  payload: ColetaManualOperacionalPayload
): Promise<unknown> {
  const { data } = await client.post("/coletas/operacionais/manual", payload);
  return data;
}

export interface ResumoBaseColeta {
  base_id: number;
  base: string;
  data_operacao: string;
  status: string;
  id_execucao: number | null;
  total: number;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  atualizado_em?: string | null;
}

export async function consultarResumoBaseColeta(
  baseId: number,
  dataOperacao: string
): Promise<ResumoBaseColeta> {
  const { data } = await client.get<ResumoBaseColeta>(
    `/coletas/operacionais/bases/${baseId}/resumo`,
    { params: { data_operacao: dataOperacao } }
  );
  return data;
}

export interface LeituraColetaItem {
  id_saida: number;
  codigo: string;
  servico: string | null;
  horario: string;
  operador: string;
  operador_user_id?: number | null;
  situacao: string;
  status?: string | null;
  pode_remover: boolean;
  motivo_bloqueio?: string | null;
}

export interface LeiturasColetaResponse {
  base_id: number;
  base: string;
  data_operacao: string;
  itens: LeituraColetaItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export async function listarLeiturasColeta(params: {
  baseId: number;
  dataOperacao: string;
  limit?: number;
  cursor?: string | null;
  somenteMinhas?: boolean;
}): Promise<LeiturasColetaResponse> {
  const { data } = await client.get<LeiturasColetaResponse>("/coletas/operacionais/leituras", {
    params: {
      base_id: params.baseId,
      data_operacao: params.dataOperacao,
      limit: params.limit ?? 40,
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.somenteMinhas ? { somente_minhas: true } : {}),
    },
  });
  return data;
}

export interface RemoverLeituraColetaResult {
  removido: boolean;
  id_saida: number;
  codigo: string;
  totais: TotaisColetaBase;
  idempotente?: boolean;
}

export async function removerLeituraColeta(
  idSaida: number,
  motivo?: string
): Promise<RemoverLeituraColetaResult> {
  const { data } = await client.delete<RemoverLeituraColetaResult>(
    `/coletas/operacionais/leituras/${idSaida}`,
    { params: motivo ? { motivo } : undefined }
  );
  return data;
}
