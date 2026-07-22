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
}

export interface AcompanhamentoTotais {
  pedidos: number;
  entregues: number;
  em_rota: number;
  ausente_ou_ocorrencias: number;
  sla?: number | null;
}

export interface AcompanhamentoDiaResponse {
  items: AcompanhamentoMotoboyItem[];
  totais: AcompanhamentoTotais;
}

export interface AcompanhamentoSaidasDiaResponse {
  data: string;
  motoboy_id: number;
  motoboy_nome: string;
  pendentes_hoje: number;
  sum_shopee: number;
  sum_mercado: number;
  sum_avulso: number;
}

export async function getAcompanhamentoSaidasDia(
  motoboyId: number,
  data: string
): Promise<AcompanhamentoSaidasDiaResponse> {
  const { data: res } = await client.get<AcompanhamentoSaidasDiaResponse>("/acompanhamento/saidas-dia", {
    params: { motoboy_id: motoboyId, data },
  });
  return res;
}

export async function getAcompanhamentoDia(
  data: string,
  motoboyId?: number
): Promise<AcompanhamentoDiaResponse> {
  const params: Record<string, string | number> = { data };
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
    },
  };
}
