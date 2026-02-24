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

export async function getEntregas(
  status: "pendente" | "finalizadas" | "ausentes",
  params?: { dia?: "hoje" }
): Promise<EntregaListItem[]> {
  const { data } = await client.get<EntregaListItem[]>("/mobile/entregas", {
    params: { status, ...params },
  });
  return data;
}

export async function getEntrega(idSaida: number): Promise<EntregaListItem> {
  const { data } = await client.get<EntregaListItem>(`/mobile/entrega/${idSaida}`);
  return data;
}

export async function iniciarRota(deliveryIds?: number[]): Promise<{ atualizados: number }> {
  const body = deliveryIds?.length ? { delivery_ids: deliveryIds } : {};
  const { data } = await client.post<{ atualizados: number }>("/mobile/iniciar-rota", body);
  return data;
}

export interface EntregueBody {
  tipo_recebedor?: string | null;
  nome_recebedor?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  observacao_entrega?: string | null;
}

export async function marcarEntregue(idSaida: number, body?: EntregueBody): Promise<void> {
  await client.post(`/mobile/entrega/${idSaida}/entregue`, body ?? {});
}

export async function marcarAusente(idSaida: number, motivoId: number, observacao?: string): Promise<void> {
  await client.post(`/mobile/entrega/${idSaida}/ausente`, { motivo_id: motivoId, observacao: observacao || null });
}

export async function getMotivosAusencia(): Promise<MotivoAusencia[]> {
  const { data } = await client.get<MotivoAusencia[]>("/mobile/motivos-ausencia");
  return data;
}

export interface EnderecoBody {
  destinatario: string;
  rua: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude?: number | null;
  longitude?: number | null;
  origem?: "manual" | "ocr" | "voz";
}

export async function putEndereco(idSaida: number, body: EnderecoBody): Promise<EntregaListItem> {
  const { data } = await client.put<EntregaListItem>(`/mobile/entrega/${idSaida}/endereco`, body);
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

export async function desatribuirEntrega(idSaida: number): Promise<void> {
  await client.post(`/mobile/entrega/${idSaida}/desatribuir`);
}

export async function postNovaTentativa(idSaida: number): Promise<{ tentativa: number }> {
  const { data } = await client.post<{ ok: boolean; id_saida: number; tentativa: number }>(
    `/mobile/entrega/${idSaida}/nova-tentativa`
  );
  return { tentativa: data.tentativa };
}

// --- Rotas ativas persistidas ---

export interface RotasAtivaResponse {
  rota_id: string;
  ordem: number[];
  parada_atual: number;
  data?: string;
}

export async function postRotasIniciar(ordem: number[]): Promise<{ rota_id: string }> {
  const { data } = await client.post<{ rota_id: string }>("/mobile/rotas/iniciar", { ordem });
  return data;
}

export async function getRotasAtiva(): Promise<RotasAtivaResponse | null> {
  const { data } = await client.get<RotasAtivaResponse | null>("/mobile/rotas/ativa");
  return data ?? null;
}

export async function postRotasAvancar(rotaId: string): Promise<{ parada_atual: number }> {
  const { data } = await client.post<{ parada_atual: number }>(`/mobile/rotas/${rotaId}/avancar`);
  return data;
}

export async function postRotasFinalizar(rotaId: string): Promise<void> {
  await client.post(`/mobile/rotas/${rotaId}/finalizar`);
}
