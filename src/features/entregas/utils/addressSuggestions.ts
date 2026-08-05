import * as Location from "expo-location";
import type { AddressFormValues, AddressOrigem } from "../components/AddressForm";
import { postEnderecoPlaceDetails, postEnderecoSugestoes } from "../api";
import type { EnderecoSugestaoApi, EntregaListItem } from "../types";
import { normalizeAddressQuery, normalizeEstadoUf } from "./addressQueryNormalizer";
import { valuesFromEnderecoFormatado } from "./addressBuild";

export { resolveGeocodeDefaults, valuesFromEnderecoFormatado } from "./addressBuild";
import { isValidGeocodeCoords, type GeocodeResult } from "./geocode";
import { parsedToFormValues, type ParsedAddress } from "./ocrAddress";
import {
  addressKey,
  addressKeyFromValues,
  normalizeNumero,
  normalizeStreet,
} from "./routeUtils";
import {
  addressIdentityKey,
  compareBairro,
  hasBairroConflict,
  pickBestAddressSuggestion as pickBestAddressSuggestionCore,
  pickRecommendedAddressSuggestion as pickRecommendedAddressSuggestionCore,
  type PickBestAddressOptions,
  rankAddressSuggestions as rankAddressSuggestionsCore,
  suggestionCompletenessScore,
} from "./addressSuggestionRank";

export {
  addressIdentityKey,
  compareBairro,
  hasBairroConflict,
  suggestionCompletenessScore,
};
export type { BairroMatchLevel, PickBestAddressOptions } from "./addressSuggestionRank";

export type AddressSuggestion = {
  id: string;
  label: string;
  /** @deprecated use label */
  displayName: string;
  latitude: number;
  longitude: number;
  values: AddressFormValues;
  provider?: string;
  confidence?: number;
  distanceKm?: number | null;
  distanceMeters?: number | null;
  badge?: string | null;
  alreadyUsed?: boolean;
  placeId?: string;
  mainText?: string;
  secondaryText?: string;
  requiresPlaceDetails?: boolean;
  advancedSource?: boolean;
};

export type AddressSearchResult = {
  suggestions: AddressSuggestion[];
  didYouMean: AddressSuggestion | null;
  usedGoogle?: boolean;
};

export type GoogleFallbackReason = "user_requested" | "timeout" | "auto" | "no_results";

/** Erro explícito na busca de sugestões (404 backend desatualizado, 5xx, rede). */
export class AddressSearchError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "AddressSearchError";
    this.statusCode = statusCode;
  }
}

function throwAddressSearchError(err: unknown): never {
  if (err instanceof AddressSearchError) throw err;
  const axiosErr = err as { response?: { status?: number }; message?: string; code?: string };
  const status = axiosErr.response?.status;
  if (status === 404) {
    throw new AddressSearchError(
      "Serviço de sugestões indisponível. Verifique se o backend foi atualizado.",
      404
    );
  }
  if (status != null && status >= 500) {
    throw new AddressSearchError(
      "Serviço de sugestões temporariamente indisponível. Tente novamente.",
      status
    );
  }
  if (!axiosErr.response) {
    throw new AddressSearchError(
      "Não foi possível buscar sugestões. Verifique sua conexão."
    );
  }
  throw new AddressSearchError(
    axiosErr.message || "Erro ao buscar sugestões de endereço.",
    status
  );
}

function createSessionToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

let addressSessionToken = createSessionToken();

export function getAddressSessionToken(): string {
  return addressSessionToken;
}

export function resetAddressSessionToken(): void {
  addressSessionToken = createSessionToken();
}

export type AddressSavePayload = {
  values: AddressFormValues;
  coords: GeocodeResult | null;
  origem: AddressOrigem;
};

export function suggestionLabel(s: AddressSuggestion): string {
  return s.label || s.displayName;
}

export function formatSuggestionDistance(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  const formatted = km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km).toString();
  return `📍 ${formatted} km`;
}

