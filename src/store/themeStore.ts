import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const THEME_KEY = "app_theme";

export type ThemeMode = "light" | "dark";

interface ThemeState {
  theme: ThemeMode;
  isLoading: boolean;
  setTheme: (theme: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "light",
  isLoading: true,

  setTheme: async (theme: ThemeMode) => {
    await SecureStore.setItemAsync(THEME_KEY, theme);
    set({ theme });
  },

  loadTheme: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      const theme = stored === "dark" ? "dark" : "light";
      set({ theme, isLoading: false });
    } catch {
      set({ theme: "light", isLoading: false });
    }
  },
}));
