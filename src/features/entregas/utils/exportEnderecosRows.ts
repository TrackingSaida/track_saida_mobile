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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `endereco` vem do backend como "rua, numero, complemento"; a planilha quer o número em coluna própria. */
export function splitEnderecoSemNumero(endereco: string, numero: string): string {
  if (!numero) return endereco;
  const match = endereco.match(
    new RegExp(`^(.*?)\\s*,\\s*${escapeRegExp(numero)}\\s*(?:,\\s*(.*))?$`, "i")
  );
  if (!match) return endereco;
  const rua = cleanText(match[1]);
  const complemento = cleanText(match[2]);
  if (!rua) return endereco;
  return complemento ? `${rua} ${complemento}` : rua;
}

export function buildEnderecoRows(
  items: Array<Pick<EntregaListItem, "endereco" | "numero" | "cep">>
): EnderecoExportRow[] {
  const seen = new Set<string>();
  const rows: EnderecoExportRow[] = [];
  for (const item of items) {
    const numero = cleanText(item.numero);
    const endereco = splitEnderecoSemNumero(cleanText(item.endereco), numero);
    if (!endereco) continue;
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
