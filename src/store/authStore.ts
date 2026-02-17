import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "access_token";

interface AuthState {
  token: string | null;
  isLoading: boolean;
  setToken: (token: string | null) => Promise<void>;
  loadToken: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isLoading: true,

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
      set({ token, isLoading: false });
    } catch {
      set({ token: null, isLoading: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null });
  },
}));
