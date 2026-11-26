import { getRotasAtiva, getTodayISO, type RotasAtivaResponse } from "../api";
import type { RotaSyncInfo } from "../types";
import { getFirstPendingRouteIndex, type RouteDeliveryStatus as RouteStatusValue } from "./routeUtils";

export type RouteFinalizeSyncResult = {
  routeJustCompleted: boolean;
  rotaIdForResumo: string | null;
};

type RouteDeliveryStatusMap = Record<number, RouteStatusValue>;

type ApplyRouteSyncDeps = {
  getActiveRouteId: () => string | null;
  getRouteOrder: () => number[];
  getRouteDeliveryStatus: () => RouteDeliveryStatusMap;
  restoreActiveRoute: (payload: RotasAtivaResponse) => Promise<void>;
  clearActiveRouteState: () => void;
  markRouteCompletedPendingDismiss: (rotaId: string) => void;
  isRouteCompletedAwaitingDismiss: () => boolean;
  setActiveStopIndex: (index: number) => void;
  stopBackgroundTracking?: () => Promise<void>;
};

async function stopTracking(deps: ApplyRouteSyncDeps): Promise<void> {
  if (!deps.stopBackgroundTracking) return;
  await deps.stopBackgroundTracking().catch(() => {});
}

export async function applyRouteSyncFromResponse(
  sync: RotaSyncInfo | null | undefined,
  deps: ApplyRouteSyncDeps
): Promise<RouteFinalizeSyncResult> {
  if (sync?.rota_finalizada && sync.rota_id) {
    await stopTracking(deps);
    deps.markRouteCompletedPendingDismiss(sync.rota_id);
    return { routeJustCompleted: true, rotaIdForResumo: sync.rota_id };
  }

  if (sync?.in_active_route && sync.rota_id && sync.ordem?.length) {
    const activeRouteId = deps.getActiveRouteId();
    const routeOrder = deps.getRouteOrder();
    if (activeRouteId !== sync.rota_id || routeOrder.length === 0) {
      await deps.restoreActiveRoute({
        rota_id: sync.rota_id,
        ordem: sync.ordem,
        parada_atual: sync.parada_atual ?? 0,
        status: "em_entrega",
      });
    } else {
      const statusMap = deps.getRouteDeliveryStatus();
      const idx =
        sync.parada_atual ??
        getFirstPendingRouteIndex(routeOrder, statusMap);
      deps.setActiveStopIndex(idx);
    }
    return { routeJustCompleted: false, rotaIdForResumo: null };
  }

  const activeRouteId = deps.getActiveRouteId();
  if (activeRouteId) {
    if (deps.isRouteCompletedAwaitingDismiss()) {
      return {
        routeJustCompleted: true,
        rotaIdForResumo: activeRouteId,
      };
    }
    try {
      const rotaAtiva = await getRotasAtiva(getTodayISO());
      if (!rotaAtiva || rotaAtiva.status === "sem_rota" || !rotaAtiva.rota_id) {
        const rotaId = activeRouteId;
        await stopTracking(deps);
        deps.markRouteCompletedPendingDismiss(rotaId);
        return { routeJustCompleted: true, rotaIdForResumo: rotaId };
      }
      if (rotaAtiva.rota_id !== activeRouteId || deps.getRouteOrder().length === 0) {
        await deps.restoreActiveRoute(rotaAtiva);
      } else {
        deps.setActiveStopIndex(rotaAtiva.parada_atual);
      }
    } catch {
      /* mantém estado local */
    }
  }

  return { routeJustCompleted: false, rotaIdForResumo: null };
}

export function getIdsInActiveRoute(
  routeOrder: number[],
  selectedIds: number[]
): number[] {
  if (routeOrder.length === 0) return [];
  const routeSet = new Set(routeOrder);
  return selectedIds.filter((id) => routeSet.has(id));
}
