import type { AxiosError } from "axios";
import { marcarEntregue, marcarAusente } from "../../features/entregas/api";
import { uploadDeliveryPhoto } from "../deliveryPhotoService";
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
  let current = action;

  for (let i = 0; i < current.photos.length; i++) {
    const photo = current.photos[i];
    if (photo.status === "uploaded" && (photo.uploadedKeys?.length ?? 0) > 0) continue;

    const photoId = photo.photoId || createPhotoId();
    const primaryId = current.idSaidas[0];
    const filename = photo.localUri.split("/").pop() || "foto.jpg";
    const existingKey = photo.uploadedKeys?.[0];

    const objectKey = await uploadDeliveryPhoto({
      id_saida: primaryId,
      tipo,
      uri: photo.localUri,
      mimeType: "image/jpeg",
      filename,
      photoId,
      existingObjectKey: existingKey,
      validarCamposObrigatorios: false,
      alterarStatus: false,
    });

    for (const idSaida of current.idSaidas.slice(1)) {
      await uploadDeliveryPhoto({
        id_saida: idSaida,
        tipo,
        uri: photo.localUri,
        mimeType: "image/jpeg",
        filename,
        photoId,
        existingObjectKey: objectKey,
        validarCamposObrigatorios: false,
        alterarStatus: false,
      });
    }

    const updatedPhotos = [...current.photos];
    updatedPhotos[i] = {
      ...photo,
      photoId,
      status: "uploaded",
      uploadedKeys: [objectKey],
    };
    current = { ...current, photos: updatedPhotos };
    await persistAction(current);
  }

  return current;
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
  await processOutboxQueue();
}
