import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import {
  OUTBOX_DIR,
  OUTBOX_MANIFEST_KEY,
  type OutboxDeliveryAction,
  type OutboxManifest,
} from "./types";
import { copyPhotoToPath } from "../deliveryPhotoService";

const MANIFEST_VERSION = 1;

function outboxRoot(): string {
  return `${FileSystem.documentDirectory}${OUTBOX_DIR}`;
}

export async function loadManifest(): Promise<OutboxManifest> {
  try {
    const raw = await SecureStore.getItemAsync(OUTBOX_MANIFEST_KEY);
    if (!raw) return { version: MANIFEST_VERSION, actions: [] };
    const parsed = JSON.parse(raw) as OutboxManifest;
    if (!parsed?.actions?.length) return { version: MANIFEST_VERSION, actions: [] };
    return { version: MANIFEST_VERSION, actions: parsed.actions };
  } catch {
    return { version: MANIFEST_VERSION, actions: [] };
  }
}

export async function saveManifest(manifest: OutboxManifest): Promise<void> {
  await SecureStore.setItemAsync(OUTBOX_MANIFEST_KEY, JSON.stringify(manifest));
}

export async function copyPhotosForAction(
  actionId: string,
  photoUris: string[]
): Promise<{ localUri: string }[]> {
  const dir = `${outboxRoot()}${actionId}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const entries: { localUri: string }[] = [];
  for (let i = 0; i < photoUris.length; i++) {
    const dest = `${dir}photo_${i}.jpg`;
    await copyPhotoToPath(photoUris[i], dest);
    entries.push({ localUri: dest });
  }
  return entries;
}

export async function removeActionFiles(actionId: string): Promise<void> {
  const dir = `${outboxRoot()}${actionId}/`;
  try {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch {
    /* ignore */
  }
}

export async function persistAction(action: OutboxDeliveryAction): Promise<void> {
  const manifest = await loadManifest();
  const idx = manifest.actions.findIndex((a) => a.actionId === action.actionId);
  if (idx >= 0) manifest.actions[idx] = action;
  else manifest.actions.push(action);
  await saveManifest(manifest);
}

export async function removeAction(actionId: string): Promise<void> {
  const manifest = await loadManifest();
  manifest.actions = manifest.actions.filter((a) => a.actionId !== actionId);
  await saveManifest(manifest);
  await removeActionFiles(actionId);
}

export async function listPendingActions(): Promise<OutboxDeliveryAction[]> {
  const manifest = await loadManifest();
  return manifest.actions.filter((a) => a.state === "pending" || a.state === "failed");
}

export async function countPendingActions(): Promise<number> {
  const list = await listPendingActions();
  return list.length;
}
