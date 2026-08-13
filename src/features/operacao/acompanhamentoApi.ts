import { apiClient as client } from "../../services/apiClient";

export interface AcompanhamentoMotoboyItem {
  data: string;
  motoboy_id: number;
  motoboy_nome: string;
  pedidos: number;
  entregues: number;
  em_rota: number;
  ausente_ou_ocorrencias: number;
  rota?: string | null;
  distancia_tempo?: string | null;
  ultima_entrega?: string | null;
  sla?: number | null;
  sum_shopee?: number;
  sum_mercado?: number;
  sum_avulso?: number;
}

export interface AcompanhamentoTotais {
  pedidos: number;
  entregues: number;
  em_rota: number;
  ausente_ou_ocorrencias: number;
  sla?: number | null;
  entrada_habilitada?: boolean;
  entradas?: number | null;
  saidas?: number | null;
  pct_saida_sobre_entrada?: number | null;
}

export interface AcompanhamentoDiaResponse {
  items: AcompanhamentoMotoboyItem[];
  totais: AcompanhamentoTotais;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export interface AcompanhamentoSaidasDiaResponse {
  data: string;
  motoboy_id: number;
  motoboy_nome: string;
  pendentes_hoje: number;
  sum_shopee: number;
  sum_mercado: number;
  sum_avulso: number;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export type PeriodoParams = {
  data?: string;
  dataInicio?: string;
  dataFim?: string;
  /** pendentes = web; saidas = totais históricos por data da saída */
  modo?: "pendentes" | "saidas";
};

function buildPeriodoQuery(periodo?: PeriodoParams): Record<string, string | number> {
  if (!periodo) return {};
  const out: Record<string, string | number> = {};
  if (periodo.dataInicio && periodo.dataFim) {
    if (periodo.dataInicio === periodo.dataFim) {
      out.data = periodo.dataInicio;
    } else {
      out.data_inicio = periodo.dataInicio;
      out.data_fim = periodo.dataFim;
    }
  } else if (periodo.data) {
    out.data = periodo.data;
  }
  if (periodo.modo) out.modo = periodo.modo;
  return out;
}

export async function getAcompanhamentoSaidasDia(
  motoboyId: number,
  periodo: string | PeriodoParams
): Promise<AcompanhamentoSaidasDiaResponse> {
  const params =
    typeof periodo === "string"
      ? { motoboy_id: motoboyId, data: periodo }
      : { motoboy_id: motoboyId, ...buildPeriodoQuery(periodo) };
  const { data: res } = await client.get<AcompanhamentoSaidasDiaResponse>("/acompanhamento/saidas-dia", {
    params,
  });
  return res;
}

export async function getAcompanhamentoDia(
  dataOrPeriodo: string | PeriodoParams,
  motoboyId?: number
): Promise<AcompanhamentoDiaResponse> {
  const params: Record<string, string | number> =
    typeof dataOrPeriodo === "string"
      ? { data: dataOrPeriodo }
      : { ...buildPeriodoQuery(dataOrPeriodo) };
  if (motoboyId != null) params.motoboy_id = motoboyId;
  const { data: res } = await client.get<AcompanhamentoDiaResponse>("/acompanhamento/dia", { params });
  return {
    items: res.items ?? [],
    totais: res.totais ?? {
      pedidos: 0,
      entregues: 0,
      em_rota: 0,
      ausente_ou_ocorrencias: 0,
      sla: null,
      entrada_habilitada: false,
      entradas: null,
      saidas: null,
      pct_saida_sobre_entrada: null,
    },
    data_inicio: res.data_inicio,
    data_fim: res.data_fim,
  };
}
