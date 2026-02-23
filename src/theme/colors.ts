import { useMemo } from "react";
import type { ThemeMode } from "../store/themeStore";
import { useThemeStore } from "../store/themeStore";

export interface ThemeColors {
  background: string;
  backgroundCard: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryContrast: string;
  border: string;
  separator: string;
  inputBackground: string;
  inputBorder: string;
  placeholder: string;
  success: string;
  danger: string;
  warning: string;
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  overlay: string;
  shadowColor: string;
}

export const LIGHT_COLORS: ThemeColors = {
  background: "#f5f5f5",
  backgroundCard: "#fff",
  text: "#333",
  textSecondary: "#666",
  primary: "#0d6efd",
  primaryContrast: "#fff",
  border: "#ddd",
  separator: "#eee",
  inputBackground: "#fff",
  inputBorder: "#ddd",
  placeholder: "#999",
  success: "#198754",
  danger: "#dc3545",
  warning: "#ffc107",
  tabBarBackground: "#fff",
  tabBarActive: "#0d6efd",
  tabBarInactive: "#666",
  overlay: "rgba(0,0,0,0.5)",
  shadowColor: "#000",
};

export const DARK_COLORS: ThemeColors = {
  background: "#121212",
  backgroundCard: "#1e1e1e",
  text: "#e0e0e0",
  textSecondary: "#b0b0b0",
  primary: "#4dabf7",
  primaryContrast: "#fff",
  border: "#333",
  separator: "#333",
  inputBackground: "#2d2d2d",
  inputBorder: "#444",
  placeholder: "#888",
  success: "#2f9e44",
  danger: "#e03131",
  warning: "#f59f00",
  tabBarBackground: "#1e1e1e",
  tabBarActive: "#4dabf7",
  tabBarInactive: "#b0b0b0",
  overlay: "rgba(0,0,0,0.7)",
  shadowColor: "#000",
};

export function getColors(theme: ThemeMode): ThemeColors {
  return theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
}

export function useThemeColors(): ThemeColors {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => getColors(theme), [theme]);
}
