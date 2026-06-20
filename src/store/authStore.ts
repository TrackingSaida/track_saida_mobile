import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import axios from "axios";
import { decodeJwtPayload, type JwtClaims } from "../utils/jwt";
import { getBiometricEnabled, setBiometricEnabled as persistBiometricEnabled } from "../services/settingsService";
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
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
    const claims = decodeJwtPayload(accessToken);
    set({
      token: accessToken,
      refreshToken: refreshToken ?? get().refreshToken,
      currentUser: claims,
      sessionExpiredVisible: false,
    });
    const { useMotoboyPrefsStore } = await import("./motoboyPrefsStore");
    await useMotoboyPrefsStore.getState().loadForCurrentUser();
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
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return false;
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const claims = decodeJwtPayload(token);
      set({ token, refreshToken, currentUser: claims, requiresBiometricUnlock: false });
      const { useMotoboyPrefsStore } = await import("./motoboyPrefsStore");
      await useMotoboyPrefsStore.getState().loadForCurrentUser();
      const { recoverRouteState } = await import("../features/entregas/services/routeRecovery");
      await recoverRouteState({ force: true });
      return true;
    } catch {
      return false;
    }
  },
}));
