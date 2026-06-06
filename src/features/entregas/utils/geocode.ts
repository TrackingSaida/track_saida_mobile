/**
 * Geocoding via Nominatim (OpenStreetMap) para obter lat/long a partir do endereço.
 */
import type { AddressFormValues } from "../components/AddressForm";
import {
  buildNominatimStructuredSearchUrl,
  buildSearchQuery,
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

/** Geocode estruturado a partir dos campos do formulário (sem duplicar partes do endereço). */
export async function geocodeAddressFromValues(
  vals: Partial<AddressFormValues>,
  defaults?: { cidade?: string; estado?: string }
): Promise<GeocodeResult | null> {
  const rua = (vals.rua ?? "").trim();
  const numero = (vals.numero ?? "").trim();

  if (rua.length > 2 && numero.length > 0) {
    const structured = await fetchNominatimGeocode(
      buildNominatimStructuredSearchUrl(vals, defaults, 1)
    );
    if (structured) return structured;
  }

  const query = buildSearchQuery(vals, defaults);
  if (query.trim().length >= 6) {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
    const freeText = await fetchNominatimGeocode(url);
    if (freeText) return freeText;
  }

  return null;
}

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
