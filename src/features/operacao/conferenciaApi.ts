import { apiClient as client } from "../../services/apiClient";

export type ConferenciaAba = "pendente" | "reconferir" | "conferida";

export interface ConferenciaItem {
  id: number;
  sessao_id?: number | null;
  motoboy_id: number;
  motoboy_nome: string;
  data_ref: string;
  status: string;
  qtd_no_momento?: number | null;
  conferido_em?: string | null;
  ultima_abertura_em?: string | null;
  /** Pacotes sem evento de conferência (aba Reconferir). */
  novos_qtd?: number | null;
}

export interface PacoteNovoConferencia {
  codigo: string;
  servico: string;
}

export interface ConferenciaDetalhe {
  sessao_id?: number | null;
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
  novos_qtd?: number;
  novos_shopee?: number;
  novos_mercado?: number;
  novos_avulso?: number;
  novos_pacotes?: PacoteNovoConferencia[];
  snapshot_total?: number | null;
  snapshot_shopee?: number | null;
  snapshot_ml?: number | null;
  snapshot_avulso?: number | null;
  operacional_total?: number | null;
  operacional_shopee?: number | null;
  operacional_ml?: number | null;
  operacional_avulso?: number | null;
}

export type ConferenciaTotaisAbas = Record<ConferenciaAba, number>;

const ABAS_CONFERENCIA: ConferenciaAba[] = ["pendente", "reconferir", "conferida"];

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

/** Totais por aba no período (para chips Pendentes (N) | Reconferir (N) | Concluídas (N)). */
export async function getConferenciaTotaisAbas(params: {
  dataInicio: string;
  dataFim: string;
  motoboyId?: number;
}): Promise<ConferenciaTotaisAbas> {
  const results = await Promise.all(
    ABAS_CONFERENCIA.map(async (aba) => {
      const { data } = await client.get<{ items: ConferenciaItem[]; total: number }>(
        "/conferencias-saida",
        {
          params: {
            data_inicio: params.dataInicio,
            data_fim: params.dataFim,
            aba,
            ...(params.motoboyId != null ? { motoboy_id: params.motoboyId } : {}),
          },
        }
      );
      const total =
        typeof data?.total === "number"
          ? data.total
          : Array.isArray(data?.items)
            ? data.items.length
            : 0;
      return [aba, total] as const;
    })
  );
  return {
    pendente: 0,
    reconferir: 0,
    conferida: 0,
    ...Object.fromEntries(results),
  };
}

export async function getConferenciaDetalhe(
  motoboyId: number,
  dataRef: string,
  sessaoId?: number | null
): Promise<ConferenciaDetalhe> {
  if (sessaoId != null) {
    const { data } = await client.get<ConferenciaDetalhe>(
      `/conferencias-saida/sessoes/${sessaoId}`
    );
    return data;
  }
  const { data } = await client.get<ConferenciaDetalhe>(`/conferencias-saida/${motoboyId}`, {
    params: { data_ref: dataRef },
  });
  return data;
}

export async function conferirSaidaMotoboy(
  motoboyId: number,
  dataRef: string,
  sessaoId?: number | null
): Promise<ConferenciaDetalhe> {
  if (sessaoId != null) {
    const { data } = await client.post<ConferenciaDetalhe>(
      `/conferencias-saida/sessoes/${sessaoId}/conferir`
    );
    return data;
  }
  const { data } = await client.post<ConferenciaDetalhe>(
    `/conferencias-saida/${motoboyId}/conferir`,
    { data_ref: dataRef }
  );
  return data;
}

export interface ConfirmarLeituraResult {
  motoboy_id: number;
  motoboy_nome: string;
  data_ref: string;
  status: string;
  qtd_no_momento: number;
  sum_shopee: number;
  sum_mercado: number;
  sum_avulso: number;
  total: number;
  virou_reconferir: boolean;
  sessao_id?: number | null;
  sessao_status?: string | null;
  sessao_total?: number | null;
  fluxo_confirmacao_ativo?: boolean;
}

export interface SessaoAbertaStaff {
  fluxo_confirmacao_ativo: boolean;
  sessao_id?: number | null;
  sessao_status?: string | null;
  sessao_total: number;
  versao?: number | null;
  saida_ids: number[];
}

export async function recuperarSessaoAbertaStaff(motoboyId: number): Promise<SessaoAbertaStaff> {
  const { data } = await client.get<SessaoAbertaStaff>(
    `/conferencias-saida/sessao-aberta/${motoboyId}`
  );
  return data;
}

/** Staff: confirma leitura do dia e upsert em conferencia_saida (sem iniciar rota). */
export async function confirmarLeituraStaff(params: {
  motoboyId: number;
  dataRef: string;
  qtd?: number;
  sessaoId?: number | null;
  versao?: number | null;
}): Promise<ConfirmarLeituraResult> {
  const { data } = await client.post<ConfirmarLeituraResult>(
    "/conferencias-saida/confirmar-leitura",
    {
      motoboy_id: params.motoboyId,
      data_ref: params.dataRef,
      ...(params.qtd != null ? { qtd: params.qtd } : {}),
      ...(params.sessaoId != null ? { sessao_id: params.sessaoId } : {}),
      ...(params.versao != null ? { versao: params.versao } : {}),
    }
  );
  return data;
}
