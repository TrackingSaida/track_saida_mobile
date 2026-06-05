import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "./authStore";
import type { PrepOrdemModo, ServicoTipo } from "../features/entregas/utils/servico";

const SOMENTE_HOJE_DEFAULT = true;
const ROTEIRIZACAO_DEFAULT = false;
const PREP_ORDEM_MODO_DEFAULT: PrepOrdemModo = "servico";
const PREP_SERVICO_INICIO_DEFAULT: ServicoTipo = "Shopee";

interface MotoboyPrefsState {
  somenteHojePendentes: boolean;
  roteirizacaoHabilitada: boolean;
  prepOrdemModo: PrepOrdemModo;
  prepServicoInicio: ServicoTipo;
  cidadePadrao: string;
  estadoPadrao: string;
  isLoading: boolean;
  loadForCurrentUser: () => Promise<void>;
  setSomenteHojePendentes: (value: boolean) => Promise<void>;
  setRoteirizacaoHabilitada: (value: boolean) => Promise<void>;
  setPrepOrdem: (modo: PrepOrdemModo, servicoInicio?: ServicoTipo) => Promise<void>;
  setCidadePadrao: (cidade: string, estado?: string) => Promise<void>;
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
  prepOrdemModo?: PrepOrdemModo;
  prepServicoInicio?: ServicoTipo;
  cidadePadrao?: string;
  estadoPadrao?: string;
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

function snapshotFromState(state: MotoboyPrefsState): StoredPrefs {
  return {
    somenteHojePendentes: state.somenteHojePendentes,
    roteirizacaoHabilitada: state.roteirizacaoHabilitada,
    prepOrdemModo: state.prepOrdemModo,
    prepServicoInicio: state.prepServicoInicio,
    cidadePadrao: state.cidadePadrao || undefined,
    estadoPadrao: state.estadoPadrao || undefined,
  };
}

async function writeStoredPrefs(prefs: StoredPrefs): Promise<void> {
  const key = getPrefsKey();
  if (!key) return;
  await SecureStore.setItemAsync(key, JSON.stringify(prefs));
}

export const useMotoboyPrefsStore = create<MotoboyPrefsState>((set, get) => ({
  somenteHojePendentes: SOMENTE_HOJE_DEFAULT,
  roteirizacaoHabilitada: ROTEIRIZACAO_DEFAULT,
  prepOrdemModo: PREP_ORDEM_MODO_DEFAULT,
  prepServicoInicio: PREP_SERVICO_INICIO_DEFAULT,
  cidadePadrao: "",
  estadoPadrao: "SP",
  isLoading: false,

  loadForCurrentUser: async () => {
    set({ isLoading: true });
    try {
      const stored = await readStoredPrefs();
      set({
        somenteHojePendentes: stored?.somenteHojePendentes ?? SOMENTE_HOJE_DEFAULT,
        roteirizacaoHabilitada: stored?.roteirizacaoHabilitada ?? ROTEIRIZACAO_DEFAULT,
        prepOrdemModo: stored?.prepOrdemModo ?? PREP_ORDEM_MODO_DEFAULT,
        prepServicoInicio: stored?.prepServicoInicio ?? PREP_SERVICO_INICIO_DEFAULT,
        cidadePadrao: stored?.cidadePadrao ?? "",
        estadoPadrao: stored?.estadoPadrao ?? "SP",
        isLoading: false,
      });
    } catch {
      set({
        somenteHojePendentes: SOMENTE_HOJE_DEFAULT,
        roteirizacaoHabilitada: ROTEIRIZACAO_DEFAULT,
        prepOrdemModo: PREP_ORDEM_MODO_DEFAULT,
        prepServicoInicio: PREP_SERVICO_INICIO_DEFAULT,
        cidadePadrao: "",
        estadoPadrao: "SP",
        isLoading: false,
      });
    }
  },

  setSomenteHojePendentes: async (value: boolean) => {
    set({ somenteHojePendentes: value });
    await writeStoredPrefs(snapshotFromState(get()));
  },

  setRoteirizacaoHabilitada: async (value: boolean) => {
    set({ roteirizacaoHabilitada: value });
    await writeStoredPrefs(snapshotFromState(get()));
  },

  setPrepOrdem: async (modo, servicoInicio) => {
    set((state) => ({
      prepOrdemModo: modo,
      prepServicoInicio: servicoInicio ?? state.prepServicoInicio,
    }));
    await writeStoredPrefs(snapshotFromState(get()));
  },

  setCidadePadrao: async (cidade, estado) => {
    set((state) => ({
      cidadePadrao: cidade,
      estadoPadrao: estado ?? state.estadoPadrao,
    }));
    await writeStoredPrefs(snapshotFromState(get()));
  },
}));
