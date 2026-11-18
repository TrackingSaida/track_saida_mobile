import { create } from "zustand";
import type { TransferenciaPendenteResumo } from "../features/entregas/api";

type TransferPendingState = {
  queue: TransferenciaPendenteResumo[];
  /** Aceite/recusa em andamento — evita ações duplicadas. */
  resolving: boolean;
  enqueue: (items: TransferenciaPendenteResumo[]) => number;
  enqueueFromPushData: (data: Record<string, unknown>) => boolean;
  dequeueCurrent: () => void;
  setResolving: (value: boolean) => void;
  clear: () => void;
};

function normalizeItem(item: TransferenciaPendenteResumo): TransferenciaPendenteResumo | null {
  const id = Number(item.transferencia_id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    transferencia_id: id,
    id_saida: Number(item.id_saida) || 0,
    codigo: item.codigo ?? null,
    rota_id: item.rota_id ?? null,
    motoboy_destino_id: item.motoboy_destino_id ?? null,
    criada_em: item.criada_em ?? null,
  };
}

function mergeFields(
  existing: TransferenciaPendenteResumo,
  incoming: TransferenciaPendenteResumo
): TransferenciaPendenteResumo {
  return {
    ...existing,
    id_saida: existing.id_saida || incoming.id_saida || 0,
    codigo: existing.codigo || incoming.codigo || null,
    rota_id: existing.rota_id || incoming.rota_id || null,
    motoboy_destino_id: existing.motoboy_destino_id ?? incoming.motoboy_destino_id ?? null,
    criada_em: existing.criada_em || incoming.criada_em || null,
  };
}

function dedupeMerge(
  current: TransferenciaPendenteResumo[],
  incoming: TransferenciaPendenteResumo[]
): { queue: TransferenciaPendenteResumo[]; added: number } {
  const next = [...current];
  const indexById = new Map(next.map((i, idx) => [i.transferencia_id, idx]));
  let added = 0;
  for (const raw of incoming) {
    const item = normalizeItem(raw);
    if (!item) continue;
    const idx = indexById.get(item.transferencia_id);
    if (idx != null) {
      next[idx] = mergeFields(next[idx], item);
      continue;
    }
    indexById.set(item.transferencia_id, next.length);
    next.push(item);
    added += 1;
  }
  return { queue: next, added };
}

export const useTransferPendingStore = create<TransferPendingState>((set, get) => ({
  queue: [],
  resolving: false,
  enqueue: (items) => {
    if (!items?.length) return 0;
    const { queue, added } = dedupeMerge(get().queue, items);
    set({ queue });
    return added;
  },
  enqueueFromPushData: (data) => {
    const transferenciaId = Number(data.transferencia_id);
    const idSaida = Number(data.id_saida);
    if (!Number.isFinite(transferenciaId) || transferenciaId <= 0) return false;
    const codigoRaw = data.codigo;
    const codigo =
      typeof codigoRaw === "string" && codigoRaw.trim()
        ? codigoRaw.trim()
        : null;
    const added = get().enqueue([
      {
        transferencia_id: transferenciaId,
        id_saida: Number.isFinite(idSaida) && idSaida > 0 ? idSaida : 0,
        codigo,
      },
    ]);
    return added > 0;
  },
  dequeueCurrent: () => {
    set((s) => ({ queue: s.queue.slice(1), resolving: false }));
  },
  setResolving: (value) => set({ resolving: value }),
  clear: () => {
    const s = get();
    // Evita set() no-op: novo `[]` dispara selectors e pode loopar em effects.
    if (s.queue.length === 0 && !s.resolving) return;
    set({ queue: [], resolving: false });
  },
}));
