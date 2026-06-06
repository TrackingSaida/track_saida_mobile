import type { AddressFormValues } from "../components/AddressForm";
import { parsedToFormValues, type ParsedAddress } from "./ocrAddress";

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

export async function searchAddressSuggestions(
  query: string,
  options?: { limit?: number }
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 6) return [];

  const limit = options?.limit ?? 5;
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=${limit}&countrycodes=br`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TrackSaidaMobile/1.0" },
    });
    const data = (await res.json()) as NominatimItem[];
    if (!Array.isArray(data)) return [];

    return data
      .filter((item) => item.lat != null && item.lon != null)
      .map((item) => {
        const values = nominatimToValues(item);
        return {
          id: String(item.place_id ?? item.display_name),
          displayName: item.display_name ?? formatAddressSummary(values),
          latitude: parseFloat(item.lat!),
          longitude: parseFloat(item.lon!),
          values,
        };
      })
      .filter((s) => s.values.rua.trim().length > 0);
  } catch {
    return [];
  }
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
  const suggestions = await searchAddressSuggestions(query);
  const autoSelected = suggestions.length === 1 ? suggestions[0] : null;
  return { suggestions, autoSelected };
}
