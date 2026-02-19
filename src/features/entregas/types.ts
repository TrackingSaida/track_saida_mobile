export interface EntregaListItem {
  id_saida: number;
  codigo: string | null;
  status: string;
  exibicao: string;
  servico?: string | null;
  cliente: string | null;
  bairro: string | null;
  endereco: string | null;
  contato: string | null;
  data: string | null;
  data_hora_entrega: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco_formatado?: string | null;
  endereco_origem?: string | null;
  possui_endereco?: boolean;
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

export interface ScanConflito {
  conflito: true;
  motoboy_atual: string;
  id_saida: number;
}
