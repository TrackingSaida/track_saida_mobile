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

export interface MotoboyItem {
  id_motoboy: number;
  nome: string;
}

export async function listMotoboysOperacao(): Promise<MotoboyItem[]> {
  const { data } = await client.get<MotoboyItem[]>("/users/motoboys");
  return data;
}

export interface ListSaidasParams {
  de?: string;
  ate?: string;
  base?: string;
  entregador?: string;
  status?: string;
  servico?: string;
  somente_g?: boolean;
  localizar?: string;
  codigo?: string;
  /** Quando true, o backend compara o código com igualdade (case-insensitive); sem substring. */
  codigoExato?: boolean;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface SaidaListItem {
  /** PK da saída — devolvido por GET /saidas/listar (items[].id_saida) */
  id_saida?: number;
  /** Base lógica do owner; o listar já filtra por JWT, o app refiltra por segurança. */
  sub_base?: string | null;
  id?: number | string;
  codigo?: string;
  status?: string;
  servico?: string | null;
  base?: string | null;
  username?: string | null;
  entregador?: string | null;
  is_grande?: boolean;
  tsFmt?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ListSaidasResult {
  rows: SaidaListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export async function listSaidas(params: ListSaidasParams): Promise<ListSaidasResult> {
  const limit = Number(params.limit ?? 50);
  const offset = Number(params.offset ?? 0);

  const search = new URLSearchParams();
  if (params.de) search.set("de", params.de);
  if (params.ate) search.set("ate", params.ate);
  if (params.base) search.set("base", params.base);
  if (params.entregador) search.set("entregador", params.entregador);
  if (params.status) search.set("status", params.status);
  if (params.servico) search.set("servico", params.servico);
  if (params.somente_g) search.set("somente_g", "true");
  if (params.localizar) search.set("localizar", params.localizar);
  if (params.codigo) search.set("codigo", params.codigo);
  if (params.codigoExato) search.set("codigo_exato", "true");
  if (params.sort) search.set("sort", params.sort);
  search.set("limit", String(limit));
  search.set("offset", String(offset));

  const { data, headers } = await client.get<unknown>("/saidas/listar", {
    params: Object.fromEntries(search.entries()),
  });

  let rows: SaidaListItem[] = [];
  let total: number | null = null;

  if (Array.isArray(data)) {
    rows = data as SaidaListItem[];
  } else if (data && typeof data === "object") {
    const anyData = data as {
      items?: SaidaListItem[];
      rows?: SaidaListItem[];
      data?: SaidaListItem[];
      total?: number;
    };
    if (Array.isArray(anyData.items)) {
      rows = anyData.items;
      if (typeof anyData.total === "number") total = anyData.total;
    } else if (Array.isArray(anyData.rows)) {
      rows = anyData.rows;
      if (typeof anyData.total === "number") total = anyData.total;
    } else if (Array.isArray(anyData.data)) {
      rows = anyData.data;
      if (typeof anyData.total === "number") total = anyData.total;
    }
  }

  if (total == null) {
    const headerTotal = headers["x-total-count"] ?? headers["X-Total-Count"];
    if (headerTotal != null) {
      const parsed = Number(headerTotal);
      if (Number.isFinite(parsed)) total = parsed;
    }
  }

  if (total == null) {
    total = offset + rows.length;
  }

  const hasMore = rows.length === limit;

  return {
    rows,
    total,
    limit,
    offset,
    hasMore,
  };
}

export interface LerSaidaAdminBody {
  motoboy_id: number;
  entregador: string;
  codigo: string;
  servico?: string | null;
  registrar_nao_coletado?: boolean;
  qr_payload_raw?: string;
}

export interface LerSaidaApiRow {
  id_saida?: number;
  codigo?: string;
  servico?: string | null;
  status?: string | null;
  is_grande?: boolean;
  motoboy_id?: number | null;
  entregador?: string | null;
  username?: string | null;
}

/**
 * Wrapper para POST /saidas/ler usado pela leitura administrativa.
 *
 * Importante: em caso de erro de negócio (ex.: 409 TROCA_ENTREGADOR),
 * o AxiosError é repassado para o chamador tratar o fluxo (modal, etc.).
 */
export async function lerSaidaAdmin(body: LerSaidaAdminBody): Promise<LerSaidaApiRow> {
  const { data } = await client.post<LerSaidaApiRow | { data?: LerSaidaApiRow }>("/saidas/ler", body);
  if (data && typeof data === "object" && "data" in data) {
    return (data as { data?: LerSaidaApiRow }).data ?? {};
  }
  return data as LerSaidaApiRow;
}

export interface UpdateSaidaBody {
  status?: string;
  motoboy_id?: number;
  entregador?: string;
  is_grande?: boolean;
}

export async function updateSaidaAdmin(idSaida: number, body: UpdateSaidaBody): Promise<void> {
  await client.patch(`/saidas/${idSaida}`, body);
}

export interface GerarEtiquetaBody {
  codigo: string;
  id_saida?: number;
  servico?: string | null;
  formato?: "pdf" | "png";
}

export interface EtiquetaArquivoResult {
  bytes: Uint8Array;
  contentType: string;
}

export async function gerarEtiquetaArquivo(body: GerarEtiquetaBody): Promise<EtiquetaArquivoResult> {
  const { data, headers } = await client.post<ArrayBuffer>("/etiquetas/gerar", body, {
    responseType: "arraybuffer",
  });
  return {
    bytes: new Uint8Array(data),
    contentType: String(headers["content-type"] ?? "application/pdf"),
  };
}

export interface SaidaDetail {
  id?: number | string;
  codigo?: string;
  status?: string;
  servico?: string | null;
  base?: string | null;
  username?: string | null;
  entregador?: string | null;
  data_hora_entrega?: string | null;
  detail?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface SaidaHistoricoItem {
  id?: number | string;
  evento?: string | null;
  status_anterior?: string | null;
  status_novo?: string | null;
  timestamp?: string | null;
  usuario_nome?: string | null;
  [key: string]: unknown;
}

export async function getSaidaDetail(idSaida: number | string): Promise<SaidaDetail> {
  const { data } = await client.get<SaidaDetail>(`/saidas/${encodeURIComponent(String(idSaida))}`);
  return data;
}

export async function getSaidaHistorico(idSaida: number | string): Promise<SaidaHistoricoItem[]> {
  const { data } = await client.get<SaidaHistoricoItem[]>(
    `/saidas/${encodeURIComponent(String(idSaida))}/historico`
  );
  return Array.isArray(data) ? data : [];
}

