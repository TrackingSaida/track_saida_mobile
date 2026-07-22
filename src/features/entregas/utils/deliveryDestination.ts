/**
 * Resolução unificada de destino para mapa, OSRM, Google Maps e Waze.
 *
 * - Usar lat/lon: confidence alta ou media + coords válidas + validação ok.
 * - Usar addressText: sem coord confiável, mas endereço estruturado completo.
 * - Rejeitar: cidade/estado ausentes, geocode strict falhou, validação legado falhou.
 */
import type { EntregaListItem } from "../types";
import {
  buildFullAddress,
  extractAddressFields,
  hasCompleteAddressText,
  hasMinimumAddressForGeocode,
} from "./addressBuild";
import { haversineDistanceKm, isValidNavigationCoords } from "./coordsUtils";
import { geocodeAddressStrictDetailed, reverseGeocodeValidate } from "./geocodeStrict";

export type DestinationGroupInput = {
  deliveries: EntregaListItem[];
  representativeDelivery: EntregaListItem;
};

export type DestinationConfidence = "alta" | "media" | "baixa" | "rejeitada";
export type DestinationSource = "api_trusted" | "app_geocoded" | "address_text" | "none";

export type DeliveryResolvedDestination = {
  latitude?: number;
  longitude?: number;
  addressText: string;
  hasTrustedCoords: boolean;
  source: DestinationSource;
  confidence: DestinationConfidence;
  reviewMessage?: string;
  /** Origem do endereço salvo (mapa, google_places, suggestion...), só quando source = api_trusted. */
  coordsOrigem?: string;
  /** Endereço textual completo (rua + cidade + estado) e com número informado. */
  addressHasNumber: boolean;
};

export type GeocodedCoordsMap = Record<number, { latitude: number; longitude: number }>;

export type GeocodedMetaMap = Record<
  number,
  {
    confidence: DestinationConfidence;
    source: "app_geocoded";
    validated: boolean;
  }
>;

/** Cache de validação de coords legadas (preenchido async por validateStoredCoordsAgainstAddress). */
export type LegacyValidationCache = Record<number, DestinationConfidence>;

export const REVIEW_MESSAGE_UNCONFIRMED =
  "Endereço salvo, mas coordenada não confirmada. Revise cidade/CEP/número antes de navegar.";

export const REVIEW_MESSAGE_INSUFFICIENT =
  "Endereço insuficiente para navegação. Informe rua, número, cidade e estado.";

export { buildFullAddress, hasMinimumAddressForGeocode, hasCompleteAddressText };

/** Mapeia metadados da API para confiança do app. */
export function mapApiConfidence(d: EntregaListItem): DestinationConfidence {
  const precision = (d.coord_precision ?? "").toLowerCase();
  const origem = (d.endereco_origem ?? "").toLowerCase();
  const source = (d.geocode_source ?? "").toLowerCase();

  if (precision === "approx") return "baixa";
  if (precision === "street") return "media";
  if (precision === "rooftop") {
    if (origem === "google_places" || origem === "mapa") return "alta";
    if (
      source === "google" ||
      source === "nominatim" ||
      source === "nominatim_strict" ||
      source === "geoapify" ||
      source === "geocode_provider"
    ) {
      return "alta";
    }
    return "alta";
  }

  if (d.latitude != null && d.longitude != null) return "media";
  return "rejeitada";
}

function isTrustedConfidence(c: DestinationConfidence): boolean {
  return c === "alta" || c === "media";
}

function resolveApiCoords(
  d: EntregaListItem,
  legacyCache?: LegacyValidationCache
): { confidence: DestinationConfidence; trusted: boolean } {
  let confidence = mapApiConfidence(d);
  const cached = legacyCache?.[d.id_saida];
  if (cached) confidence = cached;

  if (confidence === "baixa" || confidence === "rejeitada") {
    return { confidence, trusted: false };
  }

  if (!isValidNavigationCoords(d.latitude, d.longitude)) {
    return { confidence: "rejeitada", trusted: false };
  }

  const isLegacy =
    !d.geocode_source &&
    !d.coord_precision &&
    d.latitude != null &&
    d.longitude != null;

  if (isLegacy && !cached) {
    return { confidence: "media", trusted: true };
  }

  return { confidence, trusted: isTrustedConfidence(confidence) };
}

/**
 * Única fonte de verdade para destino de entrega.
 * Síncrono; validação legado async deve popular legacyCache antes.
 */
