import { apiClient } from "../../services/apiClient";

export type FechamentoServicoResumo = {
  feitos: number;
  cancelados: number;
  valor_feitos: number | string;
  valor_cancelados: number | string;
};

export type FechamentoResumo = {
  feitos: number;
  cancelados: number;
  pacotes_grandes: number;
  valor_bruto: number | string;
  valor_cancelados: number | string;
  ajustes: number | string;
  por_servico: {
    shopee: FechamentoServicoResumo;
    flex: FechamentoServicoResumo;
    avulso: FechamentoServicoResumo;
  };
};

export type FechamentoConferenciaDia = {
  data: string;
  conferido: boolean;
  label: string;
};

export type FechamentoConferencia = {
  habilitada: boolean;
  dias: FechamentoConferenciaDia[];
};

export type FechamentoItem = {
  id_fechamento: number;
  codigo: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_base: number | string;
  valor_entregas?: number | string;
  valor_coletas?: number | string;
  qtd_dias_coleta?: number;
  faz_coleta?: boolean;
  valor_adicao: number | string;
  valor_subtracao: number | string;
  valor_final: number | string;
  motivo_adicao?: string | null;
  motivo_subtracao?: string | null;
  status: string;
  chave_pix?: string | null;
  criado_em?: string | null;
  tem_pdf: boolean;
  resumo?: FechamentoResumo | null;
  conferencia?: FechamentoConferencia | null;
};

export async function listFechamentos(): Promise<FechamentoItem[]> {
  const { data } = await apiClient.get<FechamentoItem[]>("/mobile/fechamentos");
  return data || [];
}

export async function getFechamento(id: number): Promise<FechamentoItem> {
  const { data } = await apiClient.get<FechamentoItem>(`/mobile/fechamentos/${id}`);
  return data;
}
