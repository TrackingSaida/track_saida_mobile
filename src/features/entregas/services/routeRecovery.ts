import { getRotasAtiva, getTodayISO, type RotasAtivaResponse } from "../api";
import { useAuthStore } from "../../../store/authStore";
import { useDeliveryStore } from "../../../store/deliveryStore";
import {
  clearRouteSnapshot,
  loadRouteSnapshot,
  rotasAtivaFromSnapshot,
  saveRouteSnapshot,
  snapshotFromRotasAtiva,
} from "../../../store/routeSnapshotStore";

export type RouteRecoveryResult = {
  source: "server" | "snapshot" | "none";
  payload: RotasAtivaResponse | null;
  localOnly: boolean;
};

let recoveryReady = false;
let recoveryListeners: Array<(ready: boolean) => void> = [];

export function isRouteRecoveryReady(): boolean {
  return recoveryReady;
}

export function subscribeRouteRecoveryReady(cb: (ready: boolean) => void): () => void {
  recoveryListeners.push(cb);
  cb(recoveryReady);
  return () => {
    recoveryListeners = recoveryListeners.filter((x) => x !== cb);
  };
}

function setRecoveryReady(ready: boolean) {
  recoveryReady = ready;
  recoveryListeners.forEach((cb) => cb(ready));
}

export async function recoverRouteState(opts?: { force?: boolean }): Promise<RouteRecoveryResult> {
  const user = useAuthStore.getState().currentUser;
  const motoboyId = Number(user?.motoboy_id || 0);
  const subBase = String(user?.sub_base || "");
  const dataHoje = getTodayISO();

  if (!motoboyId || !subBase) {
    setRecoveryReady(true);
    return { source: "none", payload: null, localOnly: false };
  }

  try {
    const server = await getRotasAtiva(dataHoje);
    const cancelledId = useDeliveryStore.getState().lastCancelledRouteId;
    if (
      server?.rota_id &&
      cancelledId &&
      server.rota_id === cancelledId
    ) {
      await clearPersistedRouteSnapshot().catch(() => undefined);
      useDeliveryStore.getState().clearActiveRouteState();
      setRecoveryReady(true);
      return { source: "none", payload: null, localOnly: false };
    }
    if (server && server.status && server.status !== "sem_rota" && server.rota_id) {
      const snap = snapshotFromRotasAtiva(
        server,
        useDeliveryStore.getState().routeSeparationAcknowledged
      );
      if (snap) {
        await saveRouteSnapshot(motoboyId, subBase, dataHoje, snap);
      }
      await useDeliveryStore.getState().restoreActiveRoute(server);
      setRecoveryReady(true);
      return { source: "server", payload: server, localOnly: false };
    }
  } catch {
    const snapshot = await loadRouteSnapshot(motoboyId, subBase, dataHoje);
    const cancelledId = useDeliveryStore.getState().lastCancelledRouteId;
    if (snapshot?.route_id && cancelledId && snapshot.route_id === cancelledId) {
      await clearPersistedRouteSnapshot().catch(() => undefined);
      setRecoveryReady(true);
      return { source: "none", payload: null, localOnly: false };
    }
    if (snapshot?.route_id) {
      const payload = rotasAtivaFromSnapshot(snapshot, subBase, motoboyId);
      payload.pending_sync = true;
      await useDeliveryStore.getState().restoreActiveRoute(payload);
      setRecoveryReady(true);
      return { source: "snapshot", payload, localOnly: true };
    }
  }

  if (opts?.force) {
    await useDeliveryStore.getState().loadDeliveries();
  }
  setRecoveryReady(true);
  return { source: "none", payload: null, localOnly: false };
}

export async function persistRouteSnapshotFromStore(): Promise<void> {
  const user = useAuthStore.getState().currentUser;
  const motoboyId = Number(user?.motoboy_id || 0);
  const subBase = String(user?.sub_base || "");
  if (!motoboyId || !subBase) return;

  const store = useDeliveryStore.getState();
  if (!store.activeRouteId && store.routeOrder.length === 0) return;

  const status: "rota_pronta" | "em_entrega" =
    store.routeStarted || store.activeRouteId ? "em_entrega" : "rota_pronta";

  await saveRouteSnapshot(motoboyId, subBase, getTodayISO(), {
    route_id: store.activeRouteId || undefined,
    status,
    ordem: store.routeOrder,
    parada_atual: store.activeStopIndex,
    routeSeparationAcknowledged: store.routeSeparationAcknowledged,
    updated_at: new Date().toISOString(),
    pending_sync: false,
  });
}

export async function clearPersistedRouteSnapshot(): Promise<void> {
  const user = useAuthStore.getState().currentUser;
  const motoboyId = Number(user?.motoboy_id || 0);
  const subBase = String(user?.sub_base || "");
  if (!motoboyId || !subBase) return;
  await clearRouteSnapshot(motoboyId, subBase, getTodayISO());
}
