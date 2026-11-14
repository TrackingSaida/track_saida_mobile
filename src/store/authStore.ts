import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import axios from "axios";
import { decodeJwtPayload, isJwtExpired, type JwtClaims } from "../utils/jwt";
import { normalizeTipoOwner } from "../utils/ownerLabels";
import { getBiometricEnabled, setBiometricEnabled as persistBiometricEnabled } from "../services/settingsService";
import { getSavedCredentials } from "../services/savedCredentials";
import { API_BASE_URL } from "../config/api";

const TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

let sessionExpiredCallback: (() => void) | null = null;

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  currentUser: JwtClaims | null;
  isLoading: boolean;
  requiresBiometricUnlock: boolean;
  sessionExpiredVisible: boolean;
  setToken: (token: string | null) => Promise<void>;
  setTokens: (accessToken: string, refreshToken?: string | null) => Promise<void>;
  loadToken: () => Promise<void>;
  logout: (opts?: { revokeRemote?: boolean }) => Promise<void>;
  onSessionExpired: () => Promise<void>;
  dismissSessionExpired: () => void;
  setSessionExpiredCallback: (cb: (() => void) | null) => void;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlockWithBiometric: () => Promise<boolean>;
  /** @deprecated use onSessionExpired */
  onUnauthorized: () => Promise<void>;
}

/** Flags de owner que a UI lê do JWT; `/auth/me` devolve o valor vivo do banco. */
type OwnerFlagsFromMe = Pick<
  JwtClaims,
  | "tipo_owner"
  | "confirmacao_saida_sessoes_habilitada"
  | "conferencia_saida_habilitada"
  | "entrada_obrigatoria_habilitada"
  | "bloquear_saida_sem_coleta"
  | "devolucao_sub_base_habilitada"
  | "ignorar_coleta"
  | "modo_operacao"
>;

async function fetchOwnerFlagsFromMe(token: string): Promise<Partial<OwnerFlagsFromMe> | null> {
  try {
    const { data } = await axios.get<Partial<OwnerFlagsFromMe>>(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: 10000,
    });
    if (!data || typeof data !== "object") return null;
    const patch: Partial<OwnerFlagsFromMe> = {};
    if (data.tipo_owner != null) {
      patch.tipo_owner = normalizeTipoOwner(data.tipo_owner);
    }
    if (typeof data.confirmacao_saida_sessoes_habilitada === "boolean") {
      patch.confirmacao_saida_sessoes_habilitada = data.confirmacao_saida_sessoes_habilitada;
    }
    if (typeof data.conferencia_saida_habilitada === "boolean") {
      patch.conferencia_saida_habilitada = data.conferencia_saida_habilitada;
    }
    if (typeof data.entrada_obrigatoria_habilitada === "boolean") {
      patch.entrada_obrigatoria_habilitada = data.entrada_obrigatoria_habilitada;
    }
    if (typeof data.bloquear_saida_sem_coleta === "boolean") {
      patch.bloquear_saida_sem_coleta = data.bloquear_saida_sem_coleta;
    }
    if (typeof data.devolucao_sub_base_habilitada === "boolean") {
      patch.devolucao_sub_base_habilitada = data.devolucao_sub_base_habilitada;
    }
    if (typeof data.ignorar_coleta === "boolean") {
      patch.ignorar_coleta = data.ignorar_coleta;
    }
    if (typeof data.modo_operacao === "string" && data.modo_operacao.trim()) {
      patch.modo_operacao = data.modo_operacao.trim();
    }
    return Object.keys(patch).length ? patch : null;
  } catch {
    return null;
  }
}

