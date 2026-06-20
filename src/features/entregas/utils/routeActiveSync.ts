import { getRotasAtiva, getTodayISO, type RotasAtivaResponse } from "../api";
import type { RotaSyncInfo } from "../types";
import { getFirstPendingRouteIndex } from "./routeUtils";
import { stopBackgroundTracking } from "../../../services/location/locationService";

export type RouteFinalizeSyncResult = {
  routeJustCompleted: boolean;
  rotaIdForResumo: string | null;
};

type RouteDeliveryStatus = Record<number, "pendente" | "entregue" | "ausente">;

type ApplyRouteSyncDeps = {
  getActiveRouteId: () => string | null;
  getRouteOrder: () => number[];
  getRouteDeliveryStatus: () => RouteDeliveryStatus;
  restoreActiveRoute: (payload: RotasAtivaResponse) => Promise<void>;
  clearActiveRouteState: () => void;
  setActiveStopIndex: (index: number) => void;
};

export async function applyRouteSyncFromResponse(
  sync: RotaSyncInfo | null | undefined,
  deps: ApplyRouteSyncDeps
): Promise<RouteFinalizeSyncResult> {
  if (sync?.rota_finalizada && sync.rota_id) {
    await stopBackgroundTracking().catch(() => {});
    deps.clearActiveRouteState();
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
    try {
      const rotaAtiva = await getRotasAtiva(getTodayISO());
      if (!rotaAtiva || rotaAtiva.status === "sem_rota" || !rotaAtiva.rota_id) {
        const rotaId = activeRouteId;
        await stopBackgroundTracking().catch(() => {});
        deps.clearActiveRouteState();
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
