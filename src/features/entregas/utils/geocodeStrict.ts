import { buildFullAddressFromFields, type StructuredAddressInput } from "./addressBuild";
import {
  cepPrefixMatches,
  citiesMatch,
  countryIsBrazil,
  normalizeCepDigits,
  type NominatimAddressFields,
  statesMatch,
} from "./addressNormalize";
import { isValidGeocodeCoords } from "./coordsUtils";

export type StrictGeocodeInput = StructuredAddressInput;

export type StrictGeocodeResult = {
  latitude: number;
  longitude: number;
  confidence: "alta" | "media";
  validated: true;
};

export type StrictGeocodeOutcome =
  | { status: "ok"; result: StrictGeocodeResult }
  | { status: "no_match" }
  | { status: "unavailable" };

export type NominatimCandidate = {
  lat?: string;
  lon?: string;
  address?: NominatimAddressFields;
  type?: string;
  class?: string;
};

const NOMINATIM_HEADERS = { "User-Agent": "TrackSaidaMobile/1.0" };
const NOMINATIM_MIN_INTERVAL_MS = 1100;

let nominatimQueue: Promise<void> = Promise.resolve();
let lastNominatimRequestAt = 0;

function scheduleNominatimRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const now = Date.now();
    const waitMs = Math.max(0, lastNominatimRequestAt + NOMINATIM_MIN_INTERVAL_MS - now);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastNominatimRequestAt = Date.now();
    return fn();
  };
  const task = nominatimQueue.then(run, run);
  nominatimQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

/** Valida candidato Nominatim contra entrada estruturada. */
export function validateGeocodeCandidate(
  candidate: NominatimCandidate,
  input: StrictGeocodeInput
): boolean {
  const addr = candidate.address ?? {};
  const cidade = (input.cidade ?? "").trim();
  const estado = (input.estado ?? "").trim();
  const cep = normalizeCepDigits(input.cep);

  if (!countryIsBrazil(addr)) return false;
  if (!statesMatch(estado, addr)) return false;
  if (!citiesMatch(cidade, addr)) return false;
  if (cep.length >= 5 && !cepPrefixMatches(cep, addr)) return false;

  const lat = parseFloat(candidate.lat ?? "");
  const lon = parseFloat(candidate.lon ?? "");
  return isValidGeocodeCoords(lat, lon);
}

function inferStrictConfidence(candidate: NominatimCandidate): "alta" | "media" {
  const addr = candidate.address ?? {};
  const house = (addr.house_number ?? "").trim();
  const numero = (candidate.address?.house_number ?? "").trim();
  const typ = (candidate.type ?? "").toLowerCase();
  if (house || numero || typ === "house" || typ === "building") return "alta";
  return "media";
}

/** null = serviço indisponível; [] = resposta válida sem candidatos. */
async function fetchNominatimCandidates(query: string): Promise<NominatimCandidate[] | null> {
  return scheduleNominatimRequest(async () => {
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        addressdetails: "1",
        limit: "5",
        dedupe: "1",
        countrycodes: "br",
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: NOMINATIM_HEADERS }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as NominatimCandidate[];
      return Array.isArray(data) ? data : [];
    } catch {
      return null;
    }
  });
}

/**
 * Geocoder strict com outcome explícito (ok / no_match / unavailable).
 */
export async function geocodeAddressStrictDetailed(
  input: StrictGeocodeInput
): Promise<StrictGeocodeOutcome> {
  const cidade = (input.cidade ?? "").trim();
  const estado = (input.estado ?? "").trim();
  const rua = (input.rua ?? "").trim();

  if (!cidade || !estado || rua.length < 3) return { status: "no_match" };

  const query = buildFullAddressFromFields(input);
  const candidates = await fetchNominatimCandidates(query);
  if (candidates === null) return { status: "unavailable" };

  for (const candidate of candidates) {
    if (!validateGeocodeCandidate(candidate, input)) continue;
    const latitude = parseFloat(candidate.lat!);
    const longitude = parseFloat(candidate.lon!);
    if (!isValidGeocodeCoords(latitude, longitude)) continue;
    return {
      status: "ok",
      result: {
        latitude,
        longitude,
        confidence: inferStrictConfidence(candidate),
        validated: true,
      },
    };
  }

  return { status: "no_match" };
}

/**
 * Geocoder strict: não aceita primeiro resultado sem validar cidade/estado/CEP.
 * Retorna null se nenhum candidato passar — preferível a coordenada errada.
 */
export async function geocodeAddressStrict(
  input: StrictGeocodeInput
): Promise<StrictGeocodeResult | null> {
  const outcome = await geocodeAddressStrictDetailed(input);
  return outcome.status === "ok" ? outcome.result : null;
}

/**
 * Reverse geocode para validar coords legadas contra cidade/estado salvas.
 * null = serviço indisponível (não conclusivo); false = respondeu e não bate.
 */
export async function reverseGeocodeValidate(
  latitude: number,
  longitude: number,
  input: StrictGeocodeInput
): Promise<boolean | null> {
  return scheduleNominatimRequest(async () => {
    try {
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        format: "json",
        addressdetails: "1",
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params}`,
        { headers: NOMINATIM_HEADERS }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as NominatimCandidate;
      if (!data?.address) return false;
      return validateGeocodeCandidate(data, input);
    } catch {
      return null;
    }
  });
}
