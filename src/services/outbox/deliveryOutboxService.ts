import type { EntregueBody } from "../../features/entregas/api";
import type { MarcacaoEntregaResponse } from "../../features/entregas/types";
import { useDeliveryStore } from "../../store/deliveryStore";
import { useOutboxStore } from "../../store/outboxStore";
import {
  copyPhotosForAction,
  persistAction,
} from "./outboxStorage";
import {
  createActionId,
  createClientActionId,
  type OutboxDeliveryAction,
} from "./types";
import { processOutboxQueue } from "./syncEngine";
import { isOnline } from "./networkStatus";
import {
  uploadEntreguePhotosForDeliveryIds,
  uploadAusentePhotosForDeliveryIds,
} from "../../features/entregas/utils/deliveryPhotoBatch";

function applyLocalEntregue(idSaidas: number[]): void {
  useDeliveryStore.getState().applyLocalMarkDelivered(idSaidas);
}

function applyLocalAusente(idSaidas: number[]): void {
  useDeliveryStore.getState().applyLocalMarkAbsent(idSaidas);
}

async function tryImmediateEntregue(
  idSaidas: number[],
  body: EntregueBody,
  photoUris: string[],
  clientActionId: string
): Promise<MarcacaoEntregaResponse | null> {
  if (!(await isOnline())) return null;
  const headers = { "X-Client-Action-Id": clientActionId };
  const targets = idSaidas.filter((id) => id > 0);
  if (photoUris.length > 0 && targets.length > 0) {
    await uploadEntreguePhotosForDeliveryIds(photoUris, targets);
  }
  let last: MarcacaoEntregaResponse | null = null;
  for (const id of targets) {
    last = await useDeliveryStore.getState().markDelivered(id, body, headers);
  }
  return last;
}

async function tryImmediateAusente(
  idSaidas: number[],
  motivoId: number,
  observacao: string | undefined,
  photoUris: string[],
  clientActionId: string
): Promise<MarcacaoEntregaResponse | null> {
  if (!(await isOnline())) return null;
  const headers = { "X-Client-Action-Id": clientActionId };
  const targets = idSaidas.filter((id) => id > 0);
  if (photoUris.length > 0 && targets.length > 0) {
    await uploadAusentePhotosForDeliveryIds(photoUris, targets);
  }
  let last: MarcacaoEntregaResponse | null = null;
  for (const id of targets) {
    last = await useDeliveryStore.getState().markAbsent(id, motivoId, observacao, headers);
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

  try {
    const immediate = await tryImmediateEntregue(
      idSaidas,
      params.body,
      params.photoUris,
      clientActionId
    );
    if (immediate) {
      return { queued: false, marcacao: immediate };
    }
  } catch {
    /* cai no outbox */
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
    photos: photoEntries.map((p) => ({ localUri: p.localUri, status: "pending" })),
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

  try {
    const immediate = await tryImmediateAusente(
      idSaidas,
      params.motivoId,
      params.observacao,
      params.photoUris,
      clientActionId
    );
    if (immediate) {
      return { queued: false, marcacao: immediate };
    }
  } catch {
    /* cai no outbox */
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
    photos: photoEntries.map((p) => ({ localUri: p.localUri, status: "pending" })),
    fotoObrigatoria: params.fotoObrigatoria,
  };
  await persistAction(action);
  applyLocalAusente(idSaidas);
  await useOutboxStore.getState().refresh();
  void processOutboxQueue();
  return { queued: true, actionId };
}
