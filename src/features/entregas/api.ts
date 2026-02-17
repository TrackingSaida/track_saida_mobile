import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuthStore } from "../../store/authStore";
import type {
  EntregaListItem,
  ResumoEntregas,
  MotivoAusencia,
  ScanConflito,
} from "./types";

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  Object.assign(config.headers, getAuthHeaders());
  return config;
});

export async function getResumoEntregas(): Promise<ResumoEntregas> {
  const { data } = await client.get<ResumoEntregas>("/mobile/entregas/resumo");
  return data;
}

export async function getEntregas(status: "pendente" | "finalizadas" | "ausentes"): Promise<EntregaListItem[]> {
  const { data } = await client.get<EntregaListItem[]>("/mobile/entregas", {
    params: { status },
  });
  return data;
}

export async function getEntrega(idSaida: number): Promise<EntregaListItem> {
  const { data } = await client.get<EntregaListItem>(`/mobile/entrega/${idSaida}`);
  return data;
}

export async function iniciarRota(): Promise<{ atualizados: number }> {
  const { data } = await client.post<{ atualizados: number }>("/mobile/iniciar-rota");
  return data;
}

export async function marcarEntregue(idSaida: number): Promise<void> {
  await client.post(`/mobile/entrega/${idSaida}/entregue`);
}

export async function marcarAusente(idSaida: number, motivoId: number, observacao?: string): Promise<void> {
  await client.post(`/mobile/entrega/${idSaida}/ausente`, { motivo_id: motivoId, observacao: observacao || null });
}

export async function getMotivosAusencia(): Promise<MotivoAusencia[]> {
  const { data } = await client.get<MotivoAusencia[]>("/mobile/motivos-ausencia");
  return data;
}

export interface ScanSuccess {
  ok: true;
  conflito: false;
  entrega: EntregaListItem;
}

export interface ScanConflict {
  conflito: true;
  motoboy_atual: string;
  id_saida: number;
}

export async function scanCodigo(codigo: string): Promise<ScanSuccess | ScanConflict> {
  try {
    const { data } = await client.post<ScanSuccess>("/mobile/scan", { codigo });
    return data;
  } catch (err) {
    const ax = err as AxiosError<ScanConflict>;
    if (ax.response?.status === 409 && ax.response?.data?.conflito) {
      return ax.response.data;
    }
    throw err;
  }
}

export async function assumirEntrega(idSaida: number): Promise<void> {
  await client.post(`/mobile/entrega/${idSaida}/assumir`);
}
