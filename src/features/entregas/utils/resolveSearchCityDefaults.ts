/**
 * Resolve cidade/UF usadas na busca de endereço (voz/OCR/digitar).
 *
 * Prioridade:
 * 1. Preferência manual do motoboy (forçar cidade)
 * 2. Cidade atual pelo GPS do aparelho
 * 3. Cidades da operação da sub_base (aprendidas / configuradas)
 * 4. Só estado padrão
 */
import { normalizeEstadoUf } from "./addressQueryNormalizer";
import { normalizeForCompare } from "./addressNormalize";

/** Campos mínimos do reverse geocode (Expo Location). */
export type ReverseGeocodePlace = {
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
  name?: string | null;
  region?: string | null;
};

const GPS_CACHE_TTL_MS = 120_000;
let cachedSearchGps: { latitude: number; longitude: number } | null = null;
let cachedSearchGpsAt = 0;

async function getGpsForCity(): Promise<{ latitude: number; longitude: number } | null> {
  const now = Date.now();
  if (cachedSearchGps && now - cachedSearchGpsAt < GPS_CACHE_TTL_MS) {
    return cachedSearchGps;
  }
  try {
    const Location = await import("expo-location");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    cachedSearchGps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    cachedSearchGpsAt = now;
    return cachedSearchGps;
  } catch {
    return cachedSearchGps;
  }
}

export type SearchCity = {
  cidade: string;
  estado: string;
};

export type SearchCitySource = "manual" | "gps" | "sub_base" | "estado" | "none";

export type ResolvedSearchCityDefaults = SearchCity & {
  source: SearchCitySource;
  /** Demais cidades da operação (para tentativas / ranking). */
  cidadesOperacao: SearchCity[];
};

export type ResolveSearchCityInput = {
  cidadePadrao?: string;
  estadoPadrao?: string;
  /** Cidades da sub_base (endpoint ou cache). */
  cidadesOperacao?: SearchCity[];
  /** Se true, ignora cache de GPS/cidade. */
  forceRefresh?: boolean;
};

const CITY_CACHE_TTL_MS = 10 * 60_000;
let cachedGpsCity: (SearchCity & { at: number }) | null = null;
let cachedOperacao: { at: number; cities: SearchCity[]; key: string } | null = null;
let operacaoFetcher: (() => Promise<SearchCity[]>) | null = null;

/** Registra loader de cidades da sub_base (evita ciclo de import com api). */
export function setCidadesOperacaoFetcher(fetcher: (() => Promise<SearchCity[]>) | null): void {
  operacaoFetcher = fetcher;
}

export function clearSearchCityCaches(): void {
  cachedGpsCity = null;
  cachedOperacao = null;
}

function titleCity(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function pickCityFromExpoPlace(place: ReverseGeocodePlace): SearchCity | null {
  const cidadeRaw = (place.city || place.subregion || place.district || place.name || "").trim();
  if (!cidadeRaw) return null;
  // Evita usar nome de rua/logradouro como cidade.
  if (/^\d/.test(cidadeRaw) || /^(rua|avenida|av\.?|travessa)\b/i.test(cidadeRaw)) {
    const alt = (place.city || place.subregion || "").trim();
    if (!alt || alt === cidadeRaw) return null;
  }
  const cidade = titleCity(place.city || place.subregion || place.district || cidadeRaw);
  if (!cidade || cidade.length < 2) return null;
  const estado = normalizeEstadoUf(place.region || "") || "";
  return { cidade, estado };
}

/** Extrai cidade/UF do GPS (reverse geocode nativo). Cache ~10 min. */
export async function resolveCityFromGps(
  options?: { forceRefresh?: boolean }
): Promise<SearchCity | null> {
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    cachedGpsCity &&
    now - cachedGpsCity.at < CITY_CACHE_TTL_MS
  ) {
    return { cidade: cachedGpsCity.cidade, estado: cachedGpsCity.estado };
  }

  const gps = await getGpsForCity();
  if (!gps) return cachedGpsCity ? { cidade: cachedGpsCity.cidade, estado: cachedGpsCity.estado } : null;

  try {
    const Location = await import("expo-location");
    const places = await Location.reverseGeocodeAsync({
      latitude: gps.latitude,
      longitude: gps.longitude,
    });
    for (const place of places ?? []) {
      const city = pickCityFromExpoPlace(place);
      if (city) {
        cachedGpsCity = { ...city, at: now };
        return city;
      }
    }
  } catch {
    // mantém cache antigo se houver
  }

  return cachedGpsCity ? { cidade: cachedGpsCity.cidade, estado: cachedGpsCity.estado } : null;
}

