import axios, { type AxiosError } from "axios";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { getEntrega, marcarEntregue, marcarAusente, marcarDevolver } from "../../features/entregas/api";
import {
  consultarResumoBaseColeta,
  enviarColetaUnica,
  finalizarColetaOperacional,
  iniciarColetaOperacional,
  lancarColetaManualOperacional,
  type ServicoColeta,
} from "../../features/operacao/coletasApi";
import { isNetworkOrTimeoutError, isTransientRefreshError } from "../apiClient";
import {
  loadManifest,
  persistAction,
  removeAction,
} from "./outboxStorage";
import {
  createPhotoId,
  isColetaOutboxKind,
  type OutboxDeliveryAction,
} from "./types";
import { isOnline, subscribeNetworkStatus } from "./networkStatus";
import { reloadPendingDeliveriesForSession } from "../sessionPendingReload";
import { useOutboxStore } from "../../store/outboxStore";
import { isPhotoCaptureActive } from "../../store/photoCaptureStore";
import { useDeliveryStore, buildApplyRouteSyncDeps } from "../../store/deliveryStore";
import {
  emptyBaseLocalState,
  useColetaDaySnapshotStore,
} from "../../store/coletaDaySnapshotStore";
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
const OBSOLETE_REPAIR_KEY = "outbox_obsolete_repair_v1";
let processing = false;
let repairDone = false;
let stopEngine: (() => void) | null = null;
let pedidosRemovidosNaPassagem = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function registrarPedidoRemovido(quantidade: number): void {
  if (quantidade > 0) pedidosRemovidosNaPassagem += quantidade;
}

function publicarAvisoCargaRemovida(): void {
  const total = pedidosRemovidosNaPassagem;
  pedidosRemovidosNaPassagem = 0;
  if (total <= 0) return;
  const texto =
    total === 1 ? "Pedido removido da sua carga" : `${total} pedidos removidos da sua carga`;
  useOutboxStore.getState().setAvisoCargaRemovida(texto);
}

function auditSync(event: string, action: OutboxDeliveryAction, extra?: string): void {
  const base = `[audit_entrega] ${event} kind=${action.kind} actionId=${action.actionId} clientActionId=${action.clientActionId} ids=${action.idSaidas.join(",")} attempts=${action.attempts}`;
  if (extra) console.info(`${base} ${extra}`);
  else console.info(base);
}

function trackSyncStage(
  stage: "photos_ok" | "api_ok" | "fail",
  action: OutboxDeliveryAction,
  startedAt: number,
  props?: Record<string, unknown>
): void {
  void import("../telemetry/telemetryClient").then(({ trackTelemetry }) =>
    trackTelemetry({
      event_name: "outbox_sync_stage",
      client_action_id: action.clientActionId,
      id_saida: action.idSaidas[0] ?? null,
      duration_ms: Math.max(0, Date.now() - startedAt),
      stage,
      props: { kind: action.kind, ...(props || {}) },
    })
  );
}

function isAlreadyFinalizedError(e: unknown): boolean {
  const ax = e as AxiosError<{ detail?: string | { code?: string } }>;
  const detail = ax.response?.data?.detail;
  if (detail && typeof detail === "object" && detail.code === "STATUS_FINALIZADO") {
    return true;
  }
  return false;
}

function isColetaJaColetadoError(e: unknown): boolean {
  if (!axios.isAxiosError(e) || e.response?.status !== 409) return false;
  const detail = e.response?.data?.detail;
  const text =
    typeof detail === "string"
      ? detail
      : detail && typeof detail === "object"
        ? String((detail as { message?: string; code?: string }).message || (detail as { code?: string }).code || "")
        : "";
  return /já coletad|ja coletad|duplicad/i.test(text);
}

/** 409 que realmente significa “já finalizado / sem volume já aplicado”. */
function isColetaFinalizarIdempotentError(e: unknown): boolean {
  if (!axios.isAxiosError(e) || e.response?.status !== 409) return false;
  const detail = e.response?.data?.detail;
  if (detail && typeof detail === "object") {
    const code = String((detail as { code?: string }).code || "");
    if (/JA_FINALIZ|JA_COLETAD|SEM_VOLUME|FINALIZAD/i.test(code)) return true;
    const msg = String((detail as { message?: string; mensagem?: string }).message || (detail as { mensagem?: string }).mensagem || "");
    if (/já (foi )?finaliz|já coletad|sem volume|participação.*finaliz/i.test(msg)) return true;
  }
  const text = typeof detail === "string" ? detail : "";
  return /já (foi )?finaliz|já coletad|sem volume|participação.*finaliz/i.test(text);
}

