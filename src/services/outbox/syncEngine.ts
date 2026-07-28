import type { AxiosError } from "axios";
import { marcarEntregue, marcarAusente, marcarDevolver } from "../../features/entregas/api";
import { isNetworkOrTimeoutError } from "../apiClient";
import {
  loadManifest,
  persistAction,
  removeAction,
} from "./outboxStorage";
import { createPhotoId, type OutboxDeliveryAction } from "./types";
import { isOnline, subscribeNetworkStatus } from "./networkStatus";
import { useOutboxStore } from "../../store/outboxStore";
import { useDeliveryStore, buildApplyRouteSyncDeps } from "../../store/deliveryStore";
import {
  buildRouteReconcileDeps,
  reconcileActiveRouteState,
} from "../../features/entregas/utils/routeReconcile";
import { applyRouteSyncFromResponse } from "../../features/entregas/utils/routeActiveSync";
import {
  uploadAusentePhotosForDeliveryIds,
  uploadDevolucaoPhotosForDeliveryIds,
  uploadEntreguePhotosForDeliveryIds,
} from "../../features/entregas/utils/deliveryPhotoBatch";

const MAX_ATTEMPTS = 5;
let processing = false;
let stopEngine: (() => void) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function auditSync(event: string, action: OutboxDeliveryAction, extra?: string): void {
  const base = `[audit_entrega] ${event} kind=${action.kind} actionId=${action.actionId} clientActionId=${action.clientActionId} ids=${action.idSaidas.join(",")} attempts=${action.attempts}`;
  if (extra) console.info(`${base} ${extra}`);
  else console.info(base);
}

function isAlreadyFinalizedError(e: unknown): boolean {
  const ax = e as AxiosError<{ detail?: string | { code?: string } }>;
  const detail = ax.response?.data?.detail;
  if (detail && typeof detail === "object" && detail.code === "STATUS_FINALIZADO") {
    return true;
  }
  return false;
}

async function uploadActionPhotos(action: OutboxDeliveryAction): Promise<OutboxDeliveryAction> {
  const pending = action.photos
    .map((photo, index) => ({ photo, index }))
    .filter(
      ({ photo }) => !(photo.status === "uploaded" && (photo.uploadedKeys?.length ?? 0) > 0)
    );

  if (pending.length === 0) return action;

  const photoIds = pending.map(({ photo }) => photo.photoId || createPhotoId());
  const uris = pending.map(({ photo }) => photo.localUri);
  const headers = { "X-Client-Action-Id": action.clientActionId };
  const keys =
    action.kind === "entregue"
      ? await uploadEntreguePhotosForDeliveryIds(uris, action.idSaidas, photoIds, headers)
      : action.kind === "devolucao"
        ? await uploadDevolucaoPhotosForDeliveryIds(uris, action.idSaidas, photoIds, headers)
        : await uploadAusentePhotosForDeliveryIds(uris, action.idSaidas, photoIds, headers);

  const updatedPhotos = [...action.photos];
  pending.forEach(({ photo, index }, i) => {
    updatedPhotos[index] = {
      ...photo,
      photoId: photoIds[i],
      status: "uploaded",
      uploadedKeys: [keys[i]],
    };
  });
  const current = { ...action, photos: updatedPhotos };
  await persistAction(current);
  auditSync("sync_photos_ok", current, `uploaded=${pending.length}`);
  return current;
}

async function markActionOnServer(action: OutboxDeliveryAction): Promise<void> {
  const headers = { "X-Client-Action-Id": action.clientActionId };
  let lastResponse:
    | Awaited<ReturnType<typeof marcarEntregue>>
    | Awaited<ReturnType<typeof marcarDevolver>>
    | null = null;

  for (const idSaida of action.idSaidas) {
    try {
      if (action.kind === "entregue") {
        lastResponse = await marcarEntregue(idSaida, action.entregueBody, headers);
      } else if (action.kind === "devolucao") {
        lastResponse = await marcarDevolver(
          idSaida,
          action.observacao ? { observacao: action.observacao } : undefined,
          headers
        );
      } else if (action.motivoId != null) {
        lastResponse = await marcarAusente(
          idSaida,
          action.motivoId,
          action.observacao,
          headers
        );
      }
    } catch (e) {
      if (isAlreadyFinalizedError(e)) {
        auditSync("sync_mark_already_finalized", action, `id_saida=${idSaida}`);
        continue;
      }
      throw e;
    }
  }

  if (lastResponse?.rota_sync) {
    const get = useDeliveryStore.getState;
    const set = useDeliveryStore.setState;
    await applyRouteSyncFromResponse(
      lastResponse.rota_sync,
      buildApplyRouteSyncDeps(get, set)
    );
    await reconcileActiveRouteState(buildRouteReconcileDeps(get));
  }
}

async function processOneAction(action: OutboxDeliveryAction): Promise<void> {
  let current: OutboxDeliveryAction = { ...action, state: "syncing" };
  await persistAction(current);
  auditSync("sync_start", current);

  if (current.photos.length > 0) {
    current = await uploadActionPhotos(current);
  }

  await markActionOnServer(current);
  await removeAction(action.actionId);
  auditSync("sync_ok", current);
}

export async function processOutboxQueue(): Promise<void> {
  if (processing) return;
  if (!(await isOnline())) return;

  processing = true;
  useOutboxStore.getState().setSyncing(true);
  useOutboxStore.getState().setLastSyncError(null);

  try {
    const manifest = await loadManifest();
    const queue = manifest.actions.filter(
      (a) => a.state === "pending" || a.state === "failed"
    );

    for (const action of queue) {
      if (!(await isOnline())) break;

      try {
        await processOneAction(action);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const attempts = action.attempts + 1;
        const failed: OutboxDeliveryAction = {
          ...action,
          attempts,
          state: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          lastError: msg,
        };
        await persistAction(failed);
        useOutboxStore.getState().setLastSyncError(msg);
        auditSync(
          attempts >= MAX_ATTEMPTS ? "sync_failed_final" : "sync_fail",
          failed,
          `error=${msg.replace(/\s+/g, "_").slice(0, 160)}`
        );

        if (isNetworkOrTimeoutError(e)) break;
        if (attempts < MAX_ATTEMPTS) {
          await sleep(Math.min(2000 * attempts + Math.floor(Math.random() * 400), 8000));
        }
      }
    }
  } finally {
    processing = false;
    useOutboxStore.getState().setSyncing(false);
    await useOutboxStore.getState().refresh();
  }
}

export function startSyncEngine(): () => void {
  stopEngine?.();
  void processOutboxQueue();

  const unsubNet = subscribeNetworkStatus((online) => {
    if (online) void processOutboxQueue();
  });

  const interval = setInterval(() => {
    void processOutboxQueue();
  }, 30_000);

  stopEngine = () => {
    clearInterval(interval);
    unsubNet();
    stopEngine = null;
  };

  return stopEngine;
}

export async function retryFailedOutboxAction(actionId: string): Promise<void> {
  const manifest = await loadManifest();
  const action = manifest.actions.find((a) => a.actionId === actionId);
  if (!action) return;
  await persistAction({ ...action, state: "pending", attempts: 0, lastError: undefined });
  console.info(`[audit_entrega] sync_retry_manual actionId=${actionId}`);
  await processOutboxQueue();
}
