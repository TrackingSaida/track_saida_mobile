import { apiClient as client } from "../../services/apiClient";

export type PedidoRecusadoItem = {
  id_saida: number;
  codigo?: string | null;
  codigo_exibicao?: string | null;
  servico?: string | null;
};

export type PedidosRecusadosResponse = {
  total: number;
  items: PedidoRecusadoItem[];
};

export async function listPedidosRecusados(): Promise<PedidosRecusadosResponse> {
  const { data } = await client.get<PedidosRecusadosResponse>("/mobile/pedidos-recusados");
  return {
    total: Number(data?.total ?? 0) || 0,
    items: Array.isArray(data?.items) ? data.items : [],
  };
}
