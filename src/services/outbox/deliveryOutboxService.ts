import type { EntregueBody } from "../../features/entregas/api";
import type { MarcacaoEntregaResponse } from "../../features/entregas/types";
import { useDeliveryStore } from "../../store/deliveryStore";
import { useOutboxStore, findPendingOutboxActionForSaidas } from "../../store/outboxStore";
import {
  copyPhotosForAction,
  persistAction,
} from "./outboxStorage";
import {
  createActionId,
  createClientActionId,
  createPhotoId,
  type OutboxActionKind,
  type OutboxDeliveryAction,
} from "./types";
import { processOutboxQueue } from "./syncEngine";
import { routeHasPendingDeliveries } from "../../features/entregas/utils/routeUtils";

export class OutboxKindConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboxKindConflictError";
  }
}

export type EnqueueCompletionResult = {
  queued: boolean;
  marcacao?: MarcacaoEntregaResponse;
  actionId?: string;
};

function applyLocalEntregue(idSaidas: number[]): void {
  useDeliveryStore.getState().applyLocalMarkDelivered(idSaidas);
  useDeliveryStore.getState().syncActiveStopIndex();
}

function applyLocalAusente(idSaidas: number[]): void {
  useDeliveryStore.getState().applyLocalMarkAbsent(idSaidas);
  useDeliveryStore.getState().syncActiveStopIndex();
}

function applyLocalDevolucao(idSaidas: number[]): void {
  useDeliveryStore.getState().applyLocalMarkReturned(idSaidas);
  useDeliveryStore.getState().syncActiveStopIndex();
}

function allLocallyEntregue(idSaidas: number[]): boolean {
  if (idSaidas.length === 0) return false;
  const { routeDeliveryStatus, locallyFinalizedSaidaIds } = useDeliveryStore.getState();
  return idSaidas.every(
    (id) =>
      routeDeliveryStatus[id] === "entregue" ||
      locallyFinalizedSaidaIds[id] != null
  );
}

function buildLocalRouteMarcacao(): MarcacaoEntregaResponse | undefined {
  const { activeRouteId, routeOrder, routeDeliveryStatus } = useDeliveryStore.getState();
  if (!activeRouteId || routeOrder.length === 0) return undefined;
  if (routeHasPendingDeliveries(routeOrder, routeDeliveryStatus)) return undefined;
  return {
    ok: true,
    id_saida: 0,
    routeJustCompleted: true,
    rotaIdForResumo: activeRouteId,
  } as MarcacaoEntregaResponse;
}

async function assertNoOppositePending(
  idSaidas: number[],
  kind: OutboxActionKind
): Promise<void> {
  const existing = await findPendingOutboxActionForSaidas(idSaidas);
  if (!existing) return;
  if (existing.kind === kind) return;
  throw new OutboxKindConflictError(
    "Há um envio pendente com status diferente para este pedido. Aguarde a sincronização e use Nova tentativa se necessário."
  );
}

/**
 * Queue-first: marca local + libera UI na hora; sync (fotos + API) em background.
 */
export async function enqueueEntregueCompletion(params: {
  idSaidas: number[];
  body: EntregueBody;
  photoUris: string[];
  fotoObrigatoria: boolean;
}): Promise<EnqueueCompletionResult> {
  const clientActionId = createClientActionId();
  const idSaidas = [...new Set(params.idSaidas.filter((id) => id > 0))];
  const photoIds = params.photoUris.map(() => createPhotoId());

  await assertNoOppositePending(idSaidas, "entregue");

  const existing = await findPendingOutboxActionForSaidas(idSaidas);
  if (existing) {
    if (existing.kind !== "entregue") {
      throw new OutboxKindConflictError(
        "Há um envio pendente com status diferente para este pedido. Aguarde a sincronização e use Nova tentativa se necessário."
      );
    }
    applyLocalEntregue(idSaidas);
    return { queued: true, actionId: existing.actionId, marcacao: buildLocalRouteMarcacao() };
  }

  // Já marcado localmente (retry após UI falhar): não cria outbox duplicada.
  if (allLocallyEntregue(idSaidas)) {
    return { queued: true, marcacao: buildLocalRouteMarcacao() };
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
  return { queued: true, actionId, marcacao: buildLocalRouteMarcacao() };
}

export async function enqueueAusenteCompletion(params: {
  idSaidas: number[];
  motivoId: number;
  observacao?: string;
  photoUris: string[];
  fotoObrigatoria: boolean;
}): Promise<EnqueueCompletionResult> {
  const clientActionId = createClientActionId();
  const idSaidas = [...new Set(params.idSaidas.filter((id) => id > 0))];
  const photoIds = params.photoUris.map(() => createPhotoId());

  await assertNoOppositePending(idSaidas, "ausente");

  const existing = await findPendingOutboxActionForSaidas(idSaidas);
  if (existing) {
    if (existing.kind !== "ausente") {
      throw new OutboxKindConflictError(
        "Há um envio pendente com status diferente para este pedido. Aguarde a sincronização e use Nova tentativa se necessário."
      );
    }
    applyLocalAusente(idSaidas);
    return { queued: true, actionId: existing.actionId, marcacao: buildLocalRouteMarcacao() };
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
  return { queued: true, actionId, marcacao: buildLocalRouteMarcacao() };
}

export async function enqueueDevolucaoCompletion(params: {
  idSaidas: number[];
  observacao?: string;
  photoUris: string[];
}): Promise<EnqueueCompletionResult> {
  const clientActionId = createClientActionId();
  const idSaidas = [...new Set(params.idSaidas.filter((id) => id > 0))];
  const photoIds = params.photoUris.map(() => createPhotoId());

  if (photoIds.length === 0) {
    throw new Error("Tire a foto do comprovante de devolução antes de confirmar.");
  }

  await assertNoOppositePending(idSaidas, "devolucao");

  const existing = await findPendingOutboxActionForSaidas(idSaidas);
  if (existing) {
    if (existing.kind !== "devolucao") {
      throw new OutboxKindConflictError(
        "Há um envio pendente com status diferente para este pedido. Aguarde a sincronização e use Nova tentativa se necessário."
      );
    }
    applyLocalDevolucao(idSaidas);
    return { queued: true, actionId: existing.actionId, marcacao: buildLocalRouteMarcacao() };
  }

  const actionId = createActionId();
  const photoEntries = await copyPhotosForAction(actionId, params.photoUris);
  const action: OutboxDeliveryAction = {
    actionId,
    clientActionId,
    kind: "devolucao",
    idSaidas,
    createdAt: Date.now(),
    attempts: 0,
    state: "pending",
    observacao: params.observacao,
    photos: photoEntries.map((p, index) => ({
      localUri: p.localUri,
      photoId: photoIds[index],
      status: "pending" as const,
    })),
    fotoObrigatoria: true,
  };
  await persistAction(action);
  applyLocalDevolucao(idSaidas);
  await useOutboxStore.getState().refresh();
  void processOutboxQueue();
  return { queued: true, actionId, marcacao: buildLocalRouteMarcacao() };
}
