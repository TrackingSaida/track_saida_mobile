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

async function fetchTipoOwnerFromMe(token: string): Promise<string | null> {
  try {
    const { data } = await axios.get<{ tipo_owner?: string }>(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: 10000,
    });
    if (data?.tipo_owner == null) return null;
    return normalizeTipoOwner(data.tipo_owner);
  } catch {
    return null;
  }
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
    const tipoOwner = await fetchTipoOwnerFromMe(accessToken);
    if (tipoOwner) {
      const current = get().currentUser;
      if (current && current.tipo_owner !== tipoOwner) {
        set({ currentUser: { ...current, tipo_owner: tipoOwner } });
      }
    }
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
        void fetchTipoOwnerFromMe(token).then((tipoOwner) => {
          const current = get().currentUser;
          if (tipoOwner && current && current.tipo_owner !== tipoOwner) {
            set({ currentUser: { ...current, tipo_owner: tipoOwner } });
          }
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
              const { motoboyLogin, userLogin } = await import("../api/auth");
              try {
                const res = await motoboyLogin(saved.identifier, saved.password);
                if (res.access_token && !res.multiple_sub_base) {
                  await get().setTokens(res.access_token, res.refresh_token ?? null);
                  renewed = true;
                }
              } catch {
                const userRes = await userLogin(saved.identifier, saved.password, true);
                if (userRes.access_token) {
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
      const tipoOwner = await fetchTipoOwnerFromMe(token);
      const current = get().currentUser;
      if (tipoOwner && current && current.tipo_owner !== tipoOwner) {
        set({ currentUser: { ...current, tipo_owner: tipoOwner } });
      }
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
