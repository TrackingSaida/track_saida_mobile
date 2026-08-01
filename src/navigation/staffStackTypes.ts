export type StaffStackParamList = {
  StaffHome: undefined;
  LeituraSaidas: undefined;
  LeituraColetas: undefined;
  LeituraEntradas: undefined;
  ConferenciaSaida: undefined;
  ConsultaCodigos: undefined;
  /** Quantidades por serviço (Shopee/ML/Avulso) — conceito distinto do acompanhamento de baixas. */
  SaidasPorMotoboy: undefined;
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