export function resolveDeliveryDestination(
  d: EntregaListItem,
  geocodedCoords: GeocodedCoordsMap = {},
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): DeliveryResolvedDestination {
  const addressText = buildFullAddress(d);
  const completeText = hasCompleteAddressText(d);
  const addressHasNumber =
    completeText && extractAddressFields(d).numero.length > 0;

  const api = resolveApiCoords(d, legacyCache);
  if (api.trusted && isValidNavigationCoords(d.latitude, d.longitude)) {
    return {
      latitude: d.latitude!,
      longitude: d.longitude!,
      addressText,
      hasTrustedCoords: true,
      source: "api_trusted",
      confidence: api.confidence,
      coordsOrigem: (d.endereco_origem ?? "").trim().toLowerCase() || undefined,
      addressHasNumber,
    };
  }

  const meta = geocodedMeta[d.id_saida];
  const geo = geocodedCoords[d.id_saida];
  if (
    meta?.validated &&
    isTrustedConfidence(meta.confidence) &&
    geo &&
    isValidNavigationCoords(geo.latitude, geo.longitude)
  ) {
    return {
      latitude: geo.latitude,
      longitude: geo.longitude,
      addressText,
      hasTrustedCoords: true,
      source: "app_geocoded",
      confidence: meta.confidence,
      addressHasNumber,
    };
  }

  if (completeText && addressText.length > 10) {
    return {
      addressText,
      hasTrustedCoords: false,
      source: "address_text",
      confidence: api.confidence === "baixa" ? "baixa" : "rejeitada",
      reviewMessage: REVIEW_MESSAGE_UNCONFIRMED,
      addressHasNumber,
    };
  }

  return {
    addressText: addressText || "—",
    hasTrustedCoords: false,
    source: "none",
    confidence: "rejeitada",
    reviewMessage: REVIEW_MESSAGE_INSUFFICIENT,
    addressHasNumber: false,
  };
}

export function resolveGroupDestination(
  group: DestinationGroupInput,
  geocodedCoords: GeocodedCoordsMap = {},
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): DeliveryResolvedDestination {
  for (const d of group.deliveries) {
    const dest = resolveDeliveryDestination(d, geocodedCoords, geocodedMeta, legacyCache);
    if (dest.hasTrustedCoords) return dest;
  }
  return resolveDeliveryDestination(
    group.representativeDelivery,
    geocodedCoords,
    geocodedMeta,
    legacyCache
  );
}

/** Fontes de geocode validadas (não precisam de revalidação client-side). */
const TRUSTED_GEOCODE_SOURCES = new Set([
  "google_places",
  "mapa",
  "nominatim_strict",
  "google",
  "geocode_provider",
]);

export function isTrustedGeocodeSource(source?: string | null): boolean {
  return TRUSTED_GEOCODE_SOURCES.has((source ?? "").trim().toLowerCase());
}

/** Registro precisa de validação client-side das coords persistidas? */
export function needsStoredCoordsValidation(d: EntregaListItem): boolean {
  if (d.latitude == null || d.longitude == null) return false;
  if (d.coord_precision === "rooftop") return false;
  if (isTrustedGeocodeSource(d.geocode_source)) return false;
  return true;
}

/**
 * Valida coords persistidas de fonte não confiável (async) — popular legacyCache na tela.
 * - Coords que batem com o endereço (reverse ou strict < 2 km) → "media".
 * - Coords que não batem (Nominatim respondeu) → "rejeitada".
 * - Serviço indisponível → mantém confiança atual (não esconde pin por falha de rede).
 * - Registros `approx` sem validação possível mantêm "baixa".
 */
export async function validateStoredCoordsAgainstAddress(
  d: EntregaListItem
): Promise<DestinationConfidence> {
  if (!isValidNavigationCoords(d.latitude, d.longitude)) return "rejeitada";
  const isApprox = d.coord_precision === "approx";
  const baseline = mapApiConfidence(d);
  if (!needsStoredCoordsValidation(d)) {
    return baseline;
  }
  if (!hasMinimumAddressForGeocode(d)) {
    return isApprox ? baseline : "media";
  }

  const fields = extractAddressFields(d);
  const reverse = await reverseGeocodeValidate(d.latitude!, d.longitude!, fields);
  if (reverse === true) return "media";
  if (reverse === null) return baseline;

  const strict = await geocodeAddressStrictDetailed(fields);
  if (strict.status === "ok") {
    if (
      haversineDistanceKm(
        d.latitude!,
        d.longitude!,
        strict.result.latitude,
        strict.result.longitude
      ) < 2
    ) {
      return "media";
    }
    return isApprox ? baseline : "rejeitada";
  }
  if (strict.status === "unavailable") return baseline;

  return isApprox ? baseline : "rejeitada";
}

export function countUntrustedDeliveries(
  deliveries: EntregaListItem[],
  geocodedCoords: GeocodedCoordsMap = {},
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): number {
  let count = 0;
  for (const d of deliveries) {
    const dest = resolveDeliveryDestination(d, geocodedCoords, geocodedMeta, legacyCache);
    if (!dest.hasTrustedCoords) count++;
  }
  return count;
}
