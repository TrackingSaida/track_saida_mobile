import { apiClient as client } from "../../services/apiClient";

export type ConferenciaAba = "pendente" | "reconferir" | "conferida";

export interface ConferenciaItem {
  id: number;
  motoboy_id: number;
  motoboy_nome: string;
  data_ref: string;
  status: string;
  qtd_no_momento?: number | null;
  conferido_em?: string | null;
  ultima_abertura_em?: string | null;
}

export interface ConferenciaDetalhe {
  motoboy_id: number;
  motoboy_nome: string;
  data_ref: string;
  status: string;
  sum_shopee: number;
  sum_mercado: number;
  sum_avulso: number;
  total: number;
  qtd_no_momento?: number | null;
  conferido_em?: string | null;
}

export async function listarConferencias(params: {
  dataInicio: string;
  dataFim: string;
  aba: ConferenciaAba;
  motoboyId?: number;
}): Promise<ConferenciaItem[]> {
  const { data } = await client.get<{ items: ConferenciaItem[]; total: number }>(
    "/conferencias-saida",
    {
      params: {
        data_inicio: params.dataInicio,
        data_fim: params.dataFim,
        aba: params.aba,
        ...(params.motoboyId != null ? { motoboy_id: params.motoboyId } : {}),
      },
    }
  );
  return Array.isArray(data?.items) ? data.items : [];
}

export async function getConferenciaDetalhe(
  motoboyId: number,
  dataRef: string
): Promise<ConferenciaDetalhe> {
  const { data } = await client.get<ConferenciaDetalhe>(`/conferencias-saida/${motoboyId}`, {
    params: { data_ref: dataRef },
  });
  return data;
}

export async function conferirSaidaMotoboy(
  motoboyId: number,
  dataRef: string
): Promise<ConferenciaDetalhe> {
  const { data } = await client.post<ConferenciaDetalhe>(
    `/conferencias-saida/${motoboyId}/conferir`,
    { data_ref: dataRef }
  );
  return data;
}
