/**
 * Geocoding via Nominatim (OpenStreetMap) para obter lat/long a partir do endereço.
 */
import type { AddressFormValues } from "../components/AddressForm";
import type { CoordPrecision, EntregaListItem } from "../types";
import {
  buildNominatimStructuredSearchUrl,
  buildSearchQuery,
  resolveGeocodeDefaults,
  valuesFromEnderecoFormatado,
} from "./addressSuggestions";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export function isValidGeocodeCoords(
  latitude?: number | null,
  longitude?: number | null
): boolean {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

async function fetchNominatimGeocode(url: string): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TrackSaidaMobile/1.0" },
    });
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const first = data?.[0];
    if (first?.lat != null && first?.lon != null) {
      const latitude = parseFloat(first.lat);
      const longitude = parseFloat(first.lon);
      if (isValidGeocodeCoords(latitude, longitude)) {
        return { latitude, longitude };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function resolvedCityState(
  vals: Partial<AddressFormValues>,
  defaults?: { cidade?: string; estado?: string }
): { cidade: string; estado: string } {
  return {
    cidade: (vals.cidade ?? defaults?.cidade ?? "").trim(),
    estado: (vals.estado ?? defaults?.estado ?? "").trim(),
  };
}

/** Geocode estruturado a partir dos campos do formulário (sem duplicar partes do endereço). */
export async function geocodeAddressFromValues(
  vals: Partial<AddressFormValues>,
  defaults?: { cidade?: string; estado?: string },
  options?: { enderecoFormatado?: string }
): Promise<GeocodeResult | null> {
  const formatted = (options?.enderecoFormatado ?? "").trim();
  if (formatted.length >= 10) {
    const fromFormatted = await geocodeAddress(formatted);
    if (fromFormatted) return fromFormatted;
  }

  const rua = (vals.rua ?? "").trim();
  const numero = (vals.numero ?? "").trim();
  const { cidade, estado } = resolvedCityState(vals, defaults);
  const hasCep = (vals.cep ?? "").replace(/\D/g, "").length >= 8;

  if (rua.length > 2 && numero.length > 0 && cidade.length > 0) {
    const structured = await fetchNominatimGeocode(
      buildNominatimStructuredSearchUrl(vals, { cidade, estado }, 1)
    );
    if (structured) return structured;
  }

  if (!cidade && !hasCep) return null;

  const query = buildSearchQuery(vals, { cidade, estado });
  if (query.trim().length >= 6) {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
    const freeText = await fetchNominatimGeocode(url);
    if (freeText) return freeText;
  }

  return null;
}

/** Campos estruturados a partir de EntregaListItem (rua separada de número/complemento). */
export function deliveryToGeocodeValues(d: EntregaListItem): Partial<AddressFormValues> {
  const parsedFmt = d.endereco_formatado
    ? valuesFromEnderecoFormatado(d.endereco_formatado)
    : null;

  const endereco = (d.endereco ?? "").trim();
  const numero = (d.numero ?? "").trim();
  const parts = endereco.split(",").map((p) => p.trim()).filter(Boolean);
  let rua = parsedFmt?.rua ?? parts[0] ?? "";
  if (!rua && endereco) rua = endereco;
  if (rua === numero && parts.length > 1) rua = parts[1] ?? rua;

  return {
    rua,
    numero: (parsedFmt?.numero ?? numero) || undefined,
    bairro: (parsedFmt?.bairro ?? d.bairro ?? "").trim() || undefined,
    cidade: (d.cidade ?? parsedFmt?.cidade ?? "").trim() || undefined,
    estado: (d.estado ?? parsedFmt?.estado ?? "").trim() || undefined,
    cep: (parsedFmt?.cep ?? d.cep ?? "").trim() || undefined,
  };
}

export function inferCoordPrecision(origem: string): CoordPrecision {
  const o = origem.toLowerCase();
  if (o === "google_places" || o === "mapa") return "rooftop";
  if (o === "suggestion" || o === "autocomplete") return "street";
  return "approx";
}

/** Geocode unificado para entregas (rota, pendentes, store). */
export async function geocodeDelivery(
  d: EntregaListItem,
  defaults?: { cidade?: string; estado?: string }
): Promise<GeocodeResult | null> {
  const vals = deliveryToGeocodeValues(d);
  const mergedDefaults = resolveGeocodeDefaults(
    d,
    defaults?.cidade,
    defaults?.estado
  );
  const hasRua = (vals.rua ?? "").trim().length > 2;
  const hasCep = (vals.cep ?? "").replace(/\D/g, "").length >= 8;
  if (!hasRua && !hasCep) return null;

  const formatted = (d.endereco_formatado ?? "").trim();
  if (formatted.length >= 10) {
    const fromFormatted = await geocodeAddress(formatted);
    if (fromFormatted) return fromFormatted;
  }

  return geocodeAddressFromValues(vals, mergedDefaults, {
    enderecoFormatado: formatted,
  });
}

export { resolveGeocodeDefaults };

/** Geocode por texto livre (importação em massa, linha única). */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address.trim();
  if (!q) return null;
  const withCountry = /brasil/i.test(q) ? q : `${q}, Brasil`;
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(withCountry)}&format=json&limit=1&countrycodes=br`;
  return fetchNominatimGeocode(url);
}