function mergeOwnerFlagsIntoCurrentUser(
  get: () => AuthState,
  set: (partial: Partial<AuthState>) => void,
  patch: Partial<OwnerFlagsFromMe> | null
): void {
  if (!patch) return;
  const current = get().currentUser;
  if (!current) return;
  let changed = false;
  const next: JwtClaims = { ...current };
  (Object.keys(patch) as (keyof OwnerFlagsFromMe)[]).forEach((key) => {
    const value = patch[key];
    if (value !== undefined && next[key] !== value) {
      (next as Record<string, unknown>)[key] = value;
      changed = true;
    }
  });
  if (changed) set({ currentUser: next });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  currentUser: null,
  isLoading: true,
  requiresBiometricUnlock: false,
  sessionExpiredVisible: false,

  setToken: async (token: string | null) => {
    if (token) {
      await get().setTokens(token, get().refreshToken);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      set({ token: null, refreshToken: null, currentUser: null });
    }
  },

  setTokens: async (accessToken: string, refreshToken?: string | null) => {
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    let nextRefresh = get().refreshToken;
    if (refreshToken === null) {
      // Staff login: limpa refresh de motoboy residual no mesmo aparelho.
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      nextRefresh = null;
    } else if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      nextRefresh = refreshToken;
    }
    const claims = decodeJwtPayload(accessToken);
    set({
      token: accessToken,
      refreshToken: nextRefresh,
      currentUser: claims,
      sessionExpiredVisible: false,
    });
    mergeOwnerFlagsIntoCurrentUser(get, set, await fetchOwnerFlagsFromMe(accessToken));
    const { useMotoboyPrefsStore } = await import("./motoboyPrefsStore");
    await useMotoboyPrefsStore.getState().loadForCurrentUser();
    try {
      const { syncPushRegistration } = await import("../services/push/pushService");
      await syncPushRegistration();
    } catch {
      /* push opcional */
    }
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const biometricEnabled = await getBiometricEnabled();

      if (!token) {
        set({
          token: null,
          refreshToken: null,
          currentUser: null,
          isLoading: false,
          requiresBiometricUnlock: false,
        });
        return;
      }

      if (!biometricEnabled) {
        const claims = decodeJwtPayload(token);
        set({
          token,
          refreshToken,
          currentUser: claims,
          isLoading: false,
          requiresBiometricUnlock: false,
        });
        void fetchOwnerFlagsFromMe(token).then((patch) => {
          mergeOwnerFlagsIntoCurrentUser(get, set, patch);
        });
        return;
      }

      set({
        token: null,
        refreshToken,
        currentUser: null,
        isLoading: false,
        requiresBiometricUnlock: true,
      });
    } catch {
      set({
        token: null,
        refreshToken: null,
        currentUser: null,
        isLoading: false,
        requiresBiometricUnlock: false,
      });
    }
  },

  logout: async (opts) => {
    try {
      const { unregisterPush } = await import("../services/push/pushService");
      await unregisterPush();
    } catch {
      /* ignore */
    }
    const refreshToken = get().refreshToken || (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
    if (opts?.revokeRemote !== false && refreshToken) {
      try {
        await axios.post(
          `${API_BASE_URL}/auth/motoboy-logout`,
          { refresh_token: refreshToken },
          { headers: { "Content-Type": "application/json" }, timeout: 10000 }
        );
      } catch {
        /* offline logout */
      }
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    try {
      const { clearRootLastSubBase } = await import("../services/rootSubBase");
      await clearRootLastSubBase();
    } catch {
      /* ignore */
    }
    try {
      const { useStaffScanSessionStore } = await import("./staffScanSessionStore");
      useStaffScanSessionStore.getState().clearSession();
    } catch {
      /* ignore */
    }
    set({
      token: null,
      refreshToken: null,
      currentUser: null,
      requiresBiometricUnlock: false,
      sessionExpiredVisible: false,
    });
  },

  onSessionExpired: async () => {
    set({ sessionExpiredVisible: true });
    if (sessionExpiredCallback) sessionExpiredCallback();
  },

  dismissSessionExpired: () => {
    set({ sessionExpiredVisible: false });
  },

  onUnauthorized: async () => {
    await get().onSessionExpired();
  },

  setSessionExpiredCallback: (cb: (() => void) | null) => {
    sessionExpiredCallback = cb;
  },

  setBiometricEnabled: async (enabled: boolean) => {
    await persistBiometricEnabled(enabled);
    set({});
  },

  unlockWithBiometric: async () => {
    try {
      const { success } = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloquear app",
        cancelLabel: "Cancelar",
      });
      if (!success) return false;

      let token = await SecureStore.getItemAsync(TOKEN_KEY);
      let refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      // Access expirado: tenta refresh (motoboy) ou re-login silencioso com credenciais salvas (staff).
      // Não usa refreshOnce/apiClient aqui — evita disparar “Sessão expirada” no meio do unlock.
      if (!token || isJwtExpired(token)) {
        let renewed = false;
        if (refreshToken) {
          try {
            const { motoboyRefresh } = await import("../api/auth");
            const data = await motoboyRefresh(refreshToken);
            if (data.access_token) {
              await get().setTokens(data.access_token, data.refresh_token ?? refreshToken);
              renewed = true;
              token = get().token;
              refreshToken = get().refreshToken;
            }
          } catch {
            // Refresh residual inválido (ex.: staff após login motoboy no mesmo aparelho).
            await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
            refreshToken = null;
          }
        }
        if (!renewed) {
          const saved = await getSavedCredentials();
          if (saved) {
            try {
              const { motoboyLogin, userLogin, rootSelectSubBase } = await import("../api/auth");
              try {
                const res = await motoboyLogin(saved.identifier, saved.password);
                if (res.access_token && !res.multiple_sub_base) {
                  await get().setTokens(res.access_token, res.refresh_token ?? null);
                  renewed = true;
                }
              } catch {
                const userRes = await userLogin(saved.identifier, saved.password, true);
                if (userRes.needs_sub_base_selection) {
                  const { getRootLastSubBase } = await import("../services/rootSubBase");
                  const lastSubBase = await getRootLastSubBase();
                  if (lastSubBase) {
                    try {
                      const rootRes = await rootSelectSubBase(
                        saved.identifier,
                        saved.password,
                        lastSubBase,
                        true
                      );
                      if (rootRes.access_token) {
                        await get().setTokens(rootRes.access_token, null);
                        renewed = true;
                      }
                    } catch {
                      renewed = false;
                    }
                  }
                } else if (userRes.access_token) {
                  await get().setTokens(userRes.access_token, null);
                  renewed = true;
                }
              }
              if (renewed) {
                token = get().token;
                refreshToken = get().refreshToken;
              }
            } catch {
              renewed = false;
            }
          }
        }
        if (!renewed || !token) {
          // Não entra no app com token morto (evita modal “Sessão expirada” logo após biometria).
          await get().logout({ revokeRemote: false });
          set({ requiresBiometricUnlock: false });
          return false;
        }
      }

      const claims = decodeJwtPayload(token);
      set({
        token,
        refreshToken,
        currentUser: claims,
        requiresBiometricUnlock: false,
        sessionExpiredVisible: false,
      });
      mergeOwnerFlagsIntoCurrentUser(get, set, await fetchOwnerFlagsFromMe(token));
      const { useMotoboyPrefsStore } = await import("./motoboyPrefsStore");
      await useMotoboyPrefsStore.getState().loadForCurrentUser();
      try {
        const { syncPushRegistration } = await import("../services/push/pushService");
        await syncPushRegistration();
      } catch {
        /* push opcional */
      }
      const { recoverRouteState } = await import("../features/entregas/services/routeRecovery");
      await recoverRouteState({ force: true });
      return true;
    } catch {
      return false;
    }
  },
}));
