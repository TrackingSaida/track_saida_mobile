export type StaffStackParamList = {
  StaffHome: undefined;
  LeituraSaidas: undefined;
  LeituraColetas: undefined;
  MinhasColetas: undefined;
  LeituraEntradas: undefined;
  ConferenciaSaida:
    | {
        initialAba?: "pendente" | "reconferir" | "conferida";
        motoboyId?: number;
        dataRef?: string;
      }
    | undefined;
  EnviarAviso: undefined;
  ConsultaCodigos: undefined;
  /** Quantidades por serviço (Shopee/ML/Avulso) — conceito distinto do acompanhamento de baixas. */
  SaidasPorMotoboy: undefined;
  IndicadoresOperacao: undefined;
  AcompanharOperacao: undefined;
  AcompanharMotoboyDia: {
    motoboyId: number;
    motoboyNome: string;
    data: string;
    pedidos?: number;
    entregues?: number;
    emRota?: number;
    ocorrencias?: number;
    sla?: number | null;
  };
};
