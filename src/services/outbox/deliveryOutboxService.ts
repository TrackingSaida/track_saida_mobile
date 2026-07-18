import type { EntregueBody } from "../../features/entregas/api";
import type { MarcacaoEntregaResponse } from "../../features/entregas/types";
import { useDeliveryStore, buildApplyRouteSyncDeps } from "../../store/deliveryStore";
import { useOutboxStore, findPendingOutboxActionForSaidas } from "../../store/outboxStore";
import {
  copyPhotosForAction,
  persistAction,
} from "./outboxStorage";
import {
  createActionId,
  createClientActionId,
  createPhotoId,
  type OutboxDeliveryAction,
} from "./types";
import { processOutboxQueue } from "./syncEngine";
import { isOnline } from "./networkStatus";
import {
  uploadEntreguePhotosForDeliveryIds,
  uploadAusentePhotosForDeliveryIds,
} from "../../features/entregas/utils/deliveryPhotoBatch";
import {
  buildRouteReconcileDeps,
  reconcileActiveRouteState,
} from "../../features/entregas/utils/routeReconcile";
import { applyRouteSyncFromResponse } from "../../features/entregas/utils/routeActiveSync";

export class OutboxKindConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboxKindConflictError";
  }
}

function applyLocalEntregue(idSaidas: number[]): void {
  useDeliveryStore.getState().applyLocalMarkDelivered(idSaidas);
}

function applyLocalAusente(idSaidas: number[]): void {
  useDeliveryStore.getState().applyLocalMarkAbsent(idSaidas);
}

async function assertNoOppositePending(
  idSaidas: number[],
  kind: "entregue" | "ausente"
): Promise<void> {
  const existing = await findPendingOutboxActionForSaidas(idSaidas);
  if (!existing) return;
  if (existing.kind === kind) return;
  throw new OutboxKindConflictError(
    "Há um envio pendente com status diferente para este pedido. Aguarde a sincronização e use Nova tentativa se necessário."
  );
}

async function tryImmediateEntregue(
  idSaidas: number[],
  body: EntregueBody,
  photoUris: string[],
  photoIds: string[],
  clientActionId: string
): Promise<MarcacaoEntregaResponse | null> {
  if (!(await isOnline())) return null;
  const headers = { "X-Client-Action-Id": clientActionId };
  const targets = idSaidas.filter((id) => id > 0);
  if (photoUris.length > 0 && targets.length > 0) {
    await uploadEntreguePhotosForDeliveryIds(photoUris, targets, photoIds);
  }
  let last: MarcacaoEntregaResponse | null = null;
  for (let i = 0; i < targets.length; i++) {
    const id = targets[i];
    const isLast = i === targets.length - 1;
    last = await useDeliveryStore.getState().markDelivered(id, body, headers, {
      skipReconcile: !isLast,
    });
  }
  if (last && targets.length > 1 && !last.routeJustCompleted) {
    const get = useDeliveryStore.getState;
    const set = useDeliveryStore.setState;
    await applyRouteSyncFromResponse(last.rota_sync, buildApplyRouteSyncDeps(get, set));
    const reconcile = await reconcileActiveRouteState(buildRouteReconcileDeps(get));
    if (reconcile.wasCompleted && reconcile.rotaIdForResumo) {
      last = {
        ...last,
        routeJustCompleted: true,
        rotaIdForResumo: reconcile.rotaIdForResumo,
      };
    }
  }
  return last;
}

async function tryImmediateAusente(
  idSaidas: number[],
  motivoId: number,
  observacao: string | undefined,
  photoUris: string[],
  photoIds: string[],
  clientActionId: string
): Promise<MarcacaoEntregaResponse | null> {
  if (!(await isOnline())) return null;
  const headers = { "X-Client-Action-Id": clientActionId };
  const targets = idSaidas.filter((id) => id > 0);
  if (photoUris.length > 0 && targets.length > 0) {
    await uploadAusentePhotosForDeliveryIds(photoUris, targets, photoIds);
  }
  let last: MarcacaoEntregaResponse | null = null;
  for (let i = 0; i < targets.length; i++) {
    const id = targets[i];
    const isLast = i === targets.length - 1;
    last = await useDeliveryStore.getState().markAbsent(id, motivoId, observacao, headers, {
      skipReconcile: !isLast,
    });
  }
  if (last && targets.length > 1 && !last.routeJustCompleted) {
    const get = useDeliveryStore.getState;
    const set = useDeliveryStore.setState;
    await applyRouteSyncFromResponse(last.rota_sync, buildApplyRouteSyncDeps(get, set));
    const reconcile = await reconcileActiveRouteState(buildRouteReconcileDeps(get));
    if (reconcile.wasCompleted && reconcile.rotaIdForResumo) {
      last = {
        ...last,
        routeJustCompleted: true,
        rotaIdForResumo: reconcile.rotaIdForResumo,
      };
    }
  }
  return last;
}

