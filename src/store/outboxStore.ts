import { create } from "zustand";
import type { OutboxDeliveryAction } from "../services/outbox/types";
import {
  countPendingActions,
  listPendingActions,
  loadManifest,
} from "../services/outbox/outboxStorage";

type OutboxState = {
  pendingCount: number;
  actions: OutboxDeliveryAction[];
  isSyncing: boolean;
  lastSyncError: string | null;
  refresh: () => Promise<void>;
  setSyncing: (v: boolean) => void;
  setLastSyncError: (msg: string | null) => void;
};

export const useOutboxStore = create<OutboxState>((set) => ({
  pendingCount: 0,
  actions: [],
  isSyncing: false,
  lastSyncError: null,

  refresh: async () => {
    const actions = await listPendingActions();
    const pendingCount = await countPendingActions();
    set({ actions, pendingCount });
  },

  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncError: (lastSyncError) => set({ lastSyncError }),
}));

export async function hydrateOutboxStore(): Promise<void> {
  await useOutboxStore.getState().refresh();
}

export function getPendingOutboxCount(): number {
  return useOutboxStore.getState().pendingCount;
}

export async function getAllOutboxActions(): Promise<OutboxDeliveryAction[]> {
  const manifest = await loadManifest();
  return manifest.actions;
}

const ACTIVE_OUTBOX_STATES = new Set<OutboxDeliveryAction["state"]>([
  "pending",
  "syncing",
  "failed",
]);

export function hasPendingOutboxForSaida(idSaida: number): boolean {
  if (idSaida <= 0) return false;
  return useOutboxStore.getState().actions.some(
    (action) =>
      ACTIVE_OUTBOX_STATES.has(action.state) && action.idSaidas.includes(idSaida)
  );
}

export async function findPendingOutboxActionForSaidas(
  idSaidas: number[]
): Promise<OutboxDeliveryAction | null> {
  await useOutboxStore.getState().refresh();
  const targets = new Set(idSaidas.filter((id) => id > 0));
  if (targets.size === 0) return null;
  return (
    useOutboxStore.getState().actions.find(
      (action) =>
        ACTIVE_OUTBOX_STATES.has(action.state) &&
        action.idSaidas.some((id) => targets.has(id))
    ) ?? null
  );
}
