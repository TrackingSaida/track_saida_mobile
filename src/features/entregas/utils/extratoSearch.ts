import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import type { ExtratoDiaItem, ExtratoFinanceiro, ExtratoPedidoItem } from "../types";
import { matchesContains, matchesResolve } from "./matchAvulsoSearch";

export function flattenExtratoItens(extrato: ExtratoFinanceiro | null): ExtratoPedidoItem[] {
  if (!extrato) return [];
  return extrato.dias.flatMap((dia) => [...dia.itens, ...(dia.itens_cancelados ?? [])]);
}

export function searchExtratoByCodigo(
  itens: ExtratoPedidoItem[],
  query: string,
  limit = 12
): ExtratoPedidoItem[] {
  const q = query.trim();
  if (!q) return [];
  return itens.filter((it) => matchesContains(it, q)).slice(0, limit);
}

export function findExtratoItemByScan(
  itens: ExtratoPedidoItem[],
  raw: string
): ExtratoPedidoItem | null {
  const parsed = parseCodigoQrRaw(raw);
  const candidates = [parsed.codigo, raw].map((v) => String(v ?? "").trim()).filter(Boolean);
  if (candidates.length === 0) return null;

  for (const item of itens) {
    if (candidates.some((c) => matchesResolve(item, c))) return item;
  }
  return null;
}

export function getDiaValorDisplay(dia: ExtratoDiaItem): string {
  return dia.valor_dia ?? "0";
}
