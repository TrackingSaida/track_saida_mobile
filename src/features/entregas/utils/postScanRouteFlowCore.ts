import type { EntregaListItem } from "../types";

export const PENDING_ADDED_TITLE = "Pacote inserido";
export const PENDING_ADDED_MESSAGE = "Pacote adicionado aos pendentes do dia.";
export const ACTIVE_ROUTE_PENDING_MESSAGE =
  "Pacote adicionado aos pendentes do dia. A rota em andamento não foi alterada.";

export type PostScanRouteContext = "none" | "route_active_notify" | "route_ready_gate";

export function resolvePostScanRouteContext(input: {
  roteirizacaoHabilitada: boolean;
  routeOrderLength: number;
  activeRouteId: string | null;
}): PostScanRouteContext {
  if (!input.roteirizacaoHabilitada) return "none";
  if (input.activeRouteId != null) return "route_active_notify";
  if (input.routeOrderLength > 0) return "route_ready_gate";
  return "none";
}

export function deliveryNeedsAddressForRoute(d: EntregaListItem): boolean {
  if (!d.possui_endereco) return true;
  if (d.latitude == null || d.longitude == null) return true;
  const addr = (d.endereco_formatado ?? d.endereco ?? "").trim();
  return addr.length === 0;
}