export function formatSuggestionDistanceMeters(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `📍 ${Math.round(meters)} m`;
  return formatSuggestionDistance(meters / 1000);
}

export function suggestionBadgeLabel(
  s: AddressSuggestion,
  opts?: { recommendedId?: string | null; userBairro?: string | null }
): string | null {
  if (opts?.userBairro && hasBairroConflict(opts.userBairro, s.values.bairro)) {
    return "Bairro diferente do informado";
  }
  if (s.alreadyUsed || s.badge === "used") return "Endereço já utilizado";
  if (s.badge === "frequente") return "Frequente";
  if (opts?.recommendedId && s.id === opts.recommendedId) {
    if (opts?.userBairro && compareBairro(opts.userBairro, s.values.bairro) === "partial") {
      return "Confira o bairro";
    }
    return "Sugestão recomendada";
  }
  return null;
}

export function isGooglePendingSuggestion(s: AddressSuggestion): boolean {
  return Boolean(s.requiresPlaceDetails && s.placeId && s.provider === "google_places");
}

export function formatSuggestionLines(
  s: AddressSuggestion,
  opts?: { recommendedId?: string | null; userBairro?: string | null }
): {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  distance: string | null;
  badge: string | null;
} {
  const v = s.values;
  const cidade = (v.cidade ?? "").trim();
  const estado = normalizeEstadoUf(v.estado) || (v.estado ?? "").trim().toUpperCase();
  const line3FromValues = cidade && estado ? `${cidade} - ${estado}` : cidade || estado;
  const cepDigits = normalizeCep(v.cep ?? "");
  const badge = suggestionBadgeLabel(s, opts);

  if (s.mainText || s.secondaryText) {
    let line1 = (s.mainText ?? "").trim();
    const num = (v.numero ?? "").trim();
    // Provedor (Google) costuma omitir o número no mainText — reanexa se soubermos.
    if (num && line1 && !new RegExp(`(^|\\D)${num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\D|$)`).test(line1)) {
      line1 = `${line1}, ${num}`;
    }
    return {
      line1,
      line2: (s.secondaryText ?? "").trim(),
      line3: line3FromValues,
      line4: cepDigits.length === 8 ? `CEP ${cepDigits}` : "",
      distance:
        formatSuggestionDistanceMeters(s.distanceMeters) ??
        formatSuggestionDistance(s.distanceKm),
      badge,
    };
  }

  const multiline = suggestionLabel(s).includes("\n");
  if (multiline) {
    const parts = suggestionLabel(s).split("\n").map((p) => p.trim()).filter(Boolean);
    return {
      line1: parts[0] ?? "",
      line2: parts[1] ?? "",
      line3: (line3FromValues || parts[2]) ?? "",
      line4: parts[3] ?? "",
      distance:
        formatSuggestionDistanceMeters(s.distanceMeters) ??
        formatSuggestionDistance(s.distanceKm),
      badge,
    };
  }
  const line1 = [v.rua, v.numero].filter(Boolean).join(", ");
  const line2 = (v.bairro ?? "").trim();
  const line3 = line3FromValues;
  const line4 = cepDigits.length === 8 ? `CEP ${cepDigits}` : "";
  return {
    line1,
    line2,
    line3,
    line4,
    distance: formatSuggestionDistance(s.distanceKm),
    badge,
  };
}