function isColetaLoteEmAndamentoError(e: unknown): boolean {
  if (!axios.isAxiosError(e) || e.response?.status !== 409) return false;
  const detail = e.response?.data?.detail;
  if (detail && typeof detail === "object") {
    return (detail as { code?: string }).code === "COLETA_LOTE_EM_ANDAMENTO";
  }
  return false;
}

function isColetaKindOrder(kind: OutboxDeliveryAction["kind"]): number {
  if (kind === "coleta_leitura") return 0;
  if (kind === "coleta_finalizar") return 1;
  return 2;
}

/**
 * FIFO global com agrupamento de coleta por base:
 * leituras da base X antes do finalizar da mesma base; não mistura finalizar B
 * no meio das leituras de A.
 */
export function orderOutboxQueue(actions: OutboxDeliveryAction[]): OutboxDeliveryAction[] {
  const delivery: OutboxDeliveryAction[] = [];
  const coletaByBase = new Map<number, OutboxDeliveryAction[]>();

  for (const action of actions) {
    if (!isColetaOutboxKind(action.kind)) {
      delivery.push(action);
      continue;
    }
    const baseId = action.baseId ?? 0;
    const list = coletaByBase.get(baseId) || [];
    list.push(action);
    coletaByBase.set(baseId, list);
  }

  for (const list of coletaByBase.values()) {
    list.sort((a, b) => {
      const ko = isColetaKindOrder(a.kind) - isColetaKindOrder(b.kind);
      if (ko !== 0) return ko;
      return a.createdAt - b.createdAt;
    });
  }

  type Group = { at: number; items: OutboxDeliveryAction[] };
  const groups: Group[] = [
    ...delivery.map((a) => ({ at: a.createdAt, items: [a] })),
    ...Array.from(coletaByBase.values()).map((items) => ({
      at: Math.min(...items.map((i) => i.createdAt)),
      items,
    })),
  ];
  groups.sort((a, b) => a.at - b.at);
  return groups.flatMap((g) => g.items);
}

async function stampIdExecucaoOnBaseActions(
  baseId: number,
  idExecucao: number
): Promise<void> {
  const manifest = await loadManifest();
  for (const action of manifest.actions) {
    if (
      isColetaOutboxKind(action.kind) &&
      action.baseId === baseId &&
      action.state === "pending" &&
      !action.idExecucao
    ) {
      await persistAction({ ...action, idExecucao });
    }
  }
  await useColetaDaySnapshotStore.getState().patchEstadoBase(baseId, { idExecucao });
}

async function ensureColetaExecucao(action: OutboxDeliveryAction): Promise<number> {
  if (action.idExecucao && action.idExecucao > 0) return action.idExecucao;
  const snap = useColetaDaySnapshotStore.getState().snapshot;
  const localId = snap?.estadoPorBaseId[action.baseId ?? 0]?.idExecucao;
  if (localId && localId > 0) {
    await stampIdExecucaoOnBaseActions(action.baseId ?? 0, localId);
    return localId;
  }

  const baseId = action.baseId;
  if (!baseId) {
    throw new Error("Ação de coleta sem baseId.");
  }
  const dataOperacao = action.dataOperacao;
  try {
    const exec = await iniciarColetaOperacional(baseId, {
      metodo: "codigo",
      ...(dataOperacao ? { data_operacao: dataOperacao } : {}),
    });
    const id = Number(exec?.id_execucao) || 0;
    if (id > 0) {
      await stampIdExecucaoOnBaseActions(baseId, id);
      return id;
    }
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      const detail = e.response.data?.detail as
        | { pode_ajudar?: boolean; id_execucao?: number }
        | string
        | undefined;
      if (detail && typeof detail === "object" && detail.pode_ajudar) {
        const exec = await iniciarColetaOperacional(baseId, {
          metodo: "codigo",
          ajudar: true,
          ...(dataOperacao ? { data_operacao: dataOperacao } : {}),
        });
        const id = Number(exec?.id_execucao) || 0;
        if (id > 0) {
          await stampIdExecucaoOnBaseActions(baseId, id);
          return id;
        }
      }
      if (detail && typeof detail === "object" && Number(detail.id_execucao) > 0) {
        const id = Number(detail.id_execucao);
        await stampIdExecucaoOnBaseActions(baseId, id);
        return id;
      }
      // Já em coleta / já coletada: tenta obter id via resumo da base.
      if (dataOperacao) {
        try {
          const resumo = await consultarResumoBaseColeta(baseId, dataOperacao);
          const fromResumo = Number(resumo?.id_execucao) || 0;
          if (fromResumo > 0) {
            await stampIdExecucaoOnBaseActions(baseId, fromResumo);
            return fromResumo;
          }
        } catch {
          /* segue */
        }
      }
      // Leituras ainda podem ir via lote (agregar cria execução); finalizar precisará de id.
      return 0;
    }
    throw e;
  }
  return 0;
}

