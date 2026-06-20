import type { RotasAtivaResponse } from "../api";
import {
  getRotasAtiva,
  getTodayISO,
  postRotasFinalizar,
  getRotaResumo,
} from "../api";
import {
  groupOrderedByAddress,
  getOrderedRouteDeliveries,
  routeHasPendingDeliveries,
} from "./routeUtils";
import { stopBackgroundTracking } from "../../../services/location/locationService";
import { recordHomeRouteCompleted } from "../../../store/homeRouteStore";

export type RouteReconcileResult = {
  wasCompleted: boolean;
  rotaIdForResumo: string | null;
  stillActive: boolean;
};

export type RouteReconcileDeps = {
  getActiveRouteId: () => string | null;
  getRouteOrder: () => number[];
  getRouteDeliveries: () => import("../types").EntregaListItem[];
  getRouteDeliveryStatus: () => Record<number, "pendente" | "entregue" | "ausente">;
  clearActiveRouteState: () => void;
  restoreActiveRoute: (payload: RotasAtivaResponse) => Promise<void>;
};

async function finalizeAndClearRoute(
  rotaId: string,
  routeOrder: number[],
  routeDeliveries: import("../types").EntregaListItem[],
  clearActiveRouteState: () => void
): Promise<RouteReconcileResult> {
  await stopBackgroundTracking().catch(() => undefined);
  try {
    await postRotasFinalizar(rotaId);
  } catch {
    /* rota pode já ter sido finalizada */
  }

  let paradas = 0;
  let pedidos = routeOrder.length;
  try {
    const resumo = await getRotaResumo(rotaId);
    paradas = resumo.paradas;
    pedidos = resumo.pedidos;
  } catch {
    const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
    paradas = groupOrderedByAddress(ordered).length;
  }

  await recordHomeRouteCompleted(rotaId, paradas, pedidos).catch(() => undefined);
  clearActiveRouteState();

  return {
    wasCompleted: true,
    rotaIdForResumo: rotaId,
    stillActive: false,
  };
}

/**
 * Reconcilia rota ativa local com backend. Finaliza e limpa se todos os pedidos
 * da ordem já estão entregues/ausentes (ex.: finalizados pela lista de pendentes).
 */
export async function reconcileActiveRouteState(
  deps: RouteReconcileDeps
): Promise<RouteReconcileResult> {
  const activeRouteId = deps.getActiveRouteId();
  const routeOrder = deps.getRouteOrder();
  const routeDeliveryStatus = deps.getRouteDeliveryStatus();
  const routeDeliveries = deps.getRouteDeliveries();

  const noop: RouteReconcileResult = {
    wasCompleted: false,
    rotaIdForResumo: null,
    stillActive: activeRouteId != null,
  };

  if (!activeRouteId && routeOrder.length === 0) {
    return { wasCompleted: false, rotaIdForResumo: null, stillActive: false };
  }

  const locallyComplete =
    routeOrder.length > 0 && !routeHasPendingDeliveries(routeOrder, routeDeliveryStatus);

  let rotaAtiva: Awaited<ReturnType<typeof getRotasAtiva>> = null;
  try {
    rotaAtiva = await getRotasAtiva(getTodayISO());
  } catch {
    if (locallyComplete && activeRouteId) {
      return finalizeAndClearRoute(
        activeRouteId,
        routeOrder,
        routeDeliveries,
        deps.clearActiveRouteState
      );
    }
    return noop;
  }

  if (!rotaAtiva || rotaAtiva.status === "sem_rota" || !rotaAtiva.rota_id) {
    if (activeRouteId) {
      if (locallyComplete || routeOrder.length === 0) {
        return finalizeAndClearRoute(
          activeRouteId,
          routeOrder,
          routeDeliveries,
          deps.clearActiveRouteState
        );
      }
      deps.clearActiveRouteState();
    }
    return { wasCompleted: false, rotaIdForResumo: null, stillActive: false };
  }

  const ordem = rotaAtiva.ordem ?? [];
  if (ordem.length === 0 || rotaAtiva.parada_atual >= ordem.length) {
    deps.clearActiveRouteState();
    return { wasCompleted: false, rotaIdForResumo: null, stillActive: false };
  }

  const sameRoute = activeRouteId === rotaAtiva.rota_id;
  const routeDeliveryIds = new Set(routeDeliveries.map((d) => d.id_saida));
  const hasAllDeliveries =
    sameRoute && ordem.length > 0 && ordem.every((id) => routeDeliveryIds.has(id));

  if (!hasAllDeliveries || activeRouteId !== rotaAtiva.rota_id) {
    if (rotaAtiva.rota_id) {
      await deps.restoreActiveRoute(rotaAtiva);
    }
  }

  const afterOrder = deps.getRouteOrder();
  const afterStatus = deps.getRouteDeliveryStatus();
  const afterDeliveries = deps.getRouteDeliveries();
  const afterId = deps.getActiveRouteId();

  if (
    afterId &&
    afterOrder.length > 0 &&
    !routeHasPendingDeliveries(afterOrder, afterStatus)
  ) {
    return finalizeAndClearRoute(afterId, afterOrder, afterDeliveries, deps.clearActiveRouteState);
  }

  return {
    wasCompleted: false,
    rotaIdForResumo: null,
    stillActive: afterId != null,
  };
}

export function buildRouteReconcileDeps(
  get: () => {
    activeRouteId: string | null;
    routeOrder: number[];
    routeDeliveries: import("../types").EntregaListItem[];
    routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente">;
    clearActiveRouteState: () => void;
    restoreActiveRoute: (payload: {
      rota_id: string;
      ordem: number[];
      parada_atual: number;
    }) => Promise<void>;
  }
): RouteReconcileDeps {
  return {
    getActiveRouteId: () => get().activeRouteId,
    getRouteOrder: () => get().routeOrder,
    getRouteDeliveries: () => get().routeDeliveries,
    getRouteDeliveryStatus: () => get().routeDeliveryStatus,
    clearActiveRouteState: () => get().clearActiveRouteState(),
    restoreActiveRoute: (payload) => get().restoreActiveRoute(payload),
  };
}
