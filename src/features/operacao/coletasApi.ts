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

export interface ColetaParticipanteOperacional {
  id_participante: number;
  user_id: number;
  motoboy_id?: number | null;
  username: string;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  pacotes_g: number;
  g_shopee: number;
  g_ml: number;
  g_avulso: number;
  sem_volume: boolean;
  versao: number;
  total: number;
  pode_editar: boolean;
}

export interface ColetaExecucaoOperacional {
  id_execucao: number;
  base_id: number;
  base: string;
  data_operacao: string;
  modo: "codigo" | "coleta_manual" | "ambos";
  status: string;
  total: number;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  participantes: ColetaParticipanteOperacional[];
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

export async function listarMinhasColetas(data: string): Promise<ColetaExecucaoOperacional[]> {
  const response = await client.get<ColetaExecucaoOperacional[]>("/coletas/operacionais/", {
    params: { data_inicio: data, data_fim: data, somente_minhas: true },
  });
  return Array.isArray(response.data) ? response.data : [];
}

export interface ColetaManualOperacionalPayload {
  base_id: number;
  data_operacao: string;
  shopee: number;
  mercado_livre: number;
  avulso: number;
  sem_volume: boolean;
  client_request_id?: string;
  origem_cliente: "mobile";
}

export async function lancarColetaManualOperacional(
  payload: ColetaManualOperacionalPayload
): Promise<ColetaExecucaoOperacional> {
  const { data } = await client.post<ColetaExecucaoOperacional>("/coletas/operacionais/manual", payload);
  return data;
}

export async function editarColetaManualOperacional(
  idParticipante: number,
  payload: Omit<ColetaManualOperacionalPayload, "base_id" | "data_operacao" | "client_request_id"> & { versao: number }
): Promise<ColetaExecucaoOperacional> {
  const { data } = await client.patch<ColetaExecucaoOperacional>(
    `/coletas/operacionais/participantes/${idParticipante}`,
    payload
  );
  return data;
}
