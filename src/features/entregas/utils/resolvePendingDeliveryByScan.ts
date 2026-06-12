import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import type { EntregaListItem } from "../types";

export type ResolvePendingScanResult =
  | { ok: true; item: EntregaListItem }
  | { ok: false; title: string; message: string };

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

  const statusNorm = String(item.status || item.exibicao || "").trim().toLowerCase();
  if (statusNorm.includes("entreg") || statusNorm.includes("cancel")) {
    return {
      ok: false,
      title: "Bloqueado",
      message: `Pedido ${item.codigo ?? ""} está com status final (${item.exibicao || item.status}).`,
    };
  }

  return { ok: true, item };
}
