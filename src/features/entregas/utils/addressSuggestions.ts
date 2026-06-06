import type { AddressFormValues } from "../components/AddressForm";
import type { EntregaListItem } from "../types";
import { parsedToFormValues, type ParsedAddress } from "./ocrAddress";
import {
  addressKey,
  addressKeyFromValues,
  normalizeNumero,
  normalizeStreet,
} from "./routeUtils";

export type AddressSuggestion = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  values: AddressFormValues;
};

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
  if (iso && UF_FROM_ISO[iso]) return UF_FROM_ISO[iso];
  const state = (addr.state || "").trim();
  if (state.length === 2) return state.toUpperCase();
  return state.slice(0, 2).toUpperCase() || state;
}

/** Mescla número/rua digitados pelo usuário quando o Nominatim retorna só o logradouro. */
export function mergeAddressHints(
  values: AddressFormValues,
  hints?: Partial<AddressFormValues>
): AddressFormValues {
  if (!hints) return values;
  const hintNumero = (hints.numero ?? "").trim();
  const hintRua = (hints.rua ?? "").trim();
  return {
    ...values,
    rua: values.rua.trim() || hintRua,
    numero: values.numero.trim() || hintNumero,
    complemento: values.complemento.trim() || (hints.complemento ?? "").trim(),
    destinatario: values.destinatario.trim() || (hints.destinatario ?? "").trim(),
  };
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
  return addressCompletenessScore(vals) < 8;
}

export function buildSearchQuery(
  vals: Partial<AddressFormValues>,
  defaults?: { cidade?: string; estado?: string }
): string {
  const parts = [
    vals.rua,
    vals.numero,
    vals.bairro,
    vals.cidade || defaults?.cidade,
    vals.estado || defaults?.estado,
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
    rawText: s.displayName,
    confidence: "high",
  };
}

function buildStructuredSearchUrl(
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

async function fetchNominatimItems(url: string): Promise<NominatimItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "TrackSaidaMobile/1.0" },
  });
  const data = (await res.json()) as NominatimItem[];
  return Array.isArray(data) ? data : [];
}

function mapNominatimToSuggestions(
  items: NominatimItem[],
  hints?: Partial<AddressFormValues>
): AddressSuggestion[] {
  return items
    .filter((item) => item.lat != null && item.lon != null)
    .map((item) => {
      const values = mergeAddressHints(nominatimToValues(item), hints);
      return {
        id: String(item.place_id ?? item.display_name),
        displayName: formatSuggestionDisplayName(values, item.display_name),
        latitude: parseFloat(item.lat!),
        longitude: parseFloat(item.lon!),
        values,
      };
    })
    .filter((s) => s.values.rua.trim().length > 0);
}

export async function searchAddressSuggestions(
  query: string,
  options?: {
    limit?: number;
    hints?: Partial<AddressFormValues>;
    defaults?: { cidade?: string; estado?: string };
  }
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  const hints = options?.hints;
  const limit = options?.limit ?? 5;
  const hasStructured =
    (hints?.rua ?? "").trim().length > 2 && (hints?.numero ?? "").trim().length > 0;

  if (q.length < 6 && !hasStructured) return [];

  try {
    let items: NominatimItem[] = [];

    if (hasStructured) {
      items = await fetchNominatimItems(
        buildStructuredSearchUrl(hints!, options?.defaults, limit)
      );
    }

    if (items.length === 0 && q.length >= 6) {
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=${limit}&countrycodes=br`;
      items = await fetchNominatimItems(url);
    }

    const suggestions = mapNominatimToSuggestions(items, hints);

    if (hints?.numero?.trim()) {
      const hintNum = normalizeNumero(hints.numero);
      suggestions.sort((a, b) => {
        const aHas = normalizeNumero(a.values.numero) === hintNum ? 1 : 0;
        const bHas = normalizeNumero(b.values.numero) === hintNum ? 1 : 0;
        return bHas - aHas;
      });
    }

    return suggestions;
  } catch {
    return [];
  }
}

function deliveryToSuggestion(
  d: EntregaListItem,
  defaults?: { cidade?: string; estado?: string }
): AddressSuggestion {
  const cep = (d.cep ?? "").replace(/\D/g, "").slice(0, 8);
  const values: AddressFormValues = {
    destinatario: d.cliente ?? "",
    rua: d.endereco ?? "",
    numero: d.numero ?? "",
    complemento: "",
    bairro: d.bairro ?? "",
    cidade: defaults?.cidade ?? "",
    estado: defaults?.estado ?? "",
    cep,
  };
  const summary = formatAddressSummary(values);
  return {
    id: `local|${d.id_saida}`,
    displayName: `Mesmo endereço · Pedido ${d.id_saida} · ${d.codigo || "—"}${summary ? ` — ${summary}` : ""}`,
    latitude: d.latitude ?? 0,
    longitude: d.longitude ?? 0,
    values,
  };
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
  const seen = new Set<number>();

  for (const d of knownDeliveries) {
    if (seen.has(d.id_saida)) continue;
    if (!d.endereco && !d.possui_endereco) continue;

    const dRua = normalizeStreet(d.endereco ?? "");
    const dNum = normalizeNumero(d.numero ?? "", d.endereco ?? "");
    const exactKey = queryKey !== "id|0" && addressKey(d) === queryKey;
    const partialMatch =
      normRua.length > 2 &&
      dRua.includes(normRua) &&
      (!normNum || dNum === normNum);

    if (exactKey || partialMatch) {
      seen.add(d.id_saida);
      results.push(deliveryToSuggestion(d, defaults));
    }
  }

  return results;
}

export async function enrichParsedAddress(
  parsed: ParsedAddress,
  defaults?: { cidade?: string; estado?: string }
): Promise<{ suggestions: AddressSuggestion[]; autoSelected: AddressSuggestion | null }> {
  const vals = parsedToFormValues(parsed);
  if (!needsAddressEnrichment(vals)) {
    return { suggestions: [], autoSelected: null };
  }
  const query = buildSearchQuery(vals, defaults);
  const suggestions = await searchAddressSuggestions(query, { hints: vals, defaults });
  const autoSelected = suggestions.length === 1 ? suggestions[0] : null;
  return { suggestions, autoSelected };
}
