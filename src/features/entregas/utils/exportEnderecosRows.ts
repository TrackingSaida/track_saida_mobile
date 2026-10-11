import type { EntregaListItem } from "../types";

export type EnderecoExportRow = {
  "endereço": string;
  numero: string;
  cep: string;
};

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeCepExport(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > 8) return digits.slice(0, 8);
  return digits.padStart(8, "0");
}

export function buildEnderecoRows(
  items: Array<Pick<EntregaListItem, "endereco" | "numero" | "cep">>
): EnderecoExportRow[] {
  const seen = new Set<string>();
  const rows: EnderecoExportRow[] = [];
  for (const item of items) {
    const endereco = cleanText(item.endereco);
    if (!endereco) continue;
    const numero = cleanText(item.numero);
    const cep = normalizeCepExport(item.cep);
    const key = `${endereco.toLocaleLowerCase("pt-BR")}|${numero.toLowerCase()}|${cep}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ "endereço": endereco, numero, cep });
  }
  return rows;
}

export function buildExportFileName(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `enderecos-rota-${y}-${m}-${d}.xlsx`;
}
