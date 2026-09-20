import type { NavigatorScreenParams } from "@react-navigation/native";
import type { EntregasListInitialTab } from "../features/entregas/types";

export type { EntregasListInitialTab };

export type MotoboyEntregasTabParams =
  | {
      initialTab?: EntregasListInitialTab;
      todosPendentes?: boolean;
      initialMapMode?: "map";
    }
  | undefined;

export type MotoboyTabParamList = {
  Inicio: undefined;
  Entregas: MotoboyEntregasTabParams;
  Escanear: undefined;
  Rotas: undefined;
  Mais: undefined;
};

export type MotoboyRootStackParamList = {
  Tabs: NavigatorScreenParams<MotoboyTabParamList> | undefined;
  Scan: { resumeAvulso?: boolean } | undefined;
  DeliverScan: undefined;
  PrepareDeliveries: undefined;
  RouteBuilder:
    | {
        openLocatePackage?: boolean;
        openSeparation?: boolean;
        highlightLocatePackage?: boolean;
        pendingAddToRoute?: number;
      }
    | undefined;
  RotasHistorico: undefined;
  DevolverPacotes: { resume?: boolean } | undefined;
  LeituraColetas: { baseId?: number; baseNome?: string } | undefined;
  LeiturasColeta: {
    baseId: number;
    baseNome: string;
    dataOperacao?: string;
  };
  ConsultarColetas: undefined;
  EntregaDetail: { idSaida: number; resumeKind?: "entregue" | "ausente" };
  ResumoDetalhe: undefined;
  MeusDados: undefined;
  Configuracoes: undefined;
  Privacidade: undefined;
  SobreRotevo: undefined;
  EnviarAviso: undefined;
  MinhasEntregas: { presetPeriodoHoje?: true } | undefined;
  MinhasEntregasDia: { data: string };
  MeusFechamentos: undefined;
  FechamentoDetail: { idFechamento: number };
  Avisos: undefined;
  AvisoDetail: {
    avisoId: number;
    titulo?: string;
    mensagem?: string;
    prioridade?: string;
  };
};

/** Contrato das telas profundas do motoboy (compatível com imports existentes). */
export type RootStackParamList = MotoboyRootStackParamList;
