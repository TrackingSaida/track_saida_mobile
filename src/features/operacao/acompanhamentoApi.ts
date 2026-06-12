import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuthStore } from "../../store/authStore";

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
  },
});

client.interceptors.request.use((config) => {
  Object.assign(config.headers, getAuthHeaders());
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export interface AcompanhamentoMotoboyItem {
  data: string;
  motoboy_id: number;
  motoboy_nome: string;
  pedidos: number;
  entregues: number;
  em_rota: number;
  ausente_ou_ocorrencias: number;
  rota?: string | null;
  distancia_tempo?: string | null;
  ultima_entrega?: string | null;
  sla?: number | null;
}

export interface AcompanhamentoTotais {
  pedidos: number;
  entregues: number;
  em_rota: number;
  ausente_ou_ocorrencias: number;
  sla?: number | null;
}

export interface AcompanhamentoDiaResponse {
  items: AcompanhamentoMotoboyItem[];
  totais: AcompanhamentoTotais;
}

export async function getAcompanhamentoDia(
  data: string,
  motoboyId?: number
): Promise<AcompanhamentoDiaResponse> {
  const params: Record<string, string | number> = { data };
  if (motoboyId != null) params.motoboy_id = motoboyId;
  const { data: res } = await client.get<AcompanhamentoDiaResponse>("/acompanhamento/dia", { params });
  return {
    items: res.items ?? [],
    totais: res.totais ?? {
      pedidos: 0,
      entregues: 0,
      em_rota: 0,
      ausente_ou_ocorrencias: 0,
      sla: null,
    },
  };
}
