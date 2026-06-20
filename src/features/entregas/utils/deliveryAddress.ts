import type { EntregaListItem } from "../types";

export function deliveryToFreeText(d: EntregaListItem): string {
  const parts = [d.endereco, d.numero, d.bairro, d.cep].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return d.endereco_formatado ?? "";
}

export function deliveryAddressSummary(d: EntregaListItem): string {
  if (!d.possui_endereco) return "sem endereço";
  const parts = [d.endereco, d.numero].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return d.endereco_formatado || "com endereço";
}
