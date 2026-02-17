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
}

export interface ResumoEntregas {
  pendentes: number;
  finalizadas_hoje: number;
  pode_iniciar_rota: boolean;
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
