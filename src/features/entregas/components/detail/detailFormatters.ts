import type { EntregaListItem } from "../../types";
import { extractAddressFields } from "../../utils/addressBuild";

export function displayOrMuted(value?: string | null, fallback = "Não informado"): string {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

export function formatDetailDateTime(value?: string | null): string | null {
  if (!value) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  const date = new Date(ts);
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDetailDateTimeLabel(prefix: string, value?: string | null): string | null {
  const time = formatDetailDateTime(value);
  return time ? `${prefix} ${time}` : null;
}

export function formatCep(cep?: string | null): string | null {
  const digits = (cep ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export type AddressLines = {
  streetLine: string | null;
  complemento: string | null;
  bairro: string | null;
  cityStateCep: string | null;
  hasAddress: boolean;
};

export function formatAddressLines(entrega: EntregaListItem): AddressLines {
  if (!entrega.possui_endereco) {
    return {
      streetLine: null,
      complemento: null,
      bairro: null,
      cityStateCep: null,
      hasAddress: false,
    };
  }

  const fields = extractAddressFields(entrega);
  const complemento = (entrega.complemento ?? "").trim() || null;
  const rua = fields.rua.trim();
  const numero = fields.numero.trim();
  const streetLine =
    rua && numero ? `${rua}, ${numero}` : rua || entrega.endereco?.trim() || null;
  const bairro = fields.bairro.trim() || entrega.bairro?.trim() || null;

  const cityParts: string[] = [];
  if (fields.cidade.trim()) cityParts.push(fields.cidade.trim());
  if (fields.estado.trim()) {
    cityParts.push(fields.estado.trim());
  }
  const cepFormatted = formatCep(fields.cep || entrega.cep);
  let cityStateCep = cityParts.join("/");
  if (cepFormatted) {
    cityStateCep = cityStateCep ? `${cityStateCep} · CEP ${cepFormatted}` : `CEP ${cepFormatted}`;
  }

  return {
    streetLine,
    complemento,
    bairro,
    cityStateCep: cityStateCep || null,
    hasAddress: !!(streetLine || bairro || cityStateCep),
  };
}

export type DetailStatusKind = "pendente" | "ausente" | "entregue" | "cancelado";

export function resolveDetailStatusKind(entrega: EntregaListItem): DetailStatusKind {
  const exibicao = (entrega.exibicao || "").trim();
  const statusNorm = (entrega.status || "").toUpperCase();
  if (exibicao === "Ausente") return "ausente";
  if (exibicao === "Entregue") return "entregue";
  if (exibicao === "Cancelado" || statusNorm === "CANCELADO") return "cancelado";
  return "pendente";
}

export function statusLabelUpper(kind: DetailStatusKind): string {
  switch (kind) {
    case "pendente":
      return "PENDENTE";
    case "ausente":
      return "AUSENTE";
    case "entregue":
      return "ENTREGUE";
    case "cancelado":
      return "CANCELADO";
  }
}