async function processColetaAction(action: OutboxDeliveryAction): Promise<void> {
  const startedAt = Date.now();
  let current: OutboxDeliveryAction = { ...action, state: "syncing" };
  await persistAction(current);
  auditSync("sync_start", current);

  const baseId = current.baseId ?? 0;
  const baseNome = (current.baseNome || "").trim();
  if (!baseId || !baseNome) {
    throw new Error("Ação de coleta incompleta (base).");
  }

  const idExecucao = await ensureColetaExecucao(current);
  if (idExecucao > 0) {
    current = { ...current, idExecucao };
    await persistAction(current);
  }

  if (current.kind === "coleta_leitura") {
    if (!current.item?.codigo) {
      throw new Error("Leitura de coleta sem código.");
    }
    try {
      await enviarColetaUnica({
        base: baseNome,
        item: {
          codigo: current.item.codigo,
          servico: current.item.servico as ServicoColeta,
          ...(current.item.qr_payload_raw
            ? { qr_payload_raw: current.item.qr_payload_raw }
            : {}),
          ...(current.item.is_grande ? { is_grande: true } : {}),
        },
        dataOperacao: current.dataOperacao,
        clientActionId: current.clientActionId,
      });
    } catch (e) {
      if (isColetaLoteEmAndamentoError(e)) {
        // Outro request ainda processando o mesmo action id — retenta depois.
        throw e;
      }
      if (!isColetaJaColetadoError(e)) throw e;
      auditSync("sync_mark_already_finalized", current, "coleta_ja_coletado");
    }
    const prev =
      useColetaDaySnapshotStore.getState().snapshot?.estadoPorBaseId[baseId] ||
      emptyBaseLocalState();
    await useColetaDaySnapshotStore.getState().patchEstadoBase(baseId, {
      pendentesLeitura: Math.max(0, (prev.pendentesLeitura || 0) - 1),
      idExecucao: idExecucao || prev.idExecucao,
    });
  } else if (current.kind === "coleta_finalizar") {
    if (current.finalizarModo === "sem_volume") {
      try {
        await lancarColetaManualOperacional({
          base_id: baseId,
          data_operacao: current.dataOperacao || "",
          shopee: 0,
          mercado_livre: 0,
          avulso: 0,
          sem_volume: true,
          origem_cliente: "mobile",
        });
      } catch (e) {
        if (isColetaFinalizarIdempotentError(e)) {
          auditSync("sync_mark_already_finalized", current, "coleta_sem_volume_409");
        } else {
          throw e;
        }
      }
    } else {
      let execId = current.idExecucao || idExecucao;
      if (!execId || execId <= 0) {
        execId = await ensureColetaExecucao(current);
      }
      if (!execId || execId <= 0) {
        throw new Error("Não foi possível obter a execução para finalizar a coleta.");
      }
      try {
        await finalizarColetaOperacional(execId, {
          clientActionId: current.clientActionId,
        });
      } catch (e) {
        if (isColetaFinalizarIdempotentError(e)) {
          auditSync("sync_mark_already_finalized", current, "coleta_finalizar_409");
        } else {
          throw e;
        }
      }
      await useColetaDaySnapshotStore.getState().patchEstadoBase(baseId, {
        finalizadaLocal: true,
        pendentesLeitura: 0,
        idExecucao: execId,
      });
    }
    await useColetaDaySnapshotStore.getState().patchEstadoBase(baseId, {
      finalizadaLocal: true,
      pendentesLeitura: 0,
      modoFinalizar: current.finalizarModo || "coletado",
    });
  }

  await removeAction(action.actionId);
  auditSync("sync_ok", current);
  trackSyncStage("api_ok", current, startedAt);
}

