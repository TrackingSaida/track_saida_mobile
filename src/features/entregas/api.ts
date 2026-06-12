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
  MarcacaoEntregaResponse,
  RotasResumo,
  FinalizarLoteBody,
  FinalizarLoteResponse,
  EnderecoSugestoesBody,
  EnderecoSugestoesResponse,
  PlaceDetailsBody,
  PlaceDetailsResponse,
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

export type FinalizadasSubtipo = "entregue" | "cancelado";

export type FinalizadasListParams = { dia?: "hoje"; data?: string };

function sortEntregasDesc(items: EntregaListItem[]): EntregaListItem[] {
  return [...items].sort((a, b) => {
    const da = String(a.data_hora_entrega || a.data || "");
    const db = String(b.data_hora_entrega || b.data || "");
    return db.localeCompare(da);
  });
}

/** Lista finalizadas conforme filtros independentes (entregue / cancelado). */
export async function fetchFinalizadasFiltradas(
  params: FinalizadasListParams | undefined,
  filtros: { entregue: boolean; cancelado: boolean }
): Promise<EntregaListItem[]> {
  const { entregue, cancelado } = filtros;
  if (entregue && cancelado) {
    const [entregues, cancelados] = await Promise.all([
      getEntregas("finalizadas", { ...params, subtipo: "entregue" }),
      getEntregas("finalizadas", { ...params, subtipo: "cancelado" }),
    ]);
    const byId = new Map<number, EntregaListItem>();
    [...entregues, ...cancelados].forEach((d) => byId.set(d.id_saida, d));
    return sortEntregasDesc(Array.from(byId.values()));
  }
  if (entregue) return getEntregas("finalizadas", { ...params, subtipo: "entregue" });
  if (cancelado) return getEntregas("finalizadas", { ...params, subtipo: "cancelado" });
  return [];
}

