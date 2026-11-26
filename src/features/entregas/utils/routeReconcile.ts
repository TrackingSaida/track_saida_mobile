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
  type RouteDeliveryStatus,
} from "./routeUtils";
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
  getRouteDeliveryStatus: () => Record<number, RouteDeliveryStatus>;
  clearActiveRouteState: () => void;
  markRouteCompletedPendingDismiss: (rotaId: string) => void;
  isRouteCompletedAwaitingDismiss: () => boolean;
  getCompletedRotaIdForResumo: () => string | null;
  restoreActiveRoute: (payload: RotasAtivaResponse) => Promise<void>;
  stopBackgroundTracking?: () => Promise<void>;
};

async function finalizeRouteKeepingVisual(
  rotaId: string,
  routeOrder: number[],
  routeDeliveries: import("../types").EntregaListItem[],
  markRouteCompletedPendingDismiss: (rotaId: string) => void,
  stopBackgroundTracking?: () => Promise<void>
): Promise<RouteReconcileResult> {
  if (stopBackgroundTracking) {
    await stopBackgroundTracking().catch(() => undefined);
  }
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
  markRouteCompletedPendingDismiss(rotaId);

  return {
    wasCompleted: true,
    rotaIdForResumo: rotaId,
    // Visualmente ainda há rota; operacionalmente não (Home usa awaitingDismiss).
    stillActive: false,
  };
}

/**
 * Reconcilia rota ativa local com backend. Finaliza e mantém pins até dismiss do resumo
 * se todos os pedidos da ordem já estão entregues/ausentes.
 */
export async function reconcileActiveRouteState(
  deps: RouteReconcileDeps
): Promise<RouteReconcileResult> {
  const activeRouteId = deps.getActiveRouteId();
  const routeOrder = deps.getRouteOrder();
  const routeDeliveryStatus = deps.getRouteDeliveryStatus();
  const routeDeliveries = deps.getRouteDeliveries();

  if (deps.isRouteCompletedAwaitingDismiss()) {
    return {
      wasCompleted: false,
      rotaIdForResumo: deps.getCompletedRotaIdForResumo(),
      stillActive: false,
    };
  }

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
      return finalizeRouteKeepingVisual(
        activeRouteId,
        routeOrder,
        routeDeliveries,
        deps.markRouteCompletedPendingDismiss,
        deps.stopBackgroundTracking
      );
    }
    return noop;
  }

  if (!rotaAtiva || rotaAtiva.status === "sem_rota" || !rotaAtiva.rota_id) {
    if (activeRouteId) {
      if (locallyComplete || routeOrder.length === 0) {
        if (locallyComplete) {
          return finalizeRouteKeepingVisual(
            activeRouteId,
            routeOrder,
            routeDeliveries,
            deps.markRouteCompletedPendingDismiss,
            deps.stopBackgroundTracking
          );
        }
        deps.clearActiveRouteState();
        return { wasCompleted: false, rotaIdForResumo: null, stillActive: false };
      }
      deps.clearActiveRouteState();
    }
    return { wasCompleted: false, rotaIdForResumo: null, stillActive: false };
  }

  const ordem = rotaAtiva.ordem ?? [];
  if (ordem.length === 0 || rotaAtiva.parada_atual >= ordem.length) {
    if (locallyComplete && activeRouteId) {
      return finalizeRouteKeepingVisual(
        activeRouteId,
        routeOrder,
        routeDeliveries,
        deps.markRouteCompletedPendingDismiss,
        deps.stopBackgroundTracking
      );
    }
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
    return finalizeRouteKeepingVisual(
      afterId,
      afterOrder,
      afterDeliveries,
      deps.markRouteCompletedPendingDismiss,
      deps.stopBackgroundTracking
    );
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
    routeDeliveryStatus: Record<number, RouteDeliveryStatus>;
    routeCompletedAwaitingDismiss: boolean;
    completedRotaIdForResumo: string | null;
    clearActiveRouteState: () => void;
    markRouteCompletedPendingDismiss: (rotaId: string) => void;
    restoreActiveRoute: (payload: RotasAtivaResponse) => Promise<void>;
  }
): RouteReconcileDeps {
  return {
    getActiveRouteId: () => get().activeRouteId,
    getRouteOrder: () => get().routeOrder,
    getRouteDeliveries: () => get().routeDeliveries,
    getRouteDeliveryStatus: () => get().routeDeliveryStatus,
    clearActiveRouteState: () => get().clearActiveRouteState(),
    markRouteCompletedPendingDismiss: (rotaId) =>
      get().markRouteCompletedPendingDismiss(rotaId),
    isRouteCompletedAwaitingDismiss: () => get().routeCompletedAwaitingDismiss,
    getCompletedRotaIdForResumo: () => get().completedRotaIdForResumo,
    restoreActiveRoute: (payload) => get().restoreActiveRoute(payload),
    stopBackgroundTracking: () =>
      import("../../../services/location/locationService").then((m) =>
        m.stopBackgroundTracking()
      ),
  };
}
