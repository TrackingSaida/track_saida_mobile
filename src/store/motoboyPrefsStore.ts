import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "./authStore";

const SOMENTE_HOJE_DEFAULT = true;
const ROTEIRIZACAO_DEFAULT = false;

interface MotoboyPrefsState {
  somenteHojePendentes: boolean;
  roteirizacaoHabilitada: boolean;
  isLoading: boolean;
  loadForCurrentUser: () => Promise<void>;
  setSomenteHojePendentes: (value: boolean) => Promise<void>;
  setRoteirizacaoHabilitada: (value: boolean) => Promise<void>;
}

function getPrefsKey(): string | null {
  const user = useAuthStore.getState().currentUser;
  if (!user) return null;
  const motoboyId = user.motoboy_id != null ? String(user.motoboy_id) : "";
  const username = (user.username as string | undefined) || "";
  const suffix = motoboyId || username;
  if (!suffix) return null;
  return `motoboy_prefs:${suffix}`;
}

type StoredPrefs = {
  somenteHojePendentes?: boolean;
  roteirizacaoHabilitada?: boolean;
};

async function readStoredPrefs(): Promise<StoredPrefs | null> {
  const key = getPrefsKey();
  if (!key) return null;
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPrefs;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStoredPrefs(prefs: StoredPrefs): Promise<void> {
  const key = getPrefsKey();
  if (!key) return;
  await SecureStore.setItemAsync(key, JSON.stringify(prefs));
}

export const useMotoboyPrefsStore = create<MotoboyPrefsState>((set, get) => ({
  somenteHojePendentes: SOMENTE_HOJE_DEFAULT,
  roteirizacaoHabilitada: ROTEIRIZACAO_DEFAULT,
  isLoading: false,

  loadForCurrentUser: async () => {
    set({ isLoading: true });
    try {
      const stored = await readStoredPrefs();
      set({
        somenteHojePendentes: stored?.somenteHojePendentes ?? SOMENTE_HOJE_DEFAULT,
        roteirizacaoHabilitada: stored?.roteirizacaoHabilitada ?? ROTEIRIZACAO_DEFAULT,
        isLoading: false,
      });
    } catch {
      set({
        somenteHojePendentes: SOMENTE_HOJE_DEFAULT,
        roteirizacaoHabilitada: ROTEIRIZACAO_DEFAULT,
        isLoading: false,
      });
    }
  },

  setSomenteHojePendentes: async (value: boolean) => {
    set({ somenteHojePendentes: value });
    const current = get();
    await writeStoredPrefs({
      somenteHojePendentes: value,
      roteirizacaoHabilitada: current.roteirizacaoHabilitada,
    });
  },

  setRoteirizacaoHabilitada: async (value: boolean) => {
    set({ roteirizacaoHabilitada: value });
    const current = get();
    await writeStoredPrefs({
      somenteHojePendentes: current.somenteHojePendentes,
      roteirizacaoHabilitada: value,
    });
  },
}));
