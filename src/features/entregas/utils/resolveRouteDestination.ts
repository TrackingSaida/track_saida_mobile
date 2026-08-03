/**
 * Resolve coordenadas do destino final da rota.
 * Preferência: sugestões/backend (mesmo fluxo dos pacotes); fallback Nominatim.
 */
import type { MotoboyHomeAddress } from "../api";
import { formatMotoboyHomeAddress } from "../api";
import { buildFullAddressFromFields } from "./addressBuild";
import { geocodeAddressFromValues, isValidGeocodeCoords } from "./geocode";
import {
  AddressSearchError,
  isGooglePendingSuggestion,
  pickBestAddressSuggestion,
  resolveGooglePlaceSuggestion,
  searchAddressSuggestions,
  type AddressSuggestion,
} from "./addressSuggestions";

export type RouteDestinationResolveOk = {
  ok: true;
  latitude: number;
  longitude: number;
  source: string;
};

export type RouteDestinationResolveFail = {
  ok: false;
  reason: "unavailable" | "no_match";
};

export type RouteDestinationResolveResult = RouteDestinationResolveOk | RouteDestinationResolveFail;

function suggestionHasCoords(s: AddressSuggestion | null | undefined): boolean {
  return !!s && isValidGeocodeCoords(s.latitude, s.longitude);
}

async function finalizeSuggestion(
  suggestion: AddressSuggestion,
  query: string,
  address: MotoboyHomeAddress
): Promise<RouteDestinationResolveOk | null> {
  let resolved = suggestion;
  if (isGooglePendingSuggestion(suggestion) || suggestion.requiresPlaceDetails) {
    const detailed = await resolveGooglePlaceSuggestion(suggestion, {
      query,
      defaults: { cidade: address.cidade, estado: address.estado },
    });
    if (!detailed) return null;
    resolved = detailed;
  }
  if (!isValidGeocodeCoords(resolved.latitude, resolved.longitude)) return null;
  return {
    ok: true,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    source: resolved.provider || "sugestoes",
  };
}

export async function resolveRouteDestinationCoords(
  address: MotoboyHomeAddress
): Promise<RouteDestinationResolveResult> {
  const query =
    formatMotoboyHomeAddress(address) ||
    buildFullAddressFromFields({
      rua: address.rua,
      numero: address.numero,
      bairro: address.bairro,
      cidade: address.cidade,
      estado: address.estado,
      cep: address.cep,
    });

  let serviceUnavailable = false;

  if (query.trim().length >= 5) {
    try {
      const result = await searchAddressSuggestions(query, {
        limit: 5,
        hints: {
          rua: address.rua,
          numero: address.numero,
          bairro: address.bairro,
          cidade: address.cidade,
          estado: address.estado,
          cep: address.cep,
        },
        defaults: { cidade: address.cidade, estado: address.estado },
      });
      const best: AddressSuggestion | null =
        pickBestAddressSuggestion(result.suggestions) ||
        result.didYouMean ||
        result.suggestions.find(
          (s) => suggestionHasCoords(s) || !!s.requiresPlaceDetails || isGooglePendingSuggestion(s)
        ) ||
        null;

      if (best) {
        const finalized = await finalizeSuggestion(best, query, address);
        if (finalized) return finalized;
      }
    } catch (e) {
      if (e instanceof AddressSearchError) {
        serviceUnavailable = true;
      }
      // continua para fallback Nominatim
    }
  }

  try {
    const geo = await geocodeAddressFromValues({
      rua: address.rua,
      numero: address.numero,
      complemento: address.complemento,
      bairro: address.bairro,
      cidade: address.cidade,
      estado: address.estado,
      cep: address.cep,
      destinatario: "",
    });
    if (geo && isValidGeocodeCoords(geo.latitude, geo.longitude)) {
      return {
        ok: true,
        latitude: geo.latitude,
        longitude: geo.longitude,
        source: geo.source || "nominatim",
      };
    }
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  return { ok: false, reason: serviceUnavailable ? "unavailable" : "no_match" };
}