function normalizePartForDedup(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeNumeroForDedup(num: string): string {
  const digits = num.replace(/\D/g, "");
  return digits || normalizePartForDedup(num);
}

export function isSelectableAddressSuggestion(s: AddressSuggestion): boolean {
  if (isGooglePendingSuggestion(s)) return true;
  if (!isValidGeocodeCoords(s.latitude, s.longitude)) return false;
  const cidade = (s.values.cidade ?? "").trim();
  const estado = (s.values.estado ?? "").trim();
  const rua = (s.values.rua ?? "").trim();
  const label = suggestionLabel(s).trim();
  if (!cidade && !isGooglePendingSuggestion(s)) return false;
  if ((!estado || estado.length < 2) && !isGooglePendingSuggestion(s)) return false;
  if (!rua && !label) return false;
  return true;
}

export function isDisplayableAddressSuggestion(s: AddressSuggestion): boolean {
  return isSelectableAddressSuggestion(s);
}

/** @deprecated use isSelectableAddressSuggestion */
export function isSelectableSuggestion(s: AddressSuggestion): boolean {
  return isSelectableAddressSuggestion(s);
}

export function filterSelectableSuggestions(list: AddressSuggestion[]): AddressSuggestion[] {
  return list.filter(isDisplayableAddressSuggestion);
}

export function rankAddressSuggestions(list: AddressSuggestion[]): AddressSuggestion[] {
  return rankAddressSuggestionsCore(filterSelectableSuggestions(list));
}

export function pickBestAddressSuggestion(
  list: AddressSuggestion[],
  opts?: PickBestAddressOptions
): AddressSuggestion | null {
  return pickBestAddressSuggestionCore(filterSelectableSuggestions(list), opts);
}

export function pickRecommendedAddressSuggestion(
  list: AddressSuggestion[],
  opts?: PickBestAddressOptions
): AddressSuggestion | null {
  return pickRecommendedAddressSuggestionCore(filterSelectableSuggestions(list), opts);
}

/** Critério mais permissivo para exibir bloco "Você quis dizer?" (não auto-aplica). */
export function isDisplayableDidYouMean(s: AddressSuggestion | null | undefined): boolean {
  if (!s) return false;
  if (!isValidGeocodeCoords(s.latitude, s.longitude)) return false;
  const rua = (s.values.rua ?? "").trim();
  return rua.length > 0 || suggestionLabel(s).trim().length > 0;
}

/** Texto único do campo após seleção — sem duplicar partes. */
export function formatSelectedAddress(s: AddressSuggestion): string {
  const v = s.values;
  const seen = new Set<string>();
  const parts: string[] = [];

  const add = (raw: string, kind: "text" | "num" | "cep" = "text") => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key =
      kind === "num"
        ? `num:${normalizeNumeroForDedup(trimmed)}`
        : kind === "cep"
          ? `cep:${normalizeCep(trimmed)}`
          : normalizePartForDedup(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    parts.push(trimmed);
  };

  add(v.rua ?? "");
  add(v.numero ?? "", "num");
  add(v.bairro ?? "");

  const cidade = (v.cidade ?? "").trim();
  const estado = (v.estado ?? "").trim().toUpperCase();
  if (cidade) {
    const cidadeKey = normalizePartForDedup(cidade);
    if (!seen.has(cidadeKey)) {
      seen.add(cidadeKey);
      parts.push(estado ? `${cidade} - ${estado}` : cidade);
      if (estado) seen.add(normalizePartForDedup(estado));
    }
  } else if (estado && !seen.has(normalizePartForDedup(estado))) {
    seen.add(normalizePartForDedup(estado));
    parts.push(estado);
  }

  const cepDigits = normalizeCep(v.cep ?? "");
  if (cepDigits.length === 8) add(cepDigits, "cep");

  return parts.join(", ");
}

export function suggestionToSavePayload(
  s: AddressSuggestion,
  origem: AddressOrigem = "suggestion"
): AddressSavePayload {
  return {
    values: s.values,
    coords: isSelectableAddressSuggestion(s)
      ? { latitude: s.latitude, longitude: s.longitude }
      : null,
    origem,
  };
}

type NominatimAddress = Record<string, string>;

type NominatimItem = {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
};

const UF_FROM_ISO: Record<string, string> = {
  "BR-AC": "AC", "BR-AL": "AL", "BR-AP": "AP", "BR-AM": "AM", "BR-BA": "BA",
  "BR-CE": "CE", "BR-DF": "DF", "BR-ES": "ES", "BR-GO": "GO", "BR-MA": "MA",
  "BR-MT": "MT", "BR-MS": "MS", "BR-MG": "MG", "BR-PA": "PA", "BR-PB": "PB",
  "BR-PR": "PR", "BR-PE": "PE", "BR-PI": "PI", "BR-RJ": "RJ", "BR-RN": "RN",
  "BR-RS": "RS", "BR-RO": "RO", "BR-RR": "RR", "BR-SC": "SC", "BR-SP": "SP",
  "BR-SE": "SE", "BR-TO": "TO",
};

function normalizeCep(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : digits;
}

function estadoFromNominatim(addr: NominatimAddress): string {
  const iso = addr["ISO3166-2-lvl4"];
  const uf = normalizeEstadoUf(addr.state, iso);
  if (uf) return uf;
  if (iso && UF_FROM_ISO[iso]) return UF_FROM_ISO[iso];
  return (addr.state || "").trim();
}

/** Separa logradouro de endereço salvo com vírgulas no campo rua. */
export function sanitizeAddressFormValues(values: AddressFormValues): AddressFormValues {
  let rua = (values.rua ?? "").trim();
  let numero = (values.numero ?? "").trim();
  let bairro = (values.bairro ?? "").trim();
  let cidade = (values.cidade ?? "").trim();
  let estado = (values.estado ?? "").trim();
  const cep = normalizeCep(values.cep ?? "");
  const complemento = (values.complemento ?? "").trim();
  const destinatario = (values.destinatario ?? "").trim();

  // OCR frequentemente cola "CEP: 00000-000" no bairro/rua.
  const stripCepNoise = (text: string) =>
    text
      .replace(/\bcep\s*[:.]?\s*\d{5}-?\d{3}\b/gi, " ")
      .replace(/\b\d{5}-?\d{3}\b/g, " ")
      .replace(/\bcep\s*[:.]?\s*/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/[,\s]+$/g, "")
      .trim();
  rua = stripCepNoise(rua);
  bairro = stripCepNoise(bairro);
  cidade = stripCepNoise(cidade);

  if (rua.includes(",")) {
    const segments = rua.split(",").map((s) => s.trim()).filter(Boolean);
    const first = segments[0] ?? "";
    const second = segments[1] ?? "";
    const secondIsNum =
      /^\d+[a-zA-Z]?$/.test(second) ||
      (numero.length > 0 && normalizeNumero(second, rua) === normalizeNumero(numero, rua));

    if (segments.length >= 2 && secondIsNum) {
      rua = first;
      if (!numero) numero = second;
      let idx = 2;
      if (!bairro && segments[idx] && !/^[A-Za-z]{2}$/.test(segments[idx])) {
        bairro = segments[idx];
        idx += 1;
      }
      if (!cidade && segments[idx] && !/^[A-Za-z]{2}$/.test(segments[idx])) {
        cidade = segments[idx];
        idx += 1;
      }
      if (!estado && segments[idx] && /^[A-Za-z]{2}$/.test(segments[idx])) {
        estado = segments[idx].toUpperCase();
      }
    } else if (numero) {
      rua = first;
    }
  }

  if (numero && rua) {
    const trailing = new RegExp(`[,\\s]+${numero.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
    if (trailing.test(rua)) {
      rua = rua.replace(trailing, "").trim();
    }
  }

  return {
    destinatario,
    rua,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    cep,
  };
}

/** Mescla número/rua/CEP/bairro/cidade/UF do OCR/voz quando a sugestão vem incompleta. */
export function mergeAddressHints(
  values: AddressFormValues,
  hints?: Partial<AddressFormValues>
): AddressFormValues {
  if (!hints) return sanitizeAddressFormValues(values);
  const hintNumero = (hints.numero ?? "").trim();
  let hintRua = (hints.rua ?? "").trim();
  if (hintRua.includes(",")) {
    hintRua = hintRua.split(",")[0].trim();
  }
  const valueCep = normalizeCep(values.cep ?? "");
  const hintCep = normalizeCep(hints.cep ?? "");
  return sanitizeAddressFormValues({
    ...values,
    rua: values.rua.trim() || hintRua,
    numero: values.numero.trim() || hintNumero,
    complemento: values.complemento.trim() || (hints.complemento ?? "").trim(),
    destinatario: values.destinatario.trim() || (hints.destinatario ?? "").trim(),
    bairro: values.bairro.trim() || (hints.bairro ?? "").trim(),
    cidade: values.cidade.trim() || (hints.cidade ?? "").trim(),
    estado: values.estado.trim() || (hints.estado ?? "").trim(),
    // Preferência: CEP da sugestão; senão preserva o do OCR/hints (nunca descartar).
    cep: valueCep.length === 8 ? valueCep : hintCep,
  });
}

function formatSuggestionDisplayName(
  values: AddressFormValues,
  fallback?: string
): string {
  const summary = formatAddressSummary(values);
  if (summary) return summary;
  return (fallback ?? "").trim();
}

function nominatimToValues(item: NominatimItem): AddressFormValues {
  const addr = item.address ?? {};
  const rua =
    addr.road ||
    addr.pedestrian ||
    addr.street ||
    addr.residential ||
    addr.footway ||
    "";
  const numero = addr.house_number || "";
  const bairro =
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.city_district ||
    addr.district ||
    "";
  const cidade =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    "";
  const estado = estadoFromNominatim(addr);
  const cep = normalizeCep(addr.postcode || "");

  return {
    destinatario: "",
    rua: rua.trim(),
    numero: numero.trim(),
    complemento: "",
    bairro: bairro.trim(),
    cidade: cidade.trim(),
    estado,
    cep,
  };
}

export function addressCompletenessScore(vals: Partial<AddressFormValues>): number {
  let score = 0;
  if ((vals.rua ?? "").trim()) score += 3;
  if ((vals.numero ?? "").trim()) score += 2;
  if ((vals.cidade ?? "").trim()) score += 2;
  if ((vals.estado ?? "").trim()) score += 1;
  if ((vals.cep ?? "").replace(/\D/g, "").length === 8) score += 2;
  if ((vals.bairro ?? "").trim()) score += 1;
  return score;
}

export function needsAddressEnrichment(vals: Partial<AddressFormValues>): boolean {
  if (!(vals.rua ?? "").trim()) return false;
  // OCR costuma trazer rua+número+bairro+CEP (score 8) sem cidade — ainda precisa buscar.
  if (!(vals.cidade ?? "").trim()) return true;
  if (!(vals.estado ?? "").trim()) return true;
  return addressCompletenessScore(vals) < 8;
}

export function buildSearchQuery(
  vals: Partial<AddressFormValues>,
  defaults?: { cidade?: string; estado?: string }
): string {
  const rua = (vals.rua ?? "").trim();
  const bairro = (vals.bairro ?? "").trim();
  const numero = (vals.numero ?? "").trim();
  const cidade = ((vals.cidade || defaults?.cidade) ?? "").trim();
  const estado = ((vals.estado || defaults?.estado) ?? "").trim();
  const cepDigits = normalizeCep(vals.cep ?? "");

  // Ordem que os provedores acertam melhor no Brasil — a mesma da fala
  // "rua + bairro + número" (bairro junto do logradouro, número depois).
  // Motoboy costuma falar "rua + número + bairro"; os campos já vêm separados,
  // mas a query precisa ir nessa ordem para manter a precisão.
  const streetWithNeighborhood = [rua, bairro].filter(Boolean).join(", ");
  const parts = [
    streetWithNeighborhood,
    numero,
    cidade,
    estado,
    cepDigits.length === 8 ? cepDigits : null,
    "Brasil",
  ].filter((p) => (p ?? "").trim());
  return parts.join(", ");
}

export function formatAddressSummary(vals: Partial<AddressFormValues>): string {
  return [vals.rua, vals.numero, vals.bairro, vals.cidade, vals.estado, vals.cep]
    .filter((p) => (p ?? "").trim())
    .join(", ");
}

export function suggestionToParsed(s: AddressSuggestion): ParsedAddress {
  return {
    ...s.values,
    rawText: formatSelectedAddress(s),
    confidence: "high",
  };
}

function makeSuggestion(
  partial: Omit<AddressSuggestion, "displayName"> & { label: string }
): AddressSuggestion {
  const values = sanitizeAddressFormValues(partial.values);
  const label =
    partial.provider === "local"
      ? partial.label
      : formatSuggestionDisplayName(values, partial.label);
  return { ...partial, values, label, displayName: label };
}

export function buildNominatimStructuredSearchUrl(
  hints: Partial<AddressFormValues>,
  defaults?: { cidade?: string; estado?: string },
  limit = 5
): string {
  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    limit: String(limit),
    countrycodes: "br",
    street: (hints.rua ?? "").trim(),
    housenumber: (hints.numero ?? "").trim(),
  });
  const cidade = (hints.cidade ?? defaults?.cidade ?? "").trim();
  const estado = (hints.estado ?? defaults?.estado ?? "").trim();
  if (cidade) params.set("city", cidade);
  if (estado) params.set("state", estado);
  return `https://nominatim.openstreetmap.org/search?${params}`;
}

function applyDefaultsToValues(
  values: AddressFormValues,
  defaults?: { cidade?: string; estado?: string }
): AddressFormValues {
  return {
    ...values,
    cidade: values.cidade.trim() || (defaults?.cidade ?? "").trim(),
    estado: values.estado.trim() || (defaults?.estado ?? "").trim(),
  };
}

const GPS_CACHE_TTL_MS = 120_000;
let cachedSearchGps: { latitude: number; longitude: number } | null = null;
let cachedSearchGpsAt = 0;

async function getCurrentGps(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

export async function getSearchGpsCached(): Promise<{ latitude: number; longitude: number } | null> {
  const now = Date.now();
  if (cachedSearchGps && now - cachedSearchGpsAt < GPS_CACHE_TTL_MS) {
    return cachedSearchGps;
  }
  const pos = await getCurrentGps();
  if (pos) {
    cachedSearchGps = pos;
    cachedSearchGpsAt = now;
  }
  return pos;
}

function mapApiSuggestionToAddress(
  api: EnderecoSugestaoApi,
  hints?: Partial<AddressFormValues>,
  defaults?: { cidade?: string; estado?: string }
): AddressSuggestion {
  let values = mergeAddressHints(
    {
      destinatario: (hints?.destinatario ?? "").trim(),
      rua: (api.rua ?? "").trim(),
      numero: (api.numero ?? "").trim(),
      complemento: (hints?.complemento ?? "").trim(),
      bairro: (api.bairro ?? "").trim(),
      cidade: (api.cidade ?? "").trim(),
      estado: normalizeEstadoUf(api.estado) || (api.estado ?? "").trim(),
      cep: normalizeCep(api.cep ?? ""),
    },
    hints
  );
  values = applyDefaultsToValues(values, defaults);
  const placeId = (api.place_id ?? "").trim();
  const requiresDetails = Boolean(api.requires_place_details && placeId);
  const id = placeId
    ? `google|${placeId}`
    : `${api.source}|${api.latitude}|${api.longitude}|${api.rua}|${api.numero ?? ""}`;
  const label = (api.label ?? "").trim() || formatSuggestionDisplayName(values);
  if (requiresDetails && (api.main_text || api.rua)) {
    values = {
      ...values,
      rua: (api.main_text ?? api.rua ?? values.rua).trim(),
    };
  }
  return makeSuggestion({
    id,
    label,
    latitude: api.latitude,
    longitude: api.longitude,
    values,
    provider: api.source,
    confidence: api.confidence ?? api.score / 100,
    distanceKm: api.distance_km,
    distanceMeters: api.distance_meters ?? undefined,
    badge: api.badge,
    alreadyUsed: api.already_used,
    placeId: placeId || undefined,
    mainText: api.main_text ?? undefined,
    secondaryText: api.secondary_text ?? undefined,
    requiresPlaceDetails: requiresDetails,
  });
}

export async function resolveGooglePlaceSuggestion(
  suggestion: AddressSuggestion,
  options?: {
    query?: string;
    hints?: Partial<AddressFormValues>;
    defaults?: { cidade?: string; estado?: string };
    gps?: { latitude: number; longitude: number } | null;
  }
): Promise<AddressSuggestion | null> {
  if (!suggestion.placeId) return null;
  try {
    const gps = options?.gps !== undefined ? options.gps : await getSearchGpsCached();
    const response = await postEnderecoPlaceDetails({
      place_id: suggestion.placeId,
      session_token: getAddressSessionToken(),
      query: options?.query,
      latitude: gps?.latitude,
      longitude: gps?.longitude,
      hints: options?.hints
        ? {
            rua: options.hints.rua,
            numero: options.hints.numero,
            bairro: options.hints.bairro,
            cidade: options.hints.cidade || options?.defaults?.cidade,
            estado: options.hints.estado || options?.defaults?.estado,
            cep: options.hints.cep,
          }
        : undefined,
    });
    if (!response.suggestion) return null;
    const resolved = mapApiSuggestionToAddress(
      response.suggestion,
      options?.hints,
      options?.defaults
    );
    resolved.requiresPlaceDetails = false;
    return resolved;
  } catch {
    return null;
  }
}

export async function searchAddressSuggestions(
  query: string,
  options?: {
    limit?: number;
    hints?: Partial<AddressFormValues>;
    defaults?: { cidade?: string; estado?: string };
    gps?: { latitude: number; longitude: number } | null;
    sessionToken?: string;
  }
): Promise<AddressSearchResult> {
  const q = normalizeAddressQuery(query.trim());
  const hints = options?.hints;
  const limit = options?.limit ?? 5;
  const hintRua = (hints?.rua ?? "").trim();
  const canSearch = q.replace(/\s/g, "").length >= 4 || hintRua.length >= 4;

  if (!canSearch) {
    return { suggestions: [], didYouMean: null };
  }

  try {
    const gps = options?.gps !== undefined ? options.gps : await getSearchGpsCached();
    const response = await postEnderecoSugestoes({
      query: q || buildSearchQuery(hints ?? {}, options?.defaults),
      latitude: gps?.latitude,
      longitude: gps?.longitude,
      hints: hints
        ? {
            rua: hints.rua,
            numero: hints.numero,
            bairro: hints.bairro,
            cidade: hints.cidade || options?.defaults?.cidade,
            estado: hints.estado || options?.defaults?.estado,
            cep: hints.cep,
          }
        : undefined,
      limit,
      session_token: options?.sessionToken ?? getAddressSessionToken(),
    });

    const mapped = (response.suggestions ?? []).map((s) =>
      mapApiSuggestionToAddress(s, hints, options?.defaults)
    );
    const suggestions = filterSelectableSuggestions(
      mapped.filter((s) => s.values.rua.trim().length > 0 || isGooglePendingSuggestion(s))
    );

    const dym = response.did_you_mean?.suggestion;
    const didYouMean = dym
      ? mapApiSuggestionToAddress(dym, hints, options?.defaults)
      : null;

    return { suggestions, didYouMean, usedGoogle: response.used_google };
  } catch (err) {
    throwAddressSearchError(err);
  }
}

function deliveryToSuggestion(
  d: EntregaListItem,
  defaults?: { cidade?: string; estado?: string }
): AddressSuggestion | null {
  if (!isValidGeocodeCoords(d.latitude, d.longitude)) return null;

  const parsedFmt = d.endereco_formatado
    ? valuesFromEnderecoFormatado(d.endereco_formatado)
    : null;
  const cep = (d.cep ?? "").replace(/\D/g, "").slice(0, 8);

  let values: AddressFormValues;
  if (parsedFmt?.rua) {
    values = {
      destinatario: d.cliente ?? "",
      rua: parsedFmt.rua,
      numero: parsedFmt.numero ?? d.numero ?? "",
      complemento: parsedFmt.complemento ?? "",
      bairro: (parsedFmt.bairro || d.bairro) ?? "",
      cidade: parsedFmt.cidade ?? "",
      estado: parsedFmt.estado ?? "",
      cep: parsedFmt.cep || cep,
    };
  } else {
    values = {
      destinatario: d.cliente ?? "",
      rua: d.endereco ?? "",
      numero: d.numero ?? "",
      complemento: "",
      bairro: d.bairro ?? "",
      cidade: defaults?.cidade ?? "",
      estado: defaults?.estado ?? "",
      cep,
    };
  }
  values = applyDefaultsToValues(sanitizeAddressFormValues(values), defaults);

  const label = `Mesmo endereço · Pedido ${d.id_saida} · ${d.codigo || "—"}`;
  const suggestion = makeSuggestion({
    id: `local|${d.id_saida}`,
    label,
    latitude: d.latitude!,
    longitude: d.longitude!,
    values,
    provider: "local",
    confidence: 1,
  });
  return isSelectableAddressSuggestion(suggestion) ? suggestion : null;
}

/** Sugere endereços já cadastrados em outros pacotes da fila/rota. */
export function findLocalAddressSuggestions(
  vals: Partial<AddressFormValues>,
  knownDeliveries: EntregaListItem[],
  defaults?: { cidade?: string; estado?: string }
): AddressSuggestion[] {
  const rua = (vals.rua ?? "").trim();
  const num = (vals.numero ?? "").trim();
  if (!rua && !num) return [];

  const queryKey = addressKeyFromValues(vals);
  const normRua = normalizeStreet(rua);
  const normNum = num ? normalizeNumero(num) : "";

  const results: AddressSuggestion[] = [];
  const seenIds = new Set<number>();
  const seenAddrKeys = new Set<string>();

  for (const d of knownDeliveries) {
    if (seenIds.has(d.id_saida)) continue;
    if (!d.endereco && !d.possui_endereco) continue;

    const dRua = normalizeStreet(d.endereco ?? "");
    const dNum = normalizeNumero(d.numero ?? "", d.endereco ?? "");
    const exactKey = queryKey !== "id|0" && addressKey(d) === queryKey;
    const partialMatch =
      normRua.length > 2 &&
      dRua.includes(normRua) &&
      (!normNum || dNum === normNum);

    if (exactKey || partialMatch) {
      seenIds.add(d.id_saida);
      const suggestion = deliveryToSuggestion(d, defaults);
      if (!suggestion) continue;
      const addrKey = addressKeyFromValues(suggestion.values);
      if (seenAddrKeys.has(addrKey)) continue;
      seenAddrKeys.add(addrKey);
      results.push(suggestion);
    }
  }

  return results;
}

export async function enrichParsedAddress(
  parsed: ParsedAddress,
  defaults?: { cidade?: string; estado?: string }
): Promise<{
  suggestions: AddressSuggestion[];
  autoSelected: AddressSuggestion | null;
  didYouMean: AddressSuggestion | null;
}> {
  const vals = parsedToFormValues(parsed);
  if (!needsAddressEnrichment(vals)) {
    return { suggestions: [], autoSelected: null, didYouMean: null };
  }
  const query = buildSearchQuery(vals, defaults);
  const { suggestions: raw, didYouMean } = await searchAddressSuggestions(query, {
    hints: vals,
    defaults,
  });
  const suggestions = filterSelectableSuggestions(raw);
  const autoSelected =
    suggestions.length === 1 && isSelectableAddressSuggestion(suggestions[0])
      ? suggestions[0]
      : null;
  return { suggestions, autoSelected, didYouMean };
}
