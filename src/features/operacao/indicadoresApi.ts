import { apiClient as client } from "../../services/apiClient";

export type MarketplaceNome = "Shopee" | "Mercado Livre" | "Avulso";

export interface DashboardMarketplaceItem {
  nome: MarketplaceNome | string;
  qty: number;
  valor?: number | string;
  pct?: number;
}

export interface DashboardSaidasResponse {
  cards: {
    total_saidas: number;
    custo_total?: number | string;
    custo_medio?: number | string;
    entregadores_ativos?: number;
    cancelamentos?: number;
    taxa_cancelamento?: number;
  };
  por_marketplace: DashboardMarketplaceItem[];
  entrada_habilitada?: boolean;
  entrada?: {
    total_entradas: number;
    ainda_na_base: number;
    ainda_na_base_detalhe?: Array<{ date: string; qty: number }>;
    ainda_na_base_por_marketplace?: DashboardMarketplaceItem[];
    total_saidas: number;
    taxa_saida_pct?: number;
    gap_entrada_saida?: number;
    por_marketplace: DashboardMarketplaceItem[];
  } | null;
}

export interface DashboardColetasResponse {
  cards: {
    total_coletas: number;
    shopee?: number;
    mercado_livre?: number;
    avulso?: number;
    cancelados?: number;
  };
  por_marketplace?: DashboardMarketplaceItem[];
}

export async function getDashboardSaidasPeriodo(
  dataInicio: string,
  dataFim: string
): Promise<DashboardSaidasResponse> {
  const { data } = await client.get<DashboardSaidasResponse>("/dashboard/saidas", {
    params: {
      data_inicio: dataInicio,
      data_fim: dataFim,
      modo_entregas: "operacional",
    },
  });
  return data;
}

export async function getDashboardColetasPeriodo(
  dataInicio: string,
  dataFim: string
): Promise<DashboardColetasResponse> {
  const { data } = await client.get<DashboardColetasResponse>("/dashboard/coletas", {
    params: {
      data_inicio: dataInicio,
      data_fim: dataFim,
    },
  });
  return data;
}
