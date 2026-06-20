import { create } from "zustand";
import { useAuthStore } from "./authStore";
import type { PrepOrdemModo, ServicoTipo } from "../features/entregas/utils/servico";
import type { RoutePriority } from "../features/entregas/utils/routePriority";
import {
  SETTINGS_DEFAULTS,
  buildMotoboyPrefsKey,
  getMotoboyPrefs,
  setMotoboyPrefs,
  type StoredMotoboyPrefs,
} from "../services/settingsService";

interface MotoboyPrefsState {
  somenteHojePendentes: boolean;
  roteirizacaoHabilitada: boolean;
  prepOrdemModo: PrepOrdemModo;
  prepServicoInicio: ServicoTipo;
  routePriority: RoutePriority;
  cidadePadrao: string;
  estadoPadrao: string;
  isLoading: boolean;
  loadForCurrentUser: () => Promise<void>;
  resetToDefaults: () => void;
  setSomenteHojePendentes: (value: boolean) => Promise<void>;
  setRoteirizacaoHabilitada: (value: boolean) => Promise<void>;
  setPrepOrdem: (modo: PrepOrdemModo, servicoInicio?: ServicoTipo) => Promise<void>;
  setRoutePriority: (priority: RoutePriority) => Promise<void>;
  setCidadePadrao: (cidade: string, estado?: string) => Promise<void>;
}

function resolveUserKey(): string | null {
  return buildMotoboyPrefsKey(useAuthStore.getState().currentUser);
}

function snapshotFromState(state: MotoboyPrefsState): StoredMotoboyPrefs {
  return {
    somenteHojePendentes: state.somenteHojePendentes,
    roteirizacaoHabilitada: state.roteirizacaoHabilitada,
    prepOrdemModo: state.prepOrdemModo,
    prepServicoInicio: state.prepServicoInicio,
    routePriority: state.routePriority,
    cidadePadrao: state.cidadePadrao || undefined,
    estadoPadrao: state.estadoPadrao || undefined,
  };
}

function applyStoredPrefs(stored: StoredMotoboyPrefs | null): Partial<MotoboyPrefsState> {
  return {
    somenteHojePendentes: stored?.somenteHojePendentes ?? SETTINGS_DEFAULTS.somenteHojePendentes,
    roteirizacaoHabilitada: stored?.roteirizacaoHabilitada ?? SETTINGS_DEFAULTS.roteirizacaoHabilitada,
    prepOrdemModo: stored?.prepOrdemModo ?? SETTINGS_DEFAULTS.prepOrdemModo,
    prepServicoInicio: stored?.prepServicoInicio ?? SETTINGS_DEFAULTS.prepServicoInicio,
    routePriority: stored?.routePriority ?? SETTINGS_DEFAULTS.routePriority,
    cidadePadrao: stored?.cidadePadrao ?? SETTINGS_DEFAULTS.cidadePadrao,
    estadoPadrao: stored?.estadoPadrao ?? SETTINGS_DEFAULTS.estadoPadrao,
    isLoading: false,
  };
}

const defaultState = (): Omit<MotoboyPrefsState, "loadForCurrentUser" | "resetToDefaults" | "setSomenteHojePendentes" | "setRoteirizacaoHabilitada" | "setPrepOrdem" | "setRoutePriority" | "setCidadePadrao"> => ({
  somenteHojePendentes: SETTINGS_DEFAULTS.somenteHojePendentes,
  roteirizacaoHabilitada: SETTINGS_DEFAULTS.roteirizacaoHabilitada,
  prepOrdemModo: SETTINGS_DEFAULTS.prepOrdemModo,
  prepServicoInicio: SETTINGS_DEFAULTS.prepServicoInicio,
  routePriority: SETTINGS_DEFAULTS.routePriority,
  cidadePadrao: SETTINGS_DEFAULTS.cidadePadrao,
  estadoPadrao: SETTINGS_DEFAULTS.estadoPadrao,
  isLoading: false,
});

async function persistSnapshot(userKey: string | null, state: MotoboyPrefsState): Promise<void> {
  await setMotoboyPrefs(userKey, snapshotFromState(state));
}

export const useMotoboyPrefsStore = create<MotoboyPrefsState>((set, get) => ({
  ...defaultState(),

  loadForCurrentUser: async () => {
    const userKey = resolveUserKey();
    set({ isLoading: true });
    try {
      const stored = await getMotoboyPrefs(userKey);
      set(applyStoredPrefs(stored));
    } catch {
      set(applyStoredPrefs(null));
    }
  },

  resetToDefaults: () => {
    set(defaultState());
  },

  setSomenteHojePendentes: async (value: boolean) => {
    const userKey = resolveUserKey();
    const previous = get().somenteHojePendentes;
    set({ somenteHojePendentes: value });
    try {
      await persistSnapshot(userKey, get());
    } catch (error) {
      set({ somenteHojePendentes: previous });
      throw error;
    }
  },

  setRoteirizacaoHabilitada: async (value: boolean) => {
    const userKey = resolveUserKey();
    const previous = get().roteirizacaoHabilitada;
    set({ roteirizacaoHabilitada: value });
    try {
      await persistSnapshot(userKey, get());
    } catch (error) {
      set({ roteirizacaoHabilitada: previous });
      throw error;
    }
  },

  setRoutePriority: async (priority) => {
    const userKey = resolveUserKey();
    const previous = get().routePriority;
    set({ routePriority: priority });
    try {
      await persistSnapshot(userKey, get());
    } catch (error) {
      set({ routePriority: previous });
      throw error;
    }
  },

  setPrepOrdem: async (modo, servicoInicio) => {
    const userKey = resolveUserKey();
    const previous = {
      prepOrdemModo: get().prepOrdemModo,
      prepServicoInicio: get().prepServicoInicio,
    };
    set((state) => ({
      prepOrdemModo: modo,
      prepServicoInicio: servicoInicio ?? state.prepServicoInicio,
    }));
    try {
      await persistSnapshot(userKey, get());
    } catch (error) {
      set(previous);
      throw error;
    }
  },

  setCidadePadrao: async (cidade, estado) => {
    const userKey = resolveUserKey();
    const previous = {
      cidadePadrao: get().cidadePadrao,
      estadoPadrao: get().estadoPadrao,
    };
    set((state) => ({
      cidadePadrao: cidade,
      estadoPadrao: estado ?? state.estadoPadrao,
    }));
    try {
      await persistSnapshot(userKey, get());
    } catch (error) {
      set(previous);
      throw error;
    }
  },
}));
