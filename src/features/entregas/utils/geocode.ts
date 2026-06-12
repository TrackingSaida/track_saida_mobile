/**
 * Geocoding — façade que delega ao geocoder strict quando possível.
 */
import type { AddressFormValues } from "../components/AddressForm";
import type { CoordPrecision, EntregaListItem } from "../types";
import {
  extractAddressFields,
  resolveGeocodeDefaults,
  valuesFromEnderecoFormatado,
} from "./addressBuild";
import { isValidGeocodeCoords } from "./coordsUtils";
import { geocodeAddressStrict } from "./geocodeStrict";

export { isValidGeocodeCoords } from "./coordsUtils";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/** Geocode estruturado — delega ao strict (sem limit=1 sem validação). */
export async function geocodeAddressFromValues(
  vals: Partial<AddressFormValues>,
  defaults?: { cidade?: string; estado?: string }
): Promise<GeocodeResult | null> {
  const cidade = (vals.cidade ?? defaults?.cidade ?? "").trim();
  const estado = (vals.estado ?? defaults?.estado ?? "").trim();
  const rua = (vals.rua ?? "").trim();
  if (!cidade || !estado || rua.length < 3) return null;

  const result = await geocodeAddressStrict({
    rua,
    numero: (vals.numero ?? "").trim(),
    bairro: (vals.bairro ?? "").trim(),
    cidade,
    estado,
    cep: (vals.cep ?? "").trim(),
  });
  if (!result) return null;
  return { latitude: result.latitude, longitude: result.longitude };
}

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

/** Geocode unificado para entregas — usa geocodeAddressStrict. */
export async function geocodeDelivery(
  d: EntregaListItem,
  defaults?: { cidade?: string; estado?: string }
): Promise<GeocodeResult | null> {
  const merged = resolveGeocodeDefaults(d, defaults?.cidade, defaults?.estado);
  const fields = extractAddressFields(d);
  if (merged.cidade) fields.cidade = merged.cidade;
  if (merged.estado) fields.estado = merged.estado;

  const result = await geocodeAddressStrict(fields);
  if (!result) return null;
  return { latitude: result.latitude, longitude: result.longitude };
}

export { resolveGeocodeDefaults };

/** Texto livre — só quando já contém cidade (via strict parse). Retorna null se incompleto. */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address.trim();
  if (!q || q.length < 15) return null;
  const parts = q.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  const result = await geocodeAddressStrict({
    rua: parts[0],
    numero: parts[1] ?? "",
    bairro: parts.length > 5 ? parts[2] : "",
    cidade: parts[parts.length - 3] ?? "",
    estado: parts[parts.length - 2] ?? "",
    cep: parts[parts.length - 1] ?? "",
  });
  if (!result) return null;
  return { latitude: result.latitude, longitude: result.longitude };
}
