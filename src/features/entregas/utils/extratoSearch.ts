import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import type { ExtratoDiaItem, ExtratoFinanceiro, ExtratoPedidoItem } from "../types";

export function flattenExtratoItens(extrato: ExtratoFinanceiro | null): ExtratoPedidoItem[] {
  if (!extrato) return [];
  return extrato.dias.flatMap((dia) => dia.itens);
}

export function searchExtratoByCodigo(
  itens: ExtratoPedidoItem[],
  query: string,
  limit = 12
): ExtratoPedidoItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return itens.filter((it) => String(it.codigo ?? "").toLowerCase().includes(q)).slice(0, limit);
}

export function findExtratoItemByScan(
  itens: ExtratoPedidoItem[],
  raw: string
): ExtratoPedidoItem | null {
  const parsed = parseCodigoQrRaw(raw);
  const candidates = [parsed.codigo, raw].map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean);
  if (candidates.length === 0) return null;

  for (const item of itens) {
    const codigo = String(item.codigo ?? "").trim().toLowerCase();
    if (!codigo) continue;
    if (candidates.some((c) => codigo.includes(c) || c.includes(codigo))) {
      return item;
    }
  }
  return null;
}

export function getDiaValorDisplay(dia: ExtratoDiaItem): string {
  return dia.valor_dia ?? "0";
}
