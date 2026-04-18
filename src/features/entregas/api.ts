import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuthStore } from "../../store/authStore";
import type {
  EntregaListItem,
  ResumoEntregas,
  MotivoAusencia,
  ScanConflito,
  ExtratoFinanceiro,
  ExtratoStatusFiltro,
} from "./types";

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

export async function getResumoEntregas(): Promise<ResumoEntregas> {
  const dataHoje = getTodayISO();
  const { data } = await client.get<ResumoEntregas>("/mobile/entregas/resumo", {
    params: { data: dataHoje },
  });
  return data;
}

/** Data de hoje no fuso LOCAL do dispositivo (YYYY-MM-DD) para filtrar por "hoje". */
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getEntregas(
  status: "pendente" | "finalizadas" | "ausentes",
  params?: { dia?: "hoje"; data?: string }
): Promise<EntregaListItem[]> {
  const dataHoje = getTodayISO();
  const useHoje = params?.dia === "hoje";
  const query: Record<string, string | number> = {
    status,
    _: Date.now(), // evita cache
  };
  if (useHoje) {
    query.dia = "hoje";
    query.data = params?.data ?? dataHoje;
  }
  const { data } = await client.get<EntregaListItem[]>("/mobile/entregas", {
    params: query,
  });
  return data;
}

export async function getExtratoFinanceiro(params?: {
  data_inicio?: string;
  data_fim?: string;
  status_filtro?: ExtratoStatusFiltro;
}): Promise<ExtratoFinanceiro> {
  const { data } = await client.get<ExtratoFinanceiro>("/mobile/entregas/extrato", {
    params: {
      data_inicio: params?.data_inicio,
      data_fim: params?.data_fim,
      status_filtro: params?.status_filtro ?? "grupo_entregue",
    },
  });
  return {
    ...data,
    dias: (data.dias ?? []).map((d) => ({
      ...d,
      itens: d.itens ?? [],
    })),
  };
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

export interface PresignUploadResponse {
  upload_url: string;
  object_key: string;
  headers: { "Content-Type"?: string };
}

export async function getPresignUpload(params: {
  filename: string;
  id_saida: number;
  tipo: "entregue" | "ausente";
  content_type: string;
}): Promise<PresignUploadResponse> {
  const { data } = await client.post<PresignUploadResponse>("/upload/presign", params);
  return data;
}

export async function patchFotoSaida(
  idSaida: number,
  fotoUrl: string,
  status: "entregue" | "ausente"
): Promise<void> {
  await client.patch(`/saidas/${idSaida}/foto`, { foto_url: fotoUrl, status });
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
  ja_existia?: boolean;
  entrega: EntregaListItem;
}

export interface ScanConflict {
  conflito: true;
  motoboy_atual: string;
  id_saida: number;
}

/**
 * Envia para /mobile/scan o valor bruto lido do scanner quando disponível.
 * O backend faz normalize_codigo(...) e extrai codigo/servico/qr_payload_raw.
 */
export async function scanCodigo(
  codigoBrutoOuNormalizado: string,
  origem: "camera" | "manual" = "camera"
): Promise<ScanSuccess | ScanConflict> {
  try {
    const { data } = await client.post<ScanSuccess>("/mobile/scan", {
      codigo: codigoBrutoOuNormalizado,
      origem,
    });
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

export async function removerEntrega(idSaida: number): Promise<void> {
  await client.delete(`/mobile/entrega/${idSaida}`);
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

export async function getRotasAtiva(dataHoje?: string): Promise<RotasAtivaResponse | null> {
  const params: Record<string, string | number> = { _: Date.now() };
  if (dataHoje) params.data = dataHoje;
  const { data } = await client.get<RotasAtivaResponse | null>("/mobile/rotas/ativa", { params });
  return data ?? null;
}

export async function postRotasAvancar(rotaId: string): Promise<{ parada_atual: number }> {
  const { data } = await client.post<{ parada_atual: number }>(`/mobile/rotas/${rotaId}/avancar`);
  return data;
}

export async function postRotasFinalizar(rotaId: string): Promise<void> {
  await client.post(`/mobile/rotas/${rotaId}/finalizar`);
}
