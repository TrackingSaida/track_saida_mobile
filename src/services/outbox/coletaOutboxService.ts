import { useOutboxStore } from "../../store/outboxStore";
import {
  emptyBaseLocalState,
  useColetaDaySnapshotStore,
} from "../../store/coletaDaySnapshotStore";
import type { TotaisColetaBase } from "../../features/operacao/coletasApi";
import { persistAction } from "./outboxStorage";
import {
  createActionId,
  createClientActionId,
  type ColetaLeituraItemPayload,
  type OutboxDeliveryAction,
} from "./types";
import { processOutboxQueue } from "./syncEngine";

export type EnqueueColetaResult = {
  queued: boolean;
  actionId: string;
  clientActionId: string;
};

function bumpTotais(prev: TotaisColetaBase, servico: string): TotaisColetaBase {
  const next = { ...prev };
  const s = (servico || "").toLowerCase();
  if (s.includes("shopee")) next.shopee += 1;
  else if (s.includes("mercado") || s === "ml") next.mercado_livre += 1;
  else next.avulso += 1;
  next.total = next.shopee + next.mercado_livre + next.avulso;
  return next;
}

/**
 * Queue-first: bip de coleta entra na outbox; UI otimista via snapshot local.
 */
export async function enqueueColetaLeitura(params: {
  baseId: number;
  baseNome: string;
  dataOperacao: string;
  item: ColetaLeituraItemPayload;
  clientActionId?: string;
}): Promise<EnqueueColetaResult> {
  const clientActionId = params.clientActionId || createClientActionId();
  const codigoKey = (params.item.codigo || "").trim().toUpperCase();

  await useOutboxStore.getState().refresh();
  const existing = useOutboxStore.getState().actions.find(
    (a) =>
      a.kind === "coleta_leitura" &&
      a.state !== "done" &&
      a.baseId === params.baseId &&
      (a.item?.codigo || "").trim().toUpperCase() === codigoKey
  );
  if (existing) {
    void processOutboxQueue();
    return {
      queued: true,
      actionId: existing.actionId,
      clientActionId: existing.clientActionId,
    };
  }

  const actionId = createActionId();
  const action: OutboxDeliveryAction = {
    actionId,
    clientActionId,
    kind: "coleta_leitura",
    idSaidas: [],
    createdAt: Date.now(),
    attempts: 0,
    state: "pending",
    photos: [],
    fotoObrigatoria: false,
    baseId: params.baseId,
    baseNome: params.baseNome,
    dataOperacao: params.dataOperacao,
    item: params.item,
  };
  await persistAction(action);

  const snap = useColetaDaySnapshotStore.getState().snapshot;
  const prev = snap?.estadoPorBaseId[params.baseId] || emptyBaseLocalState();
  await useColetaDaySnapshotStore.getState().patchEstadoBase(params.baseId, {
    totaisLocais: bumpTotais(prev.totaisLocais, params.item.servico),
    pendentesLeitura: (prev.pendentesLeitura || 0) + 1,
    finalizadaLocal: false,
    idExecucao: prev.idExecucao,
  });

  await useOutboxStore.getState().refresh();
  console.info(
    `[audit_coleta] outbox_enqueued kind=coleta_leitura actionId=${actionId} baseId=${params.baseId} codigo=${codigoKey}`
  );
  void processOutboxQueue();
  return { queued: true, actionId, clientActionId };
}

export async function enqueueColetaFinalizar(params: {
  baseId: number;
  baseNome: string;
  dataOperacao: string;
  idExecucao?: number | null;
  modo: "coletado" | "sem_volume";
  clientActionId?: string;
}): Promise<EnqueueColetaResult> {
  const clientActionId = params.clientActionId || createClientActionId();

  await useOutboxStore.getState().refresh();
  const existing = useOutboxStore.getState().actions.find(
    (a) =>
      a.kind === "coleta_finalizar" &&
      a.state !== "done" &&
      a.baseId === params.baseId &&
      a.dataOperacao === params.dataOperacao
  );
  if (existing) {
    await useColetaDaySnapshotStore.getState().patchEstadoBase(params.baseId, {
      finalizadaLocal: true,
      modoFinalizar: params.modo,
      idExecucao: params.idExecucao ?? existing.idExecucao,
    });
    void processOutboxQueue();
    return {
      queued: true,
      actionId: existing.actionId,
      clientActionId: existing.clientActionId,
    };
  }

  const actionId = createActionId();
  const action: OutboxDeliveryAction = {
    actionId,
    clientActionId,
    kind: "coleta_finalizar",
    idSaidas: [],
    createdAt: Date.now(),
    attempts: 0,
    state: "pending",
    photos: [],
    fotoObrigatoria: false,
    baseId: params.baseId,
    baseNome: params.baseNome,
    dataOperacao: params.dataOperacao,
    idExecucao: params.idExecucao ?? undefined,
    finalizarModo: params.modo,
  };
  await persistAction(action);
  await useColetaDaySnapshotStore.getState().patchEstadoBase(params.baseId, {
    finalizadaLocal: true,
    modoFinalizar: params.modo,
    idExecucao: params.idExecucao ?? null,
  });
  await useOutboxStore.getState().refresh();
  console.info(
    `[audit_coleta] outbox_enqueued kind=coleta_finalizar actionId=${actionId} baseId=${params.baseId} modo=${params.modo}`
  );
  void processOutboxQueue();
  return { queued: true, actionId, clientActionId };
}