export async function getEntregas(
  status: "pendente" | "finalizadas" | "ausentes",
  params?: { dia?: "hoje"; data?: string; subtipo?: FinalizadasSubtipo }
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
  if (status === "finalizadas" && params?.subtipo) {
    query.subtipo = params.subtipo;
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

export interface CamposObrigatoriosValidationError {
  code?: string;
  campos_faltantes?: string[];
  message?: string;
}

export async function marcarEntregue(
  idSaida: number,
  body?: EntregueBody
): Promise<MarcacaoEntregaResponse> {
  const { data } = await client.post<MarcacaoEntregaResponse>(
    `/mobile/entrega/${idSaida}/entregue`,
    body ?? {}
  );
  return data;
}

export async function marcarAusente(
  idSaida: number,
  motivoId: number,
  observacao?: string
): Promise<MarcacaoEntregaResponse> {
  const { data } = await client.post<MarcacaoEntregaResponse>(
    `/mobile/entrega/${idSaida}/ausente`,
    { motivo_id: motivoId, observacao: observacao || null }
  );
  return data;
}

export async function finalizarLote(body: FinalizarLoteBody): Promise<FinalizarLoteResponse> {
  const { data } = await client.post<FinalizarLoteResponse>("/mobile/entregas/finalizar-lote", body);
  return data;
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
  status: "entregue" | "ausente",
  validarCamposObrigatorios = true,
  alterarStatus = true
): Promise<void> {
  await client.patch(`/saidas/${idSaida}/foto`, {
    foto_url: fotoUrl,
    status,
    validar_campos_obrigatorios: !!validarCamposObrigatorios,
    alterar_status: !!alterarStatus,
  });
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
  origem?: "manual" | "ocr" | "voz" | "suggestion" | "autocomplete" | "mapa" | "google_places";
  coord_precision?: "rooftop" | "street" | "approx" | null;
  geocode_source?: string | null;
  geocode_score?: number | null;
}

export async function putEndereco(idSaida: number, body: EnderecoBody): Promise<EntregaListItem> {
  const { data } = await client.put<EntregaListItem>(`/mobile/entrega/${idSaida}/endereco`, body);
  return data;
}

const ENDERECO_SUGESTOES_TIMEOUT_MS = 20_000;
const ROUTE_OPTIMIZE_TIMEOUT_MS = 30_000;

export async function postEnderecoSugestoes(
  body: EnderecoSugestoesBody
): Promise<EnderecoSugestoesResponse> {
  const { data } = await client.post<EnderecoSugestoesResponse>(
    "/mobile/enderecos/sugestoes",
    body,
    { timeout: ENDERECO_SUGESTOES_TIMEOUT_MS }
  );
  return data;
}

export async function postEnderecoPlaceDetails(
  body: PlaceDetailsBody
): Promise<PlaceDetailsResponse> {
  const { data } = await client.post<PlaceDetailsResponse>("/mobile/enderecos/place-details", body);
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

export interface ScanLeituraDiaAnterior {
  code: "LEITURA_DIA_ANTERIOR";
  conflito?: false;
  id_saida: number;
  data_operacional_anterior: string;
  status_atual?: string;
  motoboy_id?: number | null;
  motoboy_nome?: string | null;
}

export interface ScanStatusFinalizado {
  code: "STATUS_FINALIZADO";
  id_saida?: number;
  status_atual?: string;
  message?: string;
}

/**
 * Envia para /mobile/scan o valor bruto lido do scanner quando disponível.
 * O backend faz normalize_codigo(...) e extrai codigo/servico/qr_payload_raw.
 */
export async function scanCodigo(
  codigoBrutoOuNormalizado: string,
  origem: "camera" | "manual" = "camera"
): Promise<ScanSuccess | ScanConflict | ScanLeituraDiaAnterior | ScanStatusFinalizado> {
  try {
    const { data } = await client.post<ScanSuccess>("/mobile/scan", {
      codigo: codigoBrutoOuNormalizado,
      origem,
    });
    return data;
  } catch (err) {
    const ax = err as AxiosError<ScanConflict | ScanLeituraDiaAnterior | ScanStatusFinalizado>;
    if (ax.response?.status === 409 && ax.response?.data) {
      return ax.response.data;
    }
    if (ax.response?.status === 422 && ax.response?.data && (ax.response.data as ScanStatusFinalizado).code === "STATUS_FINALIZADO") {
      return ax.response.data as ScanStatusFinalizado;
    }
    throw err;
  }
}

export async function assumirEntrega(idSaida: number): Promise<void> {
  await client.post(`/mobile/entrega/${idSaida}/assumir`);
}

export async function confirmarNovaSaidaMesmoEntregador(idSaida: number): Promise<void> {
  await client.post(`/mobile/entrega/${idSaida}/confirmar-nova-saida-mesmo-entregador`, { origem: "mobile" });
}

export interface LancarAvulsoResult {
  quantidade_criada: number;
  codigos: string[];
  saidas: Array<{
    id_saida: number;
    codigo: string;
    servico: string;
    status: string;
  }>;
  mensagem: string;
}

export async function lancarAvulsoMobile(body: {
  identificacao?: string | null;
  quantidade: number;
}): Promise<LancarAvulsoResult> {
  const { data } = await client.post<LancarAvulsoResult>("/pedidos/lancar-avulso", body);
  return data;
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

export interface ComprovanteWatermarkResponse {
  tem_comprovante: boolean;
  image_url?: string | null;
}

export async function getComprovanteWatermark(idSaida: number): Promise<ComprovanteWatermarkResponse> {
  const { data } = await client.get<ComprovanteWatermarkResponse>(`/upload/saida/${idSaida}/comprovante-watermark`);
  return data;
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += BASE64_ALPHABET[a >>> 2];
    out += BASE64_ALPHABET[((a & 3) << 4) | (b >>> 4)];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[((b & 15) << 2) | (c >>> 6)] : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET[c & 63] : "=";
  }
  return out;
}

/** Baixa o JPEG com watermark via axios (auth) e retorna data URI para <Image>. */
export async function fetchComprovanteImageDataUri(idSaida: number): Promise<string | null> {
  const meta = await getComprovanteWatermark(idSaida);
  if (!meta?.tem_comprovante) return null;
  try {
    const { data } = await client.get<ArrayBuffer>(`/upload/saida/${idSaida}/comprovante-watermark/image`, {
      responseType: "arraybuffer",
    });
    return `data:image/jpeg;base64,${arrayBufferToBase64(data)}`;
  } catch {
    return null;
  }
}

// --- Otimização e rotas ativas persistidas ---

export type RotasOtimizarModo = "osrm_trip" | "nearest_fallback" | "priority_soft";

export interface RotasOtimizarResponse {
  ordem: number[];
  modo: RotasOtimizarModo;
  sem_coordenadas: number[];
  distancia_total_m?: number | null;
  duracao_total_s?: number | null;
}

export type RotasOtimizarPriority =
  | { type: "service"; value: string }
  | { type: "delivery"; id_saida: number };

export async function postRotasOtimizar(
  deliveryIds: number[],
  start?: { latitude: number; longitude: number },
  priority?: RotasOtimizarPriority
): Promise<RotasOtimizarResponse> {
  const body: {
    delivery_ids: number[];
    start?: { latitude: number; longitude: number };
    priority?: RotasOtimizarPriority;
  } = {
    delivery_ids: deliveryIds,
  };
  if (start) body.start = start;
  if (priority) body.priority = priority;
  const { data } = await client.post<RotasOtimizarResponse>("/mobile/rotas/otimizar", body, {
    timeout: ROUTE_OPTIMIZE_TIMEOUT_MS,
  });
  return data;
}

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

export async function getRotaResumo(rotaId: string | number): Promise<RotasResumo> {
  const { data } = await client.get<RotasResumo>(`/mobile/rotas/${rotaId}/resumo`);
  return data;
}

export interface RotasOrdemResponse {
  ordem: number[];
  parada_atual: number;
}

export async function putRotasOrdem(
  rotaId: string,
  ordem: number[]
): Promise<RotasOrdemResponse> {
  const { data } = await client.put<RotasOrdemResponse>(`/mobile/rotas/${rotaId}/ordem`, { ordem });
  return data;
}
