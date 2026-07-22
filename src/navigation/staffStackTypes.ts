export type StaffStackParamList = {
  StaffHome: undefined;
  LeituraSaidas: undefined;
  LeituraColetas: undefined;
  ConsultaCodigos: undefined;
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
