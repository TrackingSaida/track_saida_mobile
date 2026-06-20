import { create } from "zustand";
import { getTheme, setTheme as persistTheme } from "../services/settingsService";

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
    await persistTheme(theme);
    set({ theme });
  },

  loadTheme: async () => {
    try {
      const theme = await getTheme();
      set({ theme, isLoading: false });
    } catch {
      set({ theme: "light", isLoading: false });
    }
  },
}));
