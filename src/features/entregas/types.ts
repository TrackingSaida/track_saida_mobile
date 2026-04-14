export interface EntregaListItem {
  id_saida: number;
  codigo: string | null;
  status: string;
  exibicao: string;
  servico?: string | null;
  cliente: string | null;
  bairro: string | null;
  endereco: string | null;
  numero?: string | null;
  cep?: string | null;
  contato: string | null;
  data: string | null;
  data_hora_entrega: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco_formatado?: string | null;
  endereco_origem?: string | null;
  possui_endereco?: boolean;
  tentativa?: number | null;
}

export interface ResumoEntregas {
  pendentes: number;
  finalizadas_hoje: number;
  pode_iniciar_rota: boolean;
  ausentes?: number;
  atraso_d1?: number;
}

export interface MotivoAusencia {
  id: number;
  descricao: string;
}

export type ExtratoStatusFiltro = "todos" | "grupo_entregue";

export interface ExtratoDiaItem {
  data: string;
  total_pacotes_associados: number;
  total_pacotes_filtrados: number;
  valor_dia: string;
}

export interface ExtratoFinanceiro {
  periodo_inicio: string;
  periodo_fim: string;
  status_filtro: ExtratoStatusFiltro;
  valor_a_receber: string;
  total_pacotes_associados: number;
  total_pacotes_filtrados: number;
  total_cancelados: number;
  resumo_por_servico: {
    shopee: number;
    flex: number;
    avulso: number;
  };
  dias: ExtratoDiaItem[];
}

export interface ScanConflito {
  conflito: true;
  motoboy_atual: string;
  id_saida: number;
}
