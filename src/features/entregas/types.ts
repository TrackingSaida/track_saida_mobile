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
  tem_comprovante?: boolean;
  tipo_recebedor?: string | null;
  nome_recebedor?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  observacao_entrega?: string | null;
  observacao_ocorrencia?: string | null;
  campos_obrigatorios?: string[];
  campos_obrigatorios_entregue?: string[];
  campos_obrigatorios_ausente?: string[];
}

export interface ResumoEntregas {
  pendentes: number;
  finalizadas_hoje: number;
  ausentes_hoje?: number;
  total_finalizado_hoje?: number;
  pode_iniciar_rota: boolean;
  ausentes?: number;
  atraso_d1?: number;
}

export interface MotivoAusencia {
  id: number;
  descricao: string;
}

export type ExtratoStatusFiltro = "todos" | "grupo_entregue" | "cancelados";

export interface ExtratoPedidoItem {
  id_saida: number;
  codigo: string | null;
  status: string;
  exibicao: string;
  servico: string;
}

export interface ExtratoDiaItem {
  data: string;
  total_pacotes_associados: number;
  total_pacotes_filtrados: number;
  valor_dia: string;
  itens: ExtratoPedidoItem[];
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
