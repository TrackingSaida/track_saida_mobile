import type { AddressFormValues } from "../components/AddressForm";

export type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

function normalizeCepDigits(cep: string): string {
  return cep.replace(/\D/g, "").slice(0, 8);
}

/** Extrai CEP 8 dígitos de texto livre / OCR (inclui "06330 100"). */
export function extractCepDigitsFromText(text: string): string {
  const spaced = text.replace(/\b(\d{5})\s+(\d{3})\b/g, "$1$2");
  const match = spaced.match(/\b(\d{5}-?\d{3})\b/);
  if (!match) return "";
  return normalizeCepDigits(match[1]);
}

/** Remove CEP solto / rótulo "CEP:" que o OCR às vezes cola no bairro ou na rua. */
export function stripCepNoiseFromText(text: string): string {
  return text
    .replace(/\bcep\s*[:.]?\s*\d{5}-?\d{3}\b/gi, " ")
    .replace(/\b\d{5}-?\d{3}\b/g, " ")
    .replace(/\bcep\s*[:.]?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[,\s]+$/g, "")
    .trim();
}

export async function fetchViaCep(cep: string): Promise<ViaCepResponse | null> {
  const digits = normalizeCepDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = (await res.json()) as ViaCepResponse;
    return data?.erro ? null : data;
  } catch {
    return null;
  }
}

/**
 * Completa cidade/UF/bairro (e rua se vazia) a partir do CEP.
 * Não sobrescreve campos já preenchidos pelo OCR/voz.
 */
export async function enrichAddressValuesFromCep<T extends Partial<AddressFormValues>>(
  values: T
): Promise<T> {
  const cep = normalizeCepDigits(values.cep ?? "");
  if (cep.length !== 8) return values;

  const data = await fetchViaCep(cep);
  if (!data) return { ...values, cep } as T;

  const rua = (values.rua ?? "").trim();
  const bairro = stripCepNoiseFromText((values.bairro ?? "").trim());
  const cidade = (values.cidade ?? "").trim();
  const estado = (values.estado ?? "").trim();

  return {
    ...values,
    cep,
    rua: rua || (data.logradouro ?? "").trim(),
    bairro: bairro || (data.bairro ?? "").trim(),
    cidade: cidade || (data.localidade ?? "").trim(),
    estado: estado || (data.uf ?? "").trim(),
  };
}

/**
 * Busca CEP pelo endereço (UF + cidade + logradouro) quando a sugestão veio sem postcode.
 * ViaCEP exige UF e cidade; sem isso retorna null.
 */
export async function lookupCepByAddress(
  values: Partial<AddressFormValues>
): Promise<string | null> {
  const uf = (values.estado ?? "").trim().toUpperCase();
  const cidade = (values.cidade ?? "").trim();
  const rua = (values.rua ?? "").trim();
  if (uf.length !== 2 || cidade.length < 2 || rua.length < 3) return null;

  try {
    const path = `${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}`;
    const res = await fetch(`https://viacep.com.br/ws/${path}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse | ViaCepResponse[];
    const items = Array.isArray(data) ? data : data?.erro ? [] : [data];
    if (!items.length) return null;

    const numeroDigits = (values.numero ?? "").replace(/\D/g, "");
    const bairroHint = stripCepNoiseFromText((values.bairro ?? "").trim()).toLowerCase();
    const scored = items
      .map((item) => {
        const cep = normalizeCepDigits(item.cep ?? "");
        if (cep.length !== 8) return null;
        let score = 0;
        const itemBairro = (item.bairro ?? "").trim().toLowerCase();
        if (bairroHint && itemBairro && (itemBairro.includes(bairroHint) || bairroHint.includes(itemBairro))) {
          score += 2;
        }
        if (numeroDigits) score += 1; // desempate fraco: preferir primeiro com CEP válido
        return { cep, score };
      })
      .filter((x): x is { cep: string; score: number } => x != null)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.cep ?? null;
  } catch {
    return null;
  }
}

/**
 * Completa CEP ausente a partir de texto livre, ViaCEP por endereço ou reverse Nominatim.
 * Não sobrescreve CEP já válido.
 */
export async function completeMissingCep(
  values: AddressFormValues,
  options?: {
    freeText?: string;
    hintCep?: string;
    latitude?: number | null;
    longitude?: number | null;
    reversePostcode?: (lat: number, lon: number) => Promise<string | null>;
  }
): Promise<AddressFormValues> {
  const current = normalizeCepDigits(values.cep ?? "");
  if (current.length === 8) return { ...values, cep: current };

  const fromHint = normalizeCepDigits(options?.hintCep ?? "");
  if (fromHint.length === 8) return { ...values, cep: fromHint };

  const fromText = extractCepDigitsFromText(options?.freeText ?? "");
  if (fromText.length === 8) return { ...values, cep: fromText };

  const fromVia = await lookupCepByAddress(values);
  if (fromVia) return { ...values, cep: fromVia };

  const lat = options?.latitude;
  const lon = options?.longitude;
  if (
    options?.reversePostcode &&
    lat != null &&
    lon != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    const fromReverse = await options.reversePostcode(lat, lon);
    const digits = normalizeCepDigits(fromReverse ?? "");
    if (digits.length === 8) return { ...values, cep: digits };
  }

  return values;
}
