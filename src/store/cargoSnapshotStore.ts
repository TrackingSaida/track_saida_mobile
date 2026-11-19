import * as FileSystem from "expo-file-system/legacy";
import type { EntregaListItem } from "../features/entregas/types";
import { getTodayISO } from "../features/entregas/api";

const CARGO_DIR = "cargo_snapshots/";
const SNAPSHOT_VERSION = 1;

export type CargoSnapshot = {
  version: number;
  motoboyId: number;
  subBase: string;
  data: string;
  updatedAt: string;
  pendingDeliveries: EntregaListItem[];
  /** Assinatura curta para set idempotente (ids + length). */
  signature: string;
};

function cargoRoot(): string {
  return `${FileSystem.documentDirectory}${CARGO_DIR}`;
}

function safeSubBase(subBase: string): string {
  return (subBase || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function snapshotPath(motoboyId: number, subBase: string, data: string): string {
  return `${cargoRoot()}cargo_${motoboyId}_${safeSubBase(subBase)}_${data}.json`;
}

export function cargoSignature(pending: EntregaListItem[]): string {
  const ids = pending.map((d) => d.id_saida).join(",");
  return `${pending.length}:${ids}`;
}

async function ensureCargoDir(): Promise<void> {
  const root = cargoRoot();
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  }
}

export async function saveCargoSnapshot(
  motoboyId: number,
  subBase: string,
  pendingDeliveries: EntregaListItem[],
  data: string = getTodayISO()
): Promise<void> {
  if (!motoboyId || motoboyId <= 0) return;
  const signature = cargoSignature(pendingDeliveries);
  const existing = await loadCargoSnapshot(motoboyId, subBase, data);
  if (existing && existing.signature === signature) return;

  await ensureCargoDir();
  const payload: CargoSnapshot = {
    version: SNAPSHOT_VERSION,
    motoboyId,
    subBase: subBase || "default",
    data,
    updatedAt: new Date().toISOString(),
    pendingDeliveries,
    signature,
  };
  await FileSystem.writeAsStringAsync(
    snapshotPath(motoboyId, subBase, data),
    JSON.stringify(payload)
  );
}

export async function loadCargoSnapshot(
  motoboyId: number,
  subBase: string,
  data: string = getTodayISO()
): Promise<CargoSnapshot | null> {
  if (!motoboyId || motoboyId <= 0) return null;
  try {
    const path = snapshotPath(motoboyId, subBase, data);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as CargoSnapshot;
    if (!parsed || !Array.isArray(parsed.pendingDeliveries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearCargoSnapshot(
  motoboyId: number,
  subBase: string,
  data: string = getTodayISO()
): Promise<void> {
  if (!motoboyId || motoboyId <= 0) return;
  try {
    const path = snapshotPath(motoboyId, subBase, data);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
}

/** Limpa snapshots do motoboy (logout). */
export async function clearAllCargoSnapshotsForMotoboy(motoboyId: number): Promise<void> {
  if (!motoboyId || motoboyId <= 0) return;
  try {
    await ensureCargoDir();
    const root = cargoRoot();
    const entries = await FileSystem.readDirectoryAsync(root);
    const prefix = `cargo_${motoboyId}_`;
    await Promise.all(
      entries
        .filter((name) => name.startsWith(prefix))
        .map((name) => FileSystem.deleteAsync(`${root}${name}`, { idempotent: true }))
    );
  } catch {
    /* ignore */
  }
}
