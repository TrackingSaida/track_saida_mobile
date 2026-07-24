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
const MANIFEST_FILE = "manifest.json";

function outboxRoot(): string {
  return `${FileSystem.documentDirectory}${OUTBOX_DIR}`;
}

function manifestPath(): string {
  return `${outboxRoot()}${MANIFEST_FILE}`;
}

/** Serializa leituras/escritas do manifesto (evita corrida enqueue × sync). */
let manifestChain: Promise<unknown> = Promise.resolve();

function withManifestLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = manifestChain.then(fn, fn);
  manifestChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensureOutboxDir(): Promise<void> {
  const root = outboxRoot();
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  }
}

async function readManifestUnlocked(): Promise<OutboxManifest> {
  await ensureOutboxDir();
  const path = manifestPath();
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw) as OutboxManifest;
      if (Array.isArray(parsed?.actions)) {
        return { version: MANIFEST_VERSION, actions: parsed.actions };
      }
    }
  } catch {
    /* fallback abaixo */
  }

  // Migração: manifesto antigo no SecureStore (limite ~2KB no Android quebrava o enqueue).
  try {
    const raw = await SecureStore.getItemAsync(OUTBOX_MANIFEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OutboxManifest;
      const migrated: OutboxManifest = {
        version: MANIFEST_VERSION,
        actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
      };
      await FileSystem.writeAsStringAsync(path, JSON.stringify(migrated));
      try {
        await SecureStore.deleteItemAsync(OUTBOX_MANIFEST_KEY);
      } catch {
        /* ignore */
      }
      return migrated;
    }
  } catch {
    /* ignore */
  }

  return { version: MANIFEST_VERSION, actions: [] };
}

async function writeManifestUnlocked(manifest: OutboxManifest): Promise<void> {
  await ensureOutboxDir();
  const payload: OutboxManifest = {
    version: MANIFEST_VERSION,
    actions: Array.isArray(manifest.actions) ? manifest.actions : [],
  };
  await FileSystem.writeAsStringAsync(manifestPath(), JSON.stringify(payload));
}

export async function loadManifest(): Promise<OutboxManifest> {
  return withManifestLock(() => readManifestUnlocked());
}

export async function saveManifest(manifest: OutboxManifest): Promise<void> {
  return withManifestLock(() => writeManifestUnlocked(manifest));
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
  return withManifestLock(async () => {
    const manifest = await readManifestUnlocked();
    const idx = manifest.actions.findIndex((a) => a.actionId === action.actionId);
    if (idx >= 0) manifest.actions[idx] = action;
    else manifest.actions.push(action);
    await writeManifestUnlocked(manifest);
  });
}

export async function removeAction(actionId: string): Promise<void> {
  await withManifestLock(async () => {
    const manifest = await readManifestUnlocked();
    manifest.actions = manifest.actions.filter((a) => a.actionId !== actionId);
    await writeManifestUnlocked(manifest);
  });
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
