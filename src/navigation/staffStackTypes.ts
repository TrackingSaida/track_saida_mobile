export type ConferenciaSaidaParams =
  | {
      initialAba?: "pendente" | "reconferir" | "conferida";
      motoboyId?: number;
      dataRef?: string;
    }
  | undefined;

export type AcompanharMotoboyDiaParams = {
  motoboyId: number;
  motoboyNome: string;
  data: string;
  pedidos?: number;
  entregues?: number;
  emRota?: number;
  ocorrencias?: number;
  sla?: number | null;
};

export type InicioStackParamList = {
  StaffInicio: undefined;
  ConsultaCodigos:
    | {
        status?: string;
        de?: string;
        ate?: string;
        /** Códigos da sessão de leitura (lista fechada). */
        codigos?: string[];
        /** Rótulo operacional, ex.: "Não coletados desta leitura". */
        origemSessao?: string;
      }
    | undefined;
};

/** Rotas compartilhadas do fluxo de coletas (Home motoboy + Operação staff). */
export type ColetasFluxoParamList = {
  LeituraColetas:
    | {
        baseId?: number;
        baseNome?: string;
        /** YYYY-MM-DD; omitido = dia atual. Retroativo: admin/operador. */
        dataOperacao?: string;
      }
    | undefined;
  LeiturasColeta: {
    baseId: number;
    baseNome: string;
    dataOperacao?: string;
  };
  ConsultarColetas: undefined;
};

export type OperacaoStackParamList = {
  StaffOperacao: undefined;
  LeituraSaidas: { resumeAvulso?: boolean } | undefined;
  LeituraEntradas: undefined;
  ConferenciaSaida: ConferenciaSaidaParams;
  SaidasPorMotoboy: undefined;
} & ColetasFluxoParamList;

export type GestaoStackParamList = {
  StaffGestao: undefined;
  IndicadoresOperacao: undefined;
  AcompanharOperacao: undefined;
  AcompanharMotoboyDia: AcompanharMotoboyDiaParams;
};

/** União das rotas staff (telas internas que ainda tipam neste contrato). */
export type StaffStackParamList = InicioStackParamList &
  OperacaoStackParamList &
  GestaoStackParamList;
