import { normalizeEstadoUf } from "./addressQueryNormalizer";

/** Normaliza texto para comparação (sem acento, lowercase, trim). */
export function normalizeForCompare(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCepDigits(cep?: string | null): string {
  return (cep ?? "").replace(/\D/g, "").slice(0, 8);
}

export type NominatimAddressFields = Record<string, string>;

const UF_FROM_ISO: Record<string, string> = {
  "BR-AC": "AC",
  "BR-AL": "AL",
  "BR-AP": "AP",
  "BR-AM": "AM",
  "BR-BA": "BA",
  "BR-CE": "CE",
  "BR-DF": "DF",
  "BR-ES": "ES",
  "BR-GO": "GO",
  "BR-MA": "MA",
  "BR-MT": "MT",
  "BR-MS": "MS",
  "BR-MG": "MG",
  "BR-PA": "PA",
  "BR-PB": "PB",
  "BR-PR": "PR",
  "BR-PE": "PE",
  "BR-PI": "PI",
  "BR-RJ": "RJ",
  "BR-RN": "RN",
  "BR-RS": "RS",
  "BR-RO": "RO",
  "BR-RR": "RR",
  "BR-SC": "SC",
  "BR-SP": "SP",
  "BR-SE": "SE",
  "BR-TO": "TO",
};

export function nominatimStateUf(addr: NominatimAddressFields): string {
  const iso = addr["ISO3166-2-lvl4"];
  const uf = normalizeEstadoUf(addr.state, iso);
  if (uf) return uf;
  if (iso && UF_FROM_ISO[iso]) return UF_FROM_ISO[iso];
  return (addr.state ?? "").trim().toUpperCase().slice(0, 2);
}

export function nominatimCity(addr: NominatimAddressFields): string {
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    ""
  ).trim();
}

/** Compara UF informada com campos Nominatim. */
export function statesMatch(expectedEstado: string, addr: NominatimAddressFields): boolean {
  const expectedUf = normalizeEstadoUf(expectedEstado);
  if (!expectedUf || expectedUf.length !== 2) return false;
  const candidateUf = nominatimStateUf(addr);
  if (candidateUf && candidateUf === expectedUf) return true;
  const stateNorm = normalizeForCompare(addr.state ?? "");
  const expectedNorm = normalizeForCompare(expectedEstado);
  return Boolean(stateNorm && expectedNorm && stateNorm.includes(expectedNorm));
}

/** Compara cidade informada com campos Nominatim. */
export function citiesMatch(expectedCidade: string, addr: NominatimAddressFields): boolean {
  const expected = normalizeForCompare(expectedCidade);
  if (!expected) return false;
  const city = normalizeForCompare(nominatimCity(addr));
  if (!city) return false;
  return city === expected || city.includes(expected) || expected.includes(city);
}

/** País deve ser Brasil. */
export function countryIsBrazil(addr: NominatimAddressFields): boolean {
  const country = normalizeForCompare(addr.country ?? "");
  const code = (addr.country_code ?? "").trim().toLowerCase();
  return code === "br" || country === "brasil" || country === "brazil";
}

/** CEP: primeiros 5 dígitos devem bater quando ambos informados. */
export function cepPrefixMatches(
  expectedCep: string,
  addr: NominatimAddressFields
): boolean {
  const exp = normalizeCepDigits(expectedCep);
  if (exp.length < 5) return true;
  const got = normalizeCepDigits(addr.postcode);
  if (got.length < 5) return true;
  return exp.slice(0, 5) === got.slice(0, 5);
}
