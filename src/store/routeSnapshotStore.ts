import * as SecureStore from "expo-secure-store";
import { getTodayISO } from "../features/entregas/api";
import type { RotasAtivaResponse } from "../features/entregas/api";

const SNAPSHOT_PREFIX = "route_snapshot";

export type RouteSnapshotStatus = "rota_pronta" | "em_entrega";

export type RouteSnapshot = {
  route_id?: string;
  status: RouteSnapshotStatus;
  ordem: number[];
  parada_atual: number;
  routeSeparationAcknowledged: boolean;
  updated_at: string;
  pending_sync: boolean;
};

function snapshotKey(motoboyId: number, subBase: string, data: string): string {
  const safeSub = (subBase || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${SNAPSHOT_PREFIX}_${motoboyId}_${safeSub}_${data}`;
}

export async function saveRouteSnapshot(
  motoboyId: number,
  subBase: string,
  data: string,
  snapshot: RouteSnapshot
): Promise<void> {
  await SecureStore.setItemAsync(snapshotKey(motoboyId, subBase, data), JSON.stringify(snapshot));
}

export async function loadRouteSnapshot(
  motoboyId: number,
  subBase: string,
  data: string
): Promise<RouteSnapshot | null> {
  try {
    const raw = await SecureStore.getItemAsync(snapshotKey(motoboyId, subBase, data));
    if (!raw) return null;
    return JSON.parse(raw) as RouteSnapshot;
  } catch {
    return null;
  }
}

export async function clearRouteSnapshot(motoboyId: number, subBase: string, data: string): Promise<void> {
  await SecureStore.deleteItemAsync(snapshotKey(motoboyId, subBase, data));
}

export function snapshotFromRotasAtiva(
  payload: RotasAtivaResponse,
  routeSeparationAcknowledged: boolean
): RouteSnapshot | null {
  if (!payload.status || payload.status === "sem_rota" || !payload.rota_id) return null;
  if (payload.status !== "rota_pronta" && payload.status !== "em_entrega") return null;
  return {
    route_id: payload.rota_id,
    status: payload.status,
    ordem: payload.ordem || [],
    parada_atual: payload.parada_atual ?? 0,
    routeSeparationAcknowledged,
    updated_at: payload.updated_at || new Date().toISOString(),
    pending_sync: false,
  };
}

export function rotasAtivaFromSnapshot(snapshot: RouteSnapshot, subBase: string, motoboyId: number): RotasAtivaResponse {
  return {
    status: snapshot.status,
    rota_id: snapshot.route_id || null,
    ordem: snapshot.ordem,
    parada_atual: snapshot.parada_atual,
    data: getTodayISO(),
    sub_base: subBase,
    entregador_id: motoboyId,
    sequencia_preservada: true,
    updated_at: snapshot.updated_at,
    pending_sync: snapshot.pending_sync,
  };
}
