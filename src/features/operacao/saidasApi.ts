import { apiClient as client } from "../../services/apiClient";
import { normalizePersonList } from "../../utils/personName";

export interface MotoboyItem {
  id_motoboy: number;
  nome: string;
  pode_lancar_avulso?: boolean;
  avulso_exige_foto?: boolean;
}

export async function listMotoboysOperacao(): Promise<MotoboyItem[]> {
  const { data } = await client.get<MotoboyItem[]>("/users/motoboys");
  return normalizePersonList(Array.isArray(data) ? data : []);
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
  /** Data operacional do pacote (YYYY-MM-DD) */
  data?: string | null;
  data_hora_acao?: string;
  acao?: string;
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

export type SearchCodigosMode = "exact" | "prefix" | "contains" | "none";

export interface SearchCodigosCascadeResult {
  rows: SaidaListItem[];
  total: number;
  mode: SearchCodigosMode;
  truncated: boolean;
}

const PARTIAL_SEARCH_LIMIT = 20;

export async function searchCodigosCascade(
  baseParams: Omit<ListSaidasParams, "codigo" | "codigoExato" | "localizar">,
  codigo: string,
  options?: { forceExact?: boolean }
): Promise<SearchCodigosCascadeResult> {
  const term = codigo.trim();
  if (!term) {
    return { rows: [], total: 0, mode: "none", truncated: false };
  }

  const upper = term.toUpperCase();
  // Consulta por código não restringe período — fragmento precisa achar pedido antigo.
  const rest = { ...baseParams };
  delete rest.de;
  delete rest.ate;

  // Nome / CEP / identificação → sempre contém (nunca exact).
  const looksLikeCep =
    /^\d{5}-\d{3}$/.test(term) ||
    (/^\d{7,8}$/.test(term.replace(/\D+/g, "")) && !/^4[5-9]\d{9,}$/.test(term.replace(/\D+/g, "")));
  const looksLikeName = /[A-Za-zÀ-ÿ]/.test(term) && !/^AVULSO-/i.test(term) && !/^RTE[0-9]/i.test(term) && !/^BR\d/i.test(term);
  const forceExact =
    !!options?.forceExact && !looksLikeCep && !looksLikeName;

  if (forceExact) {
    const exact = await listSaidas({
      ...rest,
      codigo: upper,
      codigoExato: true,
      limit: PARTIAL_SEARCH_LIMIT,
      offset: 0,
    });
    return {
      rows: exact.rows,
      total: exact.total,
      mode: exact.rows.length > 0 ? "exact" : "none",
      truncated: false,
    };
  }

  const containsRes = await listSaidas({
    ...rest,
    localizar: term,
    limit: PARTIAL_SEARCH_LIMIT,
    offset: 0,
  });
  const rows = containsRes.rows ?? [];

  return {
    rows,
    total: containsRes.total ?? rows.length,
    mode: rows.length > 0 ? "contains" : "none",
    truncated: containsRes.hasMore || rows.length >= PARTIAL_SEARCH_LIMIT,
  };
}

const EXACT_LIST_CONCURRENCY = 5;

/** Busca exata de vários códigos, na ordem pedida. Códigos sem match são omitidos. */
export async function searchCodigosExatosLista(
  baseParams: Omit<ListSaidasParams, "codigo" | "codigoExato" | "localizar">,
  codigos: string[]
): Promise<SaidaListItem[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of codigos) {
    const code = String(raw || "").trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    unique.push(code);
  }
  if (unique.length === 0) return [];

  const found = new Map<string, SaidaListItem>();
  for (let i = 0; i < unique.length; i += EXACT_LIST_CONCURRENCY) {
    const chunk = unique.slice(i, i + EXACT_LIST_CONCURRENCY);
    const parts = await Promise.all(
      chunk.map(async (codigo) => {
        const res = await searchCodigosCascade(baseParams, codigo, { forceExact: true });
        const match = (res.rows ?? []).find(
          (row) => String(row.codigo || "").trim().toUpperCase() === codigo
        );
        return { codigo, match: match ?? res.rows?.[0] ?? null };
      })
    );
    for (const part of parts) {
      if (part.match) found.set(part.codigo, part.match);
    }
  }

  const ordered: SaidaListItem[] = [];
  for (const codigo of unique) {
    const row = found.get(codigo);
    if (row) ordered.push(row);
  }
  return ordered;
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
  origem?: "camera" | "manual" | "selecao";
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
  data_operacional_anterior?: string | null;
  status_atual?: string | null;
  motoboy_nome?: string | null;
  code?: string;
  message?: string;
  qr_atualizado?: boolean;
  qr_alerta?: boolean;
  qr_alerta_mensagem?: string;
}

export interface LancarAvulsoBody {
  identificacao?: string | null;
  quantidade: number;
  entregador_id?: number;
  entregador?: string;
  motoboy_id?: number;
  foto_object_key?: string;
  photo_id?: string;
  foto_object_keys?: string[];
  photo_ids?: string[];
  campos?: Record<string, string>;
  motivo_excepcional?: string;
}

export interface LancarAvulsoResult {
  quantidade_criada: number;
  codigos: string[];
  labels?: string[];
  lote_id?: number | null;
  saidas: Array<{
    id_saida: number;
    codigo: string;
    servico: string;
    status: string;
    label?: string;
  }>;
  mensagem: string;
}

