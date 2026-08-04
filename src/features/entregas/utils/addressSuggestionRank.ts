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

export type BairroMatchLevel = "equal" | "partial" | "conflict" | "unknown";

export type PickBestAddressOptions = {
  /** Bairro informado pelo usuário (digitado/ditado). */
  userBairro?: string | null;
};

function normalizeCep(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : digits;
}

export function isGooglePendingRankable(s: RankableAddressSuggestion): boolean {
  return Boolean(s.requiresPlaceDetails && s.placeId && s.provider === "google_places");
}

/** Compara bairro do usuário com o da sugestão (fuzzy simples). */
export function compareBairro(
  userBairro: string | null | undefined,
  suggestionBairro: string | null | undefined
): BairroMatchLevel {
  const a = normalizeStreet(userBairro ?? "");
  const b = normalizeStreet(suggestionBairro ?? "");
  if (!a || !b) return "unknown";
  if (a === b) return "equal";
  if (a.includes(b) || b.includes(a)) return "partial";

  const tokensA = a.split(" ").filter((t) => t.length > 2);
  const tokensB = b.split(" ").filter((t) => t.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return "conflict";

  const setB = new Set(tokensB);
  const overlap = tokensA.filter((t) => setB.has(t)).length;
  const ratio = overlap / Math.max(tokensA.length, tokensB.length);
  if (ratio >= 0.6) return "partial";
  return "conflict";
}

export function hasBairroConflict(
  userBairro: string | null | undefined,
  suggestionBairro: string | null | undefined
): boolean {
  return compareBairro(userBairro, suggestionBairro) === "conflict";
}

/** Identidade física aproximada (rua + número + bairro + cidade + UF). */
export function addressIdentityKey(s: RankableAddressSuggestion): string {
  const v = s.values;
  const rua = normalizeStreet(v.rua ?? "");
  const numero = normalizeNumero(v.numero ?? "");
  const bairro = normalizeStreet(v.bairro ?? "");
  const cidade = normalizeStreet(v.cidade ?? "");
  const estado = (normalizeEstadoUf(v.estado) || "").toUpperCase();
  if (!rua && !numero) return "";
  return [rua, numero, bairro, cidade, estado].join("|");
}

/**
 * Chave de rua+número+cidade (sem bairro) — útil para detectar ambiguidade de bairro.
 */
export function addressStreetNumberKey(s: RankableAddressSuggestion): string {
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
 * Retorna null se o empate for ambíguo (ruas/números diferentes sem gap forte)
 * ou se o bairro do usuário divergir do da sugestão (não auto-aplicar).
 */
export function pickBestAddressSuggestion<T extends RankableAddressSuggestion>(
  list: T[],
  opts?: PickBestAddressOptions
): T | null {
  const selectable = list.filter((s) => !isGooglePendingRankable(s));
  if (selectable.length === 0) return null;
  if (selectable.length === 1) {
    const only = selectable[0];
    if (opts?.userBairro && hasBairroConflict(opts.userBairro, only.values.bairro)) {
      return null;
    }
    return only;
  }

  const ranked = rankAddressSuggestions(selectable);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || !second) {
    if (best && opts?.userBairro && hasBairroConflict(opts.userBairro, best.values.bairro)) {
      return null;
    }
    return best ?? null;
  }

  const gap = suggestionCompletenessScore(best) - suggestionCompletenessScore(second);
  const bestKey = addressIdentityKey(best);
  const sameIdentity = Boolean(bestKey) && bestKey === addressIdentityKey(second);
  const sameStreetNumber =
    Boolean(addressStreetNumberKey(best)) &&
    addressStreetNumberKey(best) === addressStreetNumberKey(second);
  const sameCoords = suggestionsCoordsNearlySame(best, second);

  // Mesma rua/número com bairros diferentes = ambiguidade (não auto-aplicar).
  if (sameStreetNumber && !sameIdentity) {
    return null;
  }

  let winner: T | null = null;
  if (sameIdentity || sameCoords) winner = best;
  else if (gap >= 15) winner = best;
  else if ((best.confidence ?? 0) >= 0.9 && (second.confidence ?? 0) <= 0.65) {
    winner = best;
  }

  if (
    winner &&
    opts?.userBairro &&
    hasBairroConflict(opts.userBairro, winner.values.bairro)
  ) {
    return null;
  }

  return winner;
}

/** Melhor sugestão para destaque visual (mesmo com conflito de bairro). */
export function pickRecommendedAddressSuggestion<T extends RankableAddressSuggestion>(
  list: T[],
  opts?: PickBestAddressOptions
): T | null {
  const auto = pickBestAddressSuggestion(list, opts);
  if (auto) return auto;
  const selectable = rankAddressSuggestions(list.filter((s) => !isGooglePendingRankable(s)));
  if (selectable.length === 0) return null;

  const userBairro = opts?.userBairro;
  if (userBairro) {
    const matching = selectable.find(
      (s) => compareBairro(userBairro, s.values.bairro) !== "conflict"
    );
    if (matching) return matching;
  }
  return selectable[0] ?? null;
}
