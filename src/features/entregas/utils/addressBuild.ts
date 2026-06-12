import type { AddressFormValues } from "../components/AddressForm";
import type { EntregaListItem } from "../types";
import { normalizeEstadoUf } from "./addressQueryNormalizer";

function normalizeCepDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : digits;
}

/** Parser puro de endereco_formatado ("Rua, número[, compl][, bairro], Cidade, UF, CEP"). */
export function valuesFromEnderecoFormatado(formatted: string): Partial<AddressFormValues> | null {
  const parts = formatted.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 5) return null;
  const cep = normalizeCepDigits(parts[parts.length - 1]);
  if (cep.length !== 8) return null;
  const estado = parts[parts.length - 2].toUpperCase().slice(0, 2);
  const cidade = parts[parts.length - 3];

  if (parts.length === 5) {
    return {
      rua: parts[0],
      numero: parts[1],
      bairro: "",
      complemento: "",
      cidade,
      estado,
      cep,
    };
  }
  if (parts.length === 6) {
    return {
      rua: parts[0],
      numero: parts[1],
      bairro: parts[2],
      complemento: "",
      cidade,
      estado,
      cep,
    };
  }
  return {
    rua: parts[0],
    numero: parts[1],
    complemento: parts[2],
    bairro: parts[3],
    cidade,
    estado,
    cep,
  };
}

export type StructuredAddressInput = {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
};

/** Extrai campos estruturados de EntregaListItem (API + endereco_formatado). */
export function extractAddressFields(d: EntregaListItem): Required<
  Pick<StructuredAddressInput, "rua" | "numero" | "bairro" | "cidade" | "estado" | "cep">
> {
  const parsed = d.endereco_formatado
    ? valuesFromEnderecoFormatado(d.endereco_formatado)
    : null;
  const endereco = (d.endereco ?? "").trim();
  const parts = endereco.split(",").map((p) => p.trim()).filter(Boolean);
  let rua = (parsed?.rua ?? parts[0] ?? endereco).trim();
  const numero = (parsed?.numero ?? d.numero ?? "").trim();
  if (rua === numero && parts.length > 1) rua = parts[1] ?? rua;

  return {
    rua,
    numero,
    bairro: (parsed?.bairro ?? d.bairro ?? "").trim(),
    cidade: (parsed?.cidade ?? d.cidade ?? "").trim(),
    estado: normalizeEstadoUf(parsed?.estado ?? d.estado ?? "") || (d.estado ?? "").trim(),
    cep: (parsed?.cep ?? d.cep ?? "").replace(/\D/g, "").slice(0, 8),
  };
}

/** Monta endereço completo para geocode/navegação — nunca só rua+bairro. */
export function buildFullAddressFromFields(fields: StructuredAddressInput): string {
  const parts = [
    fields.rua,
    fields.numero ? `número ${fields.numero}` : "",
    fields.bairro,
    fields.cidade,
    fields.estado,
    fields.cep,
    "Brasil",
  ].filter((p) => (p ?? "").trim());
  return parts.join(", ");
}

export function buildFullAddress(d: EntregaListItem): string {
  return buildFullAddressFromFields(extractAddressFields(d));
}

/** Cidade/estado para geocode: endereço salvo > prefs do motoboy. */
export function resolveGeocodeDefaults(
  d: EntregaListItem,
  cidadePadrao?: string,
  estadoPadrao?: string
): { cidade: string; estado: string } {
  const parsed = d.endereco_formatado ? valuesFromEnderecoFormatado(d.endereco_formatado) : null;
  const fromApiCidade = (d.cidade ?? "").trim();
  const fromApiEstado = (d.estado ?? "").trim();
  return {
    cidade: fromApiCidade || (parsed?.cidade ?? "").trim() || (cidadePadrao ?? "").trim(),
    estado: fromApiEstado || (parsed?.estado ?? "").trim() || (estadoPadrao ?? "").trim(),
  };
}

/** Exige cidade + estado + logradouro para geocode seguro. */
export function hasMinimumAddressForGeocode(d: EntregaListItem): boolean {
  const f = extractAddressFields(d);
  return f.cidade.length > 0 && f.estado.length > 0 && f.rua.length > 2;
}

/** Endereço textual completo o suficiente para navegação por texto. */
export function hasCompleteAddressText(d: EntregaListItem): boolean {
  const f = extractAddressFields(d);
  return f.cidade.length > 0 && f.estado.length > 0 && f.rua.length > 0;
}
