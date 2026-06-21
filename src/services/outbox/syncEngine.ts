import type { AxiosError } from "axios";
import { marcarEntregue, marcarAusente } from "../../features/entregas/api";
import { uploadDeliveryPhoto } from "../deliveryPhotoService";
import {
  uploadEntreguePhotosForDeliveryIds,
  uploadAusentePhotosForDeliveryIds,
} from "../../features/entregas/utils/deliveryPhotoBatch";
import { isNetworkOrTimeoutError } from "../apiClient";
import {
  loadManifest,
  persistAction,
  removeAction,
} from "./outboxStorage";
import type { OutboxDeliveryAction } from "./types";
import { isOnline, subscribeNetworkStatus } from "./networkStatus";
import { useOutboxStore } from "../../store/outboxStore";
import { useDeliveryStore, buildApplyRouteSyncDeps } from "../../store/deliveryStore";
import {
  buildRouteReconcileDeps,
  reconcileActiveRouteState,
} from "../../features/entregas/utils/routeReconcile";
import { applyRouteSyncFromResponse } from "../../features/entregas/utils/routeActiveSync";

const MAX_ATTEMPTS = 5;
let processing = false;
let stopEngine: (() => void) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
  const tipo = action.kind === "entregue" ? "entregue" : "ausente";
  const updatedPhotos = [...action.photos];

  for (let i = 0; i < updatedPhotos.length; i++) {
    const photo = updatedPhotos[i];
    if (photo.status === "uploaded") continue;

    const primaryId = action.idSaidas[0];
    const filename = photo.localUri.split("/").pop() || "foto.jpg";

    await uploadDeliveryPhoto({
      id_saida: primaryId,
      tipo,
      uri: photo.localUri,
      mimeType: "image/jpeg",
      filename,
      validarCamposObrigatorios: false,
      alterarStatus: false,
    });

    if (action.idSaidas.length > 1) {
      const batchFn =
        tipo === "entregue"
          ? uploadEntreguePhotosForDeliveryIds
          : uploadAusentePhotosForDeliveryIds;
      await batchFn([photo.localUri], action.idSaidas.slice(1));
    }

    updatedPhotos[i] = { ...photo, status: "uploaded", uploadedKeys: photo.uploadedKeys ?? [] };
  }

  return { ...action, photos: updatedPhotos };
}

async function markActionOnServer(action: OutboxDeliveryAction): Promise<void> {
  const headers = { "X-Client-Action-Id": action.clientActionId };
  let lastResponse: Awaited<ReturnType<typeof marcarEntregue>> | null = null;

  for (const idSaida of action.idSaidas) {
    try {
      if (action.kind === "entregue") {
        lastResponse = await marcarEntregue(idSaida, action.entregueBody, headers);
      } else if (action.motivoId != null) {
        lastResponse = await marcarAusente(
          idSaida,
          action.motivoId,
          action.observacao,
          headers
        );
      }
    } catch (e) {
      if (isAlreadyFinalizedError(e)) continue;
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

  if (current.photos.length > 0) {
    current = await uploadActionPhotos(current);
    await persistAction(current);
  }

  await markActionOnServer(current);
  await removeAction(action.actionId);
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

        if (isNetworkOrTimeoutError(e)) break;
        if (attempts < MAX_ATTEMPTS) {
          await sleep(Math.min(2000 * attempts, 8000));
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
  await processOutboxQueue();
}
