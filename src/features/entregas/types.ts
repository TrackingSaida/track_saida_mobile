export type CoordPrecision = "rooftop" | "street" | "approx";

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
  cidade?: string | null;
  estado?: string | null;
  contato: string | null;
  data: string | null;
  data_hora_entrega: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco_formatado?: string | null;
  endereco_origem?: string | null;
  coord_precision?: CoordPrecision | null;
  geocode_source?: string | null;
  geocode_score?: number | null;
  geocoded_at?: string | null;
  possui_endereco?: boolean;
  tentativa?: number | null;
  tem_comprovante?: boolean;
  tipo_recebedor?: string | null;
  nome_recebedor?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  observacao_entrega?: string | null;
  observacao_ocorrencia?: string | null;
  motivo_ocorrencia?: string | null;
  complemento?: string | null;
  data_hora_ocorrencia?: string | null;
  campos_obrigatorios?: string[];
  campos_obrigatorios_entregue?: string[];
  campos_obrigatorios_ausente?: string[];
}

export type EntregasListInitialTab = "pendente" | "finalizadas" | "ausentes";

export type FinalizadasFiltros = { entregue: boolean; cancelado: boolean };

export const FINALIZADAS_FILTROS_PADRAO: FinalizadasFiltros = {
  entregue: true,
  cancelado: false,
};

export interface ResumoEntregas {
  pendentes: number;
  finalizadas_hoje: number;
  ausentes_hoje?: number;
  total_finalizado_hoje?: number;
  pode_iniciar_rota: boolean;
  ausentes?: number;
  atraso_d1?: number;
  valor_finalizado_hoje?: string | number;
}

export interface MarcacaoEntregaResponse {
  ok: boolean;
  id_saida: number;
  entrega_atrasada?: boolean;
  data_operacional?: string;
  complemento?: boolean;
  rota_sync?: RotaSyncInfo;
}

export interface RotaSyncInfo {
  in_active_route: boolean;
  rota_finalizada: boolean;
  rota_id?: string | null;
  parada_atual?: number | null;
  ordem?: number[] | null;
}

export interface RotasResumo {
  rota_id: number;
  paradas: number;
  pedidos: number;
  entregues: number;
  ausentes: number;
  pendentes: number;
  valor_total: string | number;
}

export interface MotivoAusencia {
  id: number;
  descricao: string;
}

export type FinalizarLoteAcao = "entregue" | "ausente";

/** Limite do backend em POST /mobile/entregas/finalizar-lote */
export const FINALIZAR_LOTE_MAX_IDS = 50;

export interface FinalizarLoteBody {
  ids: number[];
  acao: FinalizarLoteAcao;
  motivo_id?: number;
  observacao?: string;
}

export interface FinalizarLoteItemOut {
  id_saida: number;
  status: string;
}

export interface FinalizarLoteBloqueadoOut {
  id_saida: number;
  codigo: string | null;
  motivo: string;
}

export interface FinalizarLoteErroOut {
  id_saida: number;
  mensagem: string;
}

export interface FinalizarLoteResponse {
  finalizados: FinalizarLoteItemOut[];
  bloqueados: FinalizarLoteBloqueadoOut[];
  erros: FinalizarLoteErroOut[];
  rota_sync?: RotaSyncInfo | null;
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

export interface EnderecoSugestoesHints {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export interface EnderecoSugestoesBody {
  query: string;
  latitude?: number;
  longitude?: number;
  hints?: EnderecoSugestoesHints;
  limit?: number;
  session_token?: string;
  allow_google_fallback?: boolean;
  google_fallback_reason?: "user_requested" | "timeout" | "auto" | "no_results";
}

export interface EnderecoSugestaoApi {
  label: string;
  rua: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  latitude: number;
  longitude: number;
  score: number;
  confidence?: number;
  source: string;
  distance_km?: number | null;
  distance_meters?: number | null;
  badge?: string | null;
  already_used?: boolean;
  main_text?: string | null;
  secondary_text?: string | null;
  place_id?: string | null;
  requires_place_details?: boolean;
}

export interface EnderecoSugestoesResponse {
  suggestions: EnderecoSugestaoApi[];
  did_you_mean?: {
    original_query: string;
    suggestion: EnderecoSugestaoApi;
  } | null;
  used_google?: boolean;
}

export interface PlaceDetailsBody {
  place_id: string;
  session_token?: string;
  query?: string;
  latitude?: number;
  longitude?: number;
  hints?: EnderecoSugestoesHints;
}

export interface PlaceDetailsResponse {
  suggestion: EnderecoSugestaoApi | null;
}