function obsoleteActionReason(e: unknown): string | null {
  const ax = e as AxiosError<{
    detail?: { code?: string; reason?: string };
  }>;
  const detail = ax.response?.data?.detail;
  if (ax.response?.status !== 409 || detail?.code !== "ACAO_PEDIDO_OBSOLETA") {
    return null;
  }
  return detail.reason || "REATRIBUIDO";
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

async function deleteOrphanPhotos(action: OutboxDeliveryAction): Promise<void> {
  for (const photo of action.photos) {
    if (!photo.localUri) continue;
    try {
      await FileSystem.deleteAsync(photo.localUri, { idempotent: true });
    } catch {
      /* arquivo local já ausente */
    }
  }
}

async function discardObsoleteAction(
  action: OutboxDeliveryAction,
  quantidade = action.idSaidas.length
): Promise<void> {
  await deleteOrphanPhotos(action);
  await removeAction(action.actionId);
  registrarPedidoRemovido(quantidade > 0 ? quantidade : 1);
  auditSync("sync_discard_obsolete_action", action);
  const manifest = await loadManifest();
  const stillFailed = manifest.actions.some((item) => item.state === "failed");
  if (!stillFailed) {
    useOutboxStore.getState().setLastSyncError(null);
  }
  await reconcileActiveRouteState(buildRouteReconcileDeps(useDeliveryStore.getState)).catch(
    () => undefined
  );
}

async function repairObsoleteFailedActions(): Promise<void> {
  if (repairDone) return;
  try {
    if ((await SecureStore.getItemAsync(OBSOLETE_REPAIR_KEY)) === "1") {
      repairDone = true;
      return;
    }
  } catch {
    /* segue e tenta reparar nesta execução */
  }
  if (!(await isOnline())) return;

  const manifest = await loadManifest();
  const failed = manifest.actions.filter((action) => action.state === "failed");
  for (const action of failed) {
    const obsoleteIds: number[] = [];
    try {
      for (const idSaida of action.idSaidas) {
        try {
          await getEntrega(idSaida);
        } catch (error) {
          if (isTransientRefreshError(error) || isNetworkOrTimeoutError(error)) {
            return;
          }
          if (obsoleteActionReason(error)) {
            obsoleteIds.push(idSaida);
          }
        }
      }
    } catch {
      return;
    }
    if (obsoleteIds.length === 0) continue;
    if (obsoleteIds.length === action.idSaidas.length) {
      await discardObsoleteAction(action, obsoleteIds.length);
      continue;
    }
    const drop = new Set(obsoleteIds);
    await persistAction({
      ...action,
      idSaidas: action.idSaidas.filter((id) => !drop.has(id)),
    });
    registrarPedidoRemovido(obsoleteIds.length);
    auditSync("sync_discard_obsolete_item", action, `ids=${obsoleteIds.join(",")}`);
  }

  try {
    await SecureStore.setItemAsync(OBSOLETE_REPAIR_KEY, "1");
  } catch {
    /* a próxima abertura tenta de novo se a marca não gravar */
    return;
  }
  repairDone = true;
  await useOutboxStore.getState().refresh();
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

async function markActionOnServer(
  action: OutboxDeliveryAction
): Promise<{ marked: number; obsolete: number }> {
  const headers = { "X-Client-Action-Id": action.clientActionId };
  let lastResponse:
    | Awaited<ReturnType<typeof marcarEntregue>>
    | Awaited<ReturnType<typeof marcarDevolver>>
    | null = null;
  let marked = 0;
  let obsolete = 0;

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
      marked += 1;
    } catch (e) {
      if (isAlreadyFinalizedError(e)) {
        auditSync("sync_mark_already_finalized", action, `id_saida=${idSaida}`);
        marked += 1;
        continue;
      }
      const obsoleteReason = obsoleteActionReason(e);
      if (obsoleteReason) {
        obsolete += 1;
        auditSync(
          "sync_discard_obsolete_item",
          action,
          `id_saida=${idSaida} reason=${obsoleteReason}`
        );
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
  } else {
    // Reatribuições podem retirar o item da rota no servidor sem rota_sync na ação antiga.
    await reconcileActiveRouteState(buildRouteReconcileDeps(useDeliveryStore.getState)).catch(
      () => undefined
    );
  }
  return { marked, obsolete };
}

async function processOneAction(action: OutboxDeliveryAction): Promise<void> {
  if (isColetaOutboxKind(action.kind)) {
    await processColetaAction(action);
    return;
  }

  const startedAt = Date.now();
  let current: OutboxDeliveryAction = { ...action, state: "syncing" };
  await persistAction(current);
  auditSync("sync_start", current);

  if (current.photos.length > 0) {
    try {
      current = await uploadActionPhotos(current);
      trackSyncStage("photos_ok", current, startedAt, {
        photo_count: current.photos.length,
      });
    } catch (error) {
      if (obsoleteActionReason(error)) {
        await discardObsoleteAction(current);
        return;
      }
      throw error;
    }
  }

  const resultado = await markActionOnServer(current);
  if (resultado.marked === 0 && resultado.obsolete > 0) {
    await discardObsoleteAction(current, resultado.obsolete);
    return;
  }
  if (resultado.obsolete > 0) registrarPedidoRemovido(resultado.obsolete);
  await removeAction(action.actionId);
  auditSync("sync_ok", current);
  trackSyncStage("api_ok", current, startedAt);
}

/**
 * Processa só ações `pending`.
 * `failed` só volta com retry manual (evita loop infinito a cada 30s).
 */
export async function processOutboxQueue(): Promise<void> {
  if (processing) return;
  // Não disputa rádio/CPU com a câmera do comprovante (PRD-014).
  if (isPhotoCaptureActive()) return;
  if (!(await isOnline())) return;

  processing = true;
  pedidosRemovidosNaPassagem = 0;
  useOutboxStore.getState().setSyncing(true);

  try {
    await repairObsoleteFailedActions();
    await recoverStuckSyncingActions();
    const manifest = await loadManifest();
    const hasFailedAlready = manifest.actions.some((a) => a.state === "failed");
    if (!hasFailedAlready) {
      useOutboxStore.getState().setLastSyncError(null);
    }

    const queue = orderOutboxQueue(
      (await loadManifest()).actions.filter((a) => a.state === "pending")
    );

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
        trackSyncStage("fail", failed, action.createdAt || Date.now(), {
          error_code: msg.replace(/\s+/g, "_").slice(0, 80),
        });

        if (isNetworkOrTimeoutError(e)) break;
        if (failed.state === "pending") {
          await sleep(Math.min(2000 * attempts + Math.floor(Math.random() * 400), 8000));
        }
      }
    }
  } finally {
    publicarAvisoCargaRemovida();
    processing = false;
    useOutboxStore.getState().setSyncing(false);
    await useOutboxStore.getState().refresh();
  }
}