export interface AvulsoCampoSchema {
  id: number;
  chave: string;
  label: string;
  tipo: string;
  tipo_label?: string;
  tipo_hint?: string;
  placeholder?: string;
  input_mode?: string;
  obrigatorio: boolean;
  usar_na_identificacao?: boolean;
  exibir_na_selecao?: boolean;
  ordem?: number;
  opcoes?: string[];
}

export interface AvulsoCampoBusca {
  chave: string;
  label: string;
  tipo?: string;
  tipo_label?: string;
  placeholder?: string;
  input_mode?: string;
}

export interface AvulsoPendenteItem {
  id_saida: number;
  codigo?: string | null;
  status?: string | null;
  status_label?: string | null;
  base?: string | null;
  label: string;
  campos?: Record<string, string>;
  avulso_lote_id?: number | null;
  avulso_criado_excepcional?: boolean;
  motoboy_id?: number | null;
  motoboy_nome?: string | null;
}

export interface AvulsosPendentesResult {
  total: number;
  items: AvulsoPendenteItem[];
  modo?: string;
  ambiguo?: boolean;
  mensagem?: string | null;
  campos_busca?: AvulsoCampoBusca[];
}

export async function schemaCamposAvulso(contexto: string): Promise<AvulsoCampoSchema[]> {
  const { data } = await client.get<{ campos?: AvulsoCampoSchema[] }>(
    "/configuracoes/campos-avulso/schema",
    { params: { contexto } }
  );
  return Array.isArray(data?.campos) ? data.campos : [];
}

export async function listAvulsosPendentes(params?: {
  q?: string;
  identificadores?: Record<string, string>;
  todos_do_dia?: boolean;
  limit?: number;
  offset?: number;
}): Promise<AvulsosPendentesResult> {
  const query: Record<string, string | number | boolean> = {};
  if (params?.q) query.q = params.q;
  if (params?.identificadores && Object.keys(params.identificadores).length) {
    query.identificadores = JSON.stringify(params.identificadores);
  }
  if (params?.todos_do_dia) query.todos_do_dia = true;
  if (params?.limit != null) query.limit = params.limit;
  if (params?.offset != null) query.offset = params.offset;
  const { data } = await client.get<AvulsosPendentesResult>("/avulsos/pendentes", { params: query });
  return {
    total: Number(data?.total) || 0,
    items: Array.isArray(data?.items) ? data.items : [],
    modo: data?.modo,
    ambiguo: !!data?.ambiguo,
    mensagem: data?.mensagem || null,
    campos_busca: Array.isArray(data?.campos_busca) ? data.campos_busca : [],
  };
}

export interface AvulsoCampoExibicao {
  chave: string;
  label: string;
  valor: string;
}

export async function getAvulsoDetalhe(idSaida: number): Promise<AvulsoPendenteItem & {
  servico?: string | null;
  origem?: string | null;
  origem_label?: string | null;
  timestamp?: string | null;
  campos_exibicao?: AvulsoCampoExibicao[];
}> {
  const { data } = await client.get(`/avulsos/${idSaida}`);
  return data;
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

export async function lancarAvulso(body: LancarAvulsoBody): Promise<LancarAvulsoResult> {
  const { data } = await client.post<LancarAvulsoResult>("/pedidos/lancar-avulso", body);
  return data;
}

export interface UpdateSaidaBody {
  status?: string;
  motoboy_id?: number;
  entregador?: string;
  is_grande?: boolean;
  reverter_cancelamento?: boolean;
}

export async function updateSaidaAdmin(idSaida: number, body: UpdateSaidaBody): Promise<void> {
  await client.patch(`/saidas/${idSaida}`, body);
}

export interface ConfirmarNovaSaidaMesmoEntregadorAdminBody {
  id_saida: number;
  motoboy_id?: number;
  entregador_id?: number;
  entregador?: string;
  origem?: "web" | "mobile";
}

export async function confirmarNovaSaidaMesmoEntregadorAdmin(
  body: ConfirmarNovaSaidaMesmoEntregadorAdminBody
): Promise<LerSaidaApiRow> {
  const { data } = await client.post<LerSaidaApiRow>("/saidas/confirmar-nova-saida-mesmo-entregador", body);
  return data;
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

export interface SaidaDetailNested {
  id_saida?: number;
  status?: string | null;
  tentativa?: number | null;
  motivo_ocorrencia?: string | null;
  observacao_ocorrencia?: string | null;
  observacao_entrega?: string | null;
  tipo_recebedor?: string | null;
  nome_recebedor?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  foto_urls?: string[] | null;
}

export interface SaidaDetail {
  id?: number | string;
  id_saida?: number | string;
  codigo?: string;
  status?: string;
  servico?: string | null;
  base?: string | null;
  username?: string | null;
  entregador?: string | null;
  data_hora_entrega?: string | null;
  detail?: SaidaDetailNested | null;
  [key: string]: unknown;
}

export interface SaidaHistoricoItem {
  id?: number | string;
  evento?: string | null;
  status_anterior?: string | null;
  status_novo?: string | null;
  timestamp?: string | null;
  usuario_nome?: string | null;
  acao_label?: string | null;
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
