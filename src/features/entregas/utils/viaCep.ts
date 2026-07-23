import type { AddressFormValues } from "../components/AddressForm";

export type ViaCepResponse = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

function normalizeCepDigits(cep: string): string {
  return cep.replace(/\D/g, "").slice(0, 8);
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
