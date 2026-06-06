import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { decodeJwtPayload, type JwtClaims } from "../utils/jwt";
import { getBiometricEnabled, setBiometricEnabled as persistBiometricEnabled } from "../services/settingsService";

const TOKEN_KEY = "access_token";

let sessionExpiredCallback: (() => void) | null = null;

interface AuthState {
  token: string | null;
  currentUser: JwtClaims | null;
  isLoading: boolean;
  requiresBiometricUnlock: boolean;
  setToken: (token: string | null) => Promise<void>;
  loadToken: () => Promise<void>;
  logout: () => Promise<void>;
  /** Chamado quando o servidor retorna 401 (token expirado/inválido). Faz logout e notifica o app para ir à tela de login. */
  onUnauthorized: () => Promise<void>;
  /** Registrar callback chamado após onUnauthorized (ex.: fechar navegação e mostrar login). */
  setSessionExpiredCallback: (cb: (() => void) | null) => void;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlockWithBiometric: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  currentUser: null,
  isLoading: true,
  requiresBiometricUnlock: false,

  setToken: async (token: string | null) => {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      const claims = decodeJwtPayload(token);
      set({ token, currentUser: claims });
      const { useMotoboyPrefsStore } = await import("./motoboyPrefsStore");
      await useMotoboyPrefsStore.getState().loadForCurrentUser();
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      set({ token: null, currentUser: null });
    }
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const biometricEnabled = await getBiometricEnabled();

      if (!token) {
        set({
          token: null,
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
          currentUser: claims,
          isLoading: false,
          requiresBiometricUnlock: false,
        });
        return;
      }

      set({
        token: null,
        currentUser: null,
        isLoading: false,
        requiresBiometricUnlock: true,
      });
    } catch {
      set({
        token: null,
        currentUser: null,
        isLoading: false,
        requiresBiometricUnlock: false,
      });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, currentUser: null, requiresBiometricUnlock: false });
  },

  onUnauthorized: async () => {
    await get().logout();
    if (sessionExpiredCallback) sessionExpiredCallback();
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
        promptMessage: "Use a biometria para entrar no app",
        cancelLabel: "Cancelar",
      });
      if (!success) return false;
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return false;
      const claims = decodeJwtPayload(token);
      set({ token, currentUser: claims, requiresBiometricUnlock: false });
      const { useMotoboyPrefsStore } = await import("./motoboyPrefsStore");
      await useMotoboyPrefsStore.getState().loadForCurrentUser();
      return true;
    } catch {
      return false;
    }
  },
}));
