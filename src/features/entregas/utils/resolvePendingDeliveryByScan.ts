import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import type { EntregaListItem } from "../types";

export type ResolvePendingScanResult =
  | { ok: true; item: EntregaListItem }
  | { ok: false; title: string; message: string };

const STATUS_FINAIS = new Set(["ENTREGUE", "CANCELADO", "CANCELADA"]);

function normalizeStatusKey(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

/** Status realmente finais — não usa includes("entreg"), que casa SAIU_PARA_ENTREGA. */
export function isStatusFinalEntrega(item: {
  status?: string | null;
  exibicao?: string | null;
}): boolean {
  const status = normalizeStatusKey(item.status || "");
  if (STATUS_FINAIS.has(status)) return true;
  const exibicao = String(item.exibicao || "")
    .trim()
    .toLowerCase();
  return exibicao === "entregue" || exibicao === "cancelado";
}

export function resolvePendingDeliveryByScan(
  raw: string,
  pendingDeliveries: EntregaListItem[]
): ResolvePendingScanResult {
  const parsed = parseCodigoQrRaw(raw || "");
  const codigo = String(parsed.codigo || raw || "").trim().toLowerCase();
  if (!codigo) {
    return { ok: false, title: "Atenção", message: "Informe um código válido." };
  }

  const item = pendingDeliveries.find(
    (d) => String(d.codigo ?? "").trim().toLowerCase() === codigo
  );
  if (!item) {
    return {
      ok: false,
      title: "Não encontrado",
      message: "Código não está nos pendentes carregados ou já está finalizado/cancelado.",
    };
  }

  if (isStatusFinalEntrega(item)) {
    return {
      ok: false,
      title: "Bloqueado",
      message: `Pedido ${item.codigo ?? ""} já está finalizado (${item.exibicao || item.status}).`,
    };
  }

  return { ok: true, item };
}
