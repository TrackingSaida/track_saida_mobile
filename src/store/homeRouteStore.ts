import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { buildMotoboyPrefsKey } from "../services/settingsService";
import { useAuthStore } from "./authStore";
import { decodeJwtPayload } from "../utils/jwt";

const HOME_ROUTE_HISTORY_PREFIX = "home_route_history_";
const MAX_HISTORY = 10;
const EPHEMERAL_TTL_MS = 8000;

export type CompletedRouteSummary = {
  rotaId: string;
  paradas: number;
  pedidos: number;
  completedAt: string;
};

type StoredHistory = {
  lastCompleted: CompletedRouteSummary | null;
  history: CompletedRouteSummary[];
};

interface HomeRouteState {
  ephemeralCompleted: CompletedRouteSummary | null;
  lastCompleted: CompletedRouteSummary | null;
  history: CompletedRouteSummary[];
  ephemeralTimer: ReturnType<typeof setTimeout> | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  recordRouteCompleted: (summary: Omit<CompletedRouteSummary, "completedAt">) => Promise<void>;
  clearEphemeral: () => void;
  scheduleEphemeralClear: () => void;
}

function historyKey(): string | null {
  const token = useAuthStore.getState().token;
  const claims = token ? decodeJwtPayload(token) : null;
  const prefsKey = buildMotoboyPrefsKey(claims);
  if (!prefsKey) return null;
  return `${HOME_ROUTE_HISTORY_PREFIX}${prefsKey.replace("motoboy_prefs_", "")}`;
}

async function loadStoredHistory(): Promise<StoredHistory> {
  const key = historyKey();
  if (!key) return { lastCompleted: null, history: [] };
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return { lastCompleted: null, history: [] };
    const parsed = JSON.parse(raw) as StoredHistory;
    return {
      lastCompleted: parsed.lastCompleted ?? null,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, MAX_HISTORY) : [],
    };
  } catch {
    return { lastCompleted: null, history: [] };
  }
}

async function persistHistory(data: StoredHistory): Promise<void> {
  const key = historyKey();
  if (!key) return;
  await SecureStore.setItemAsync(key, JSON.stringify(data));
}

export const useHomeRouteStore = create<HomeRouteState>((set, get) => ({
  ephemeralCompleted: null,
  lastCompleted: null,
  history: [],
  ephemeralTimer: null,
  hydrated: false,

  hydrate: async () => {
    const stored = await loadStoredHistory();
    set({
      lastCompleted: stored.lastCompleted,
      history: stored.history,
      hydrated: true,
    });
  },

  recordRouteCompleted: async (summary) => {
    const entry: CompletedRouteSummary = {
      ...summary,
      rotaId: String(summary.rotaId),
      completedAt: new Date().toISOString(),
    };
    const prev = get().history.filter((h) => h.rotaId !== entry.rotaId);
    const history = [entry, ...prev].slice(0, MAX_HISTORY);
    await persistHistory({ lastCompleted: entry, history });
    const timer = get().ephemeralTimer;
    if (timer) clearTimeout(timer);
    set({
      ephemeralCompleted: entry,
      lastCompleted: entry,
      history,
      ephemeralTimer: null,
    });
    get().scheduleEphemeralClear();
  },

  clearEphemeral: () => {
    const timer = get().ephemeralTimer;
    if (timer) clearTimeout(timer);
    set({ ephemeralCompleted: null, ephemeralTimer: null });
  },

  scheduleEphemeralClear: () => {
    const timer = get().ephemeralTimer;
    if (timer) clearTimeout(timer);
    const newTimer = setTimeout(() => {
      set({ ephemeralCompleted: null, ephemeralTimer: null });
    }, EPHEMERAL_TTL_MS);
    set({ ephemeralTimer: newTimer });
  },
}));

export async function recordHomeRouteCompleted(
  rotaId: string | number,
  paradas: number,
  pedidos: number
): Promise<void> {
  await useHomeRouteStore.getState().recordRouteCompleted({
    rotaId: String(rotaId),
    paradas,
    pedidos,
  });
}