function matchOperacaoCity(
  gps: SearchCity,
  operacao: SearchCity[]
): SearchCity | null {
  const gpsKey = normalizeForCompare(gps.cidade);
  if (!gpsKey) return null;
  for (const c of operacao) {
    const key = normalizeForCompare(c.cidade);
    if (!key) continue;
    if (key === gpsKey || key.includes(gpsKey) || gpsKey.includes(key)) {
      return {
        cidade: c.cidade,
        estado: c.estado || gps.estado,
      };
    }
  }
  return null;
}

async function loadCidadesOperacao(forceRefresh?: boolean): Promise<SearchCity[]> {
  if (!operacaoFetcher) return [];
  const now = Date.now();
  const key = "default";
  if (
    !forceRefresh &&
    cachedOperacao &&
    cachedOperacao.key === key &&
    now - cachedOperacao.at < CITY_CACHE_TTL_MS
  ) {
    return cachedOperacao.cities;
  }
  try {
    const cities = await operacaoFetcher();
    const cleaned = (cities ?? [])
      .map((c) => ({
        cidade: titleCity(c.cidade || ""),
        estado: normalizeEstadoUf(c.estado || "") || "",
      }))
      .filter((c) => c.cidade.length >= 2)
      .slice(0, 5);
    cachedOperacao = { at: now, cities: cleaned, key };
    return cleaned;
  } catch {
    return cachedOperacao?.cities ?? [];
  }
}

/**
 * Resolve defaults para parse/busca.
 * Preferência manual vence (override consciente); senão GPS; senão sub_base.
 */
export async function resolveSearchCityDefaults(
  input: ResolveSearchCityInput = {}
): Promise<ResolvedSearchCityDefaults> {
  const manualCidade = (input.cidadePadrao ?? "").trim();
  const manualEstado = normalizeEstadoUf(input.estadoPadrao || "") || (input.estadoPadrao ?? "").trim();
  const operacao =
    input.cidadesOperacao && input.cidadesOperacao.length > 0
      ? input.cidadesOperacao
      : await loadCidadesOperacao(input.forceRefresh);

  if (manualCidade) {
    return {
      cidade: titleCity(manualCidade),
      estado: manualEstado || operacao[0]?.estado || "SP",
      source: "manual",
      cidadesOperacao: operacao,
    };
  }

  const gps = await resolveCityFromGps({ forceRefresh: input.forceRefresh });
  if (gps?.cidade) {
    const matched = matchOperacaoCity(gps, operacao);
    return {
      cidade: matched?.cidade || gps.cidade,
      estado: matched?.estado || gps.estado || manualEstado || operacao[0]?.estado || "SP",
      source: "gps",
      cidadesOperacao: operacao,
    };
  }

  if (operacao[0]?.cidade) {
    return {
      cidade: operacao[0].cidade,
      estado: operacao[0].estado || manualEstado || "SP",
      source: "sub_base",
      cidadesOperacao: operacao,
    };
  }

  if (manualEstado) {
    return {
      cidade: "",
      estado: manualEstado,
      source: "estado",
      cidadesOperacao: operacao,
    };
  }

  return { cidade: "", estado: "", source: "none", cidadesOperacao: operacao };
}

/** Versão síncrona só com o que já está em cache (útil para parse imediato). */
export function peekCachedSearchCityDefaults(
  input: Pick<ResolveSearchCityInput, "cidadePadrao" | "estadoPadrao"> = {}
): ResolvedSearchCityDefaults {
  const manualCidade = (input.cidadePadrao ?? "").trim();
  const manualEstado = normalizeEstadoUf(input.estadoPadrao || "") || (input.estadoPadrao ?? "").trim();
  const operacao = cachedOperacao?.cities ?? [];

  if (manualCidade) {
    return {
      cidade: titleCity(manualCidade),
      estado: manualEstado || operacao[0]?.estado || "SP",
      source: "manual",
      cidadesOperacao: operacao,
    };
  }
  if (cachedGpsCity?.cidade) {
    return {
      cidade: cachedGpsCity.cidade,
      estado: cachedGpsCity.estado || manualEstado || operacao[0]?.estado || "SP",
      source: "gps",
      cidadesOperacao: operacao,
    };
  }
  if (operacao[0]?.cidade) {
    return {
      cidade: operacao[0].cidade,
      estado: operacao[0].estado || manualEstado || "SP",
      source: "sub_base",
      cidadesOperacao: operacao,
    };
  }
  return {
    cidade: "",
    estado: manualEstado,
    source: manualEstado ? "estado" : "none",
    cidadesOperacao: operacao,
  };
}
