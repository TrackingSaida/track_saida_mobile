import axios, { type AxiosError } from "axios";
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

/** 4xx de regra/negócio: não adianta retentar em loop. */
function isPermanentSyncError(e: unknown): boolean {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    if (status == null) return false;
    if (status === 401 || status === 408 || status === 429) return false;
    return status >= 400 && status < 500;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /CAMPOS_OBRIGATORIOS|STATUS_INVALIDO|STATUS_FINALIZADO|FOTO_OBRIGATORIA|MAX_FOTOS|REQUER_NOVA_TENTATIVA|\b422\b|\b403\b|\b404\b/i.test(
    msg
  );
}

function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const detail = e.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (detail && typeof detail === "object") {
      const obj = detail as { message?: string; code?: string };
      if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
      if (typeof obj.code === "string" && obj.code.trim()) return obj.code.trim();
    }
    if (e.message) return e.message;
  }
  if (e instanceof Error && e.message.trim()) return e.message.trim();
  return String(e);
}

async function loadActionSnapshot(actionId: string): Promise<OutboxDeliveryAction | null> {
  const manifest = await loadManifest();
  return manifest.actions.find((a) => a.actionId === actionId) ?? null;
}

/** Após crash, ação pode ficar em "syncing" e nunca mais entrar na fila. */
async function recoverStuckSyncingActions(): Promise<void> {
  const manifest = await loadManifest();
  for (const action of manifest.actions) {
    if (action.state === "syncing") {
      await persistAction({ ...action, state: "pending" });
      console.warn(`[audit_entrega] sync_recover_stuck actionId=${action.actionId}`);
    }
  }
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

/**
 * Processa só ações `pending`.
 * `failed` só volta com retry manual (evita loop infinito a cada 30s).
 */
export async function processOutboxQueue(): Promise<void> {
  if (processing) return;
  if (!(await isOnline())) return;

  processing = true;
  useOutboxStore.getState().setSyncing(true);

  try {
    await recoverStuckSyncingActions();
    const manifest = await loadManifest();
    const hasFailedAlready = manifest.actions.some((a) => a.state === "failed");
    if (!hasFailedAlready) {
      useOutboxStore.getState().setLastSyncError(null);
    }

    const queue = (await loadManifest()).actions.filter((a) => a.state === "pending");

    for (const action of queue) {
      if (!(await isOnline())) break;

      try {
        await Promise.race([
          processOneAction(action),
          new Promise<never>((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Tempo esgotado ao enviar a entrega. Verifique a internet e toque em Tentar de novo."
                  )
                ),
              120_000
            );
          }),
        ]);
      } catch (e) {
        const msg = errorMessage(e);
        // Preserva progresso de fotos já persistido (não sobrescreve com snapshot velho).
        const latest = (await loadActionSnapshot(action.actionId)) ?? action;
        const permanent = isPermanentSyncError(e);
        const attempts = permanent ? MAX_ATTEMPTS : latest.attempts + 1;
        const failed: OutboxDeliveryAction = {
          ...latest,
          attempts,
          state: attempts >= MAX_ATTEMPTS || permanent ? "failed" : "pending",
          lastError: msg,
        };
        await persistAction(failed);
        useOutboxStore.getState().setLastSyncError(msg);
        auditSync(
          failed.state === "failed" ? "sync_failed_final" : "sync_fail",
          failed,
          `permanent=${permanent} error=${msg.replace(/\s+/g, "_").slice(0, 160)}`
        );

        if (isNetworkOrTimeoutError(e)) break;
        if (failed.state === "pending") {
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
  useOutboxStore.getState().setLastSyncError(null);
  console.info(`[audit_entrega] sync_retry_manual actionId=${actionId}`);
  await useOutboxStore.getState().refresh();
  await processOutboxQueue();
}

/** Retry manual de todos os failed (banner). */
export async function retryAllFailedOutboxActions(): Promise<void> {
  const manifest = await loadManifest();
  const failed = manifest.actions.filter((a) => a.state === "failed");
  for (const action of failed) {
    await persistAction({ ...action, state: "pending", attempts: 0, lastError: undefined });
  }
  if (failed.length === 0) {
    await processOutboxQueue();
    return;
  }
  useOutboxStore.getState().setLastSyncError(null);
  console.info(`[audit_entrega] sync_retry_manual_all count=${failed.length}`);
  await useOutboxStore.getState().refresh();
  await processOutboxQueue();
}