/** Evita tempestade de sync quando NetInfo oscila (PRD-016 histerese). */
const NETWORK_ONLINE_HYSTERESIS_MS = 2500;

export function startSyncEngine(): () => void {
  stopEngine?.();
  void processOutboxQueue();

  let onlineStableTimer: ReturnType<typeof setTimeout> | null = null;
  const unsubNet = subscribeNetworkStatus((online) => {
    if (onlineStableTimer) {
      clearTimeout(onlineStableTimer);
      onlineStableTimer = null;
    }
    if (!online) return;
    onlineStableTimer = setTimeout(() => {
      onlineStableTimer = null;
      void processOutboxQueue();
      // Recompõe a lista da sessão mesmo fora da home e com roteirização desligada.
      void reloadPendingDeliveriesForSession();
    }, NETWORK_ONLINE_HYSTERESIS_MS);
  });

  const interval = setInterval(() => {
    void processOutboxQueue();
  }, 30_000);

  stopEngine = () => {
    clearInterval(interval);
    if (onlineStableTimer) clearTimeout(onlineStableTimer);
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

async function discardFailedActionLocally(action: OutboxDeliveryAction): Promise<void> {
  await deleteOrphanPhotos(action);
  await removeAction(action.actionId);
  auditSync("sync_discard_manual", action);
}

/**
 * Descarta envios com erro permanente (banner).
 * Não altera o servidor: use quando a baixa já valeu ou o status no servidor impede o reenvio.
 */
export async function discardFailedOutboxAction(actionId: string): Promise<void> {
  const manifest = await loadManifest();
  const action = manifest.actions.find((a) => a.actionId === actionId);
  if (!action || action.state !== "failed") return;
  await discardFailedActionLocally(action);
  const stillFailed = (await loadManifest()).actions.some((item) => item.state === "failed");
  if (!stillFailed) {
    useOutboxStore.getState().setLastSyncError(null);
  }
  await useOutboxStore.getState().refresh();
  await reconcileActiveRouteState(buildRouteReconcileDeps(useDeliveryStore.getState)).catch(
    () => undefined
  );
}

/** Descarta todos os failed do banner, sem reenviar. */
export async function discardAllFailedOutboxActions(): Promise<void> {
  const manifest = await loadManifest();
  const failed = manifest.actions.filter((a) => a.state === "failed");
  for (const action of failed) {
    await discardFailedActionLocally(action);
  }
  useOutboxStore.getState().setLastSyncError(null);
  console.info(`[audit_entrega] sync_discard_manual_all count=${failed.length}`);
  await useOutboxStore.getState().refresh();
  await reconcileActiveRouteState(buildRouteReconcileDeps(useDeliveryStore.getState)).catch(
    () => undefined
  );
}
