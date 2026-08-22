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
