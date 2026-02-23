import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

const TOKEN_KEY = "access_token";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";

interface AuthState {
  token: string | null;
  isLoading: boolean;
  requiresBiometricUnlock: boolean;
  setToken: (token: string | null) => Promise<void>;
  loadToken: () => Promise<void>;
  logout: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlockWithBiometric: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isLoading: true,
  requiresBiometricUnlock: false,

  setToken: async (token: string | null) => {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    set({ token });
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const biometricEnabled =
        (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === "true";

      if (!token) {
        set({ token: null, isLoading: false, requiresBiometricUnlock: false });
        return;
      }

      if (!biometricEnabled) {
        set({ token, isLoading: false, requiresBiometricUnlock: false });
        return;
      }

      set({
        token: null,
        isLoading: false,
        requiresBiometricUnlock: true,
      });
    } catch {
      set({ token: null, isLoading: false, requiresBiometricUnlock: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    set({ token: null, requiresBiometricUnlock: false });
  },

  setBiometricEnabled: async (enabled: boolean) => {
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    }
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
      set({ token, requiresBiometricUnlock: false });
      return true;
    } catch {
      return false;
    }
  },
}));
