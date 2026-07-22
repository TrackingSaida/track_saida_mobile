import type { AddressFormValues } from "../components/AddressForm";
import { normalizeEstadoUf } from "./addressQueryNormalizer";
import { haversineDistanceKm, isValidGeocodeCoords } from "./coordsUtils";
import { normalizeNumero, normalizeStreet } from "./routeUtils";

/** Subconjunto mínimo para ranking / auto-seleção de sugestões. */
export type RankableAddressSuggestion = {
  id: string;
  latitude: number;
  longitude: number;
  values: AddressFormValues;
  provider?: string;
  confidence?: number;
  distanceKm?: number | null;
  badge?: string | null;
  alreadyUsed?: boolean;
  placeId?: string;
  requiresPlaceDetails?: boolean;
};

function normalizeCep(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : digits;
}

export function isGooglePendingRankable(s: RankableAddressSuggestion): boolean {
  return Boolean(s.requiresPlaceDetails && s.placeId && s.provider === "google_places");
}

/** Identidade física aproximada (rua + número + cidade + UF). */
export function addressIdentityKey(s: RankableAddressSuggestion): string {
  const v = s.values;
  const rua = normalizeStreet(v.rua ?? "");
  const numero = normalizeNumero(v.numero ?? "");
  const cidade = normalizeStreet(v.cidade ?? "");
  const estado = (normalizeEstadoUf(v.estado) || "").toUpperCase();
  if (!rua && !numero) return "";
  return [rua, numero, cidade, estado].join("|");
}

/**
 * Completude/qualidade da sugestão para desempatar opções quase iguais.
 * CEP completo e histórico local pesam mais; km até a base é só desempate fraco.
 */
export function suggestionCompletenessScore(s: RankableAddressSuggestion): number {
  const v = s.values;
  let score = 0;
  if ((v.rua ?? "").trim()) score += 10;
  if ((v.numero ?? "").trim()) score += 15;
  if ((v.bairro ?? "").trim()) score += 5;
  if ((v.cidade ?? "").trim()) score += 10;
  if ((normalizeEstadoUf(v.estado) || "").length === 2) score += 5;
  if (normalizeCep(v.cep ?? "").length === 8) score += 20;
  if (s.provider === "local" || s.alreadyUsed) score += 25;
  if (s.provider === "google_places") score += 8;
  if (s.badge === "frequente") score += 12;
  if (typeof s.confidence === "number" && Number.isFinite(s.confidence)) {
    score += s.confidence * 30;
  }
  if (s.distanceKm != null && Number.isFinite(s.distanceKm)) {
    score += Math.max(0, 3 - s.distanceKm / 20);
  }
  return score;
}

function suggestionsCoordsNearlySame(
  a: RankableAddressSuggestion,
  b: RankableAddressSuggestion,
  maxMeters = 80
): boolean {
  if (!isValidGeocodeCoords(a.latitude, a.longitude)) return false;
  if (!isValidGeocodeCoords(b.latitude, b.longitude)) return false;
  return haversineDistanceKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000 <= maxMeters;
}

export function rankAddressSuggestions<T extends RankableAddressSuggestion>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const diff = suggestionCompletenessScore(b) - suggestionCompletenessScore(a);
    if (diff !== 0) return diff;
    return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
  });
}

/**
 * Escolhe a melhor sugestão quando há vencedor claro.
 * Retorna null se o empate for ambíguo (ruas/números diferentes sem gap forte).
 */
export function pickBestAddressSuggestion<T extends RankableAddressSuggestion>(
  list: T[]
): T | null {
  const selectable = list.filter((s) => !isGooglePendingRankable(s));
  if (selectable.length === 0) return null;
  if (selectable.length === 1) return selectable[0];

  const ranked = rankAddressSuggestions(selectable);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || !second) return best ?? null;

  const gap = suggestionCompletenessScore(best) - suggestionCompletenessScore(second);
  const bestKey = addressIdentityKey(best);
  const sameIdentity = Boolean(bestKey) && bestKey === addressIdentityKey(second);
  const sameCoords = suggestionsCoordsNearlySame(best, second);

  if (sameIdentity || sameCoords) return best;
  if (gap >= 15) return best;
  if ((best.confidence ?? 0) >= 0.9 && (second.confidence ?? 0) <= 0.65) {
    return best;
  }

  return null;
}