export async function enqueueEntregueCompletion(params: {
  idSaidas: number[];
  body: EntregueBody;
  photoUris: string[];
  fotoObrigatoria: boolean;
}): Promise<{ queued: boolean; marcacao?: MarcacaoEntregaResponse; actionId?: string }> {
  const clientActionId = createClientActionId();
  const idSaidas = [...new Set(params.idSaidas.filter((id) => id > 0))];
  const photoIds = params.photoUris.map(() => createPhotoId());

  await assertNoOppositePending(idSaidas, "entregue");

  try {
    const immediate = await tryImmediateEntregue(
      idSaidas,
      params.body,
      params.photoUris,
      photoIds,
      clientActionId
    );
    if (immediate) {
      return { queued: false, marcacao: immediate };
    }
  } catch (e) {
    if (e instanceof OutboxKindConflictError) throw e;
    /* cai no outbox */
  }

  const existing = await findPendingOutboxActionForSaidas(idSaidas);
  if (existing) {
    if (existing.kind !== "entregue") {
      throw new OutboxKindConflictError(
        "Há um envio pendente com status diferente para este pedido. Aguarde a sincronização e use Nova tentativa se necessário."
      );
    }
    return { queued: true, actionId: existing.actionId };
  }

  const actionId = createActionId();
  const photoEntries = await copyPhotosForAction(actionId, params.photoUris);
  const action: OutboxDeliveryAction = {
    actionId,
    clientActionId,
    kind: "entregue",
    idSaidas,
    createdAt: Date.now(),
    attempts: 0,
    state: "pending",
    entregueBody: params.body,
    photos: photoEntries.map((p, index) => ({
      localUri: p.localUri,
      photoId: photoIds[index],
      status: "pending" as const,
    })),
    fotoObrigatoria: params.fotoObrigatoria,
  };
  await persistAction(action);
  applyLocalEntregue(idSaidas);
  await useOutboxStore.getState().refresh();
  void processOutboxQueue();
  return { queued: true, actionId };
}

export async function enqueueAusenteCompletion(params: {
  idSaidas: number[];
  motivoId: number;
  observacao?: string;
  photoUris: string[];
  fotoObrigatoria: boolean;
}): Promise<{ queued: boolean; marcacao?: MarcacaoEntregaResponse; actionId?: string }> {
  const clientActionId = createClientActionId();
  const idSaidas = [...new Set(params.idSaidas.filter((id) => id > 0))];
  const photoIds = params.photoUris.map(() => createPhotoId());

  await assertNoOppositePending(idSaidas, "ausente");

  try {
    const immediate = await tryImmediateAusente(
      idSaidas,
      params.motivoId,
      params.observacao,
      params.photoUris,
      photoIds,
      clientActionId
    );
    if (immediate) {
      return { queued: false, marcacao: immediate };
    }
  } catch (e) {
    if (e instanceof OutboxKindConflictError) throw e;
    /* cai no outbox */
  }

  const existing = await findPendingOutboxActionForSaidas(idSaidas);
  if (existing) {
    if (existing.kind !== "ausente") {
      throw new OutboxKindConflictError(
        "Há um envio pendente com status diferente para este pedido. Aguarde a sincronização e use Nova tentativa se necessário."
      );
    }
    return { queued: true, actionId: existing.actionId };
  }

  const actionId = createActionId();
  const photoEntries = await copyPhotosForAction(actionId, params.photoUris);
  const action: OutboxDeliveryAction = {
    actionId,
    clientActionId,
    kind: "ausente",
    idSaidas,
    createdAt: Date.now(),
    attempts: 0,
    state: "pending",
    motivoId: params.motivoId,
    observacao: params.observacao,
    photos: photoEntries.map((p, index) => ({
      localUri: p.localUri,
      photoId: photoIds[index],
      status: "pending" as const,
    })),
    fotoObrigatoria: params.fotoObrigatoria,
  };
  await persistAction(action);
  applyLocalAusente(idSaidas);
  await useOutboxStore.getState().refresh();
  void processOutboxQueue();
  return { queued: true, actionId };
}
