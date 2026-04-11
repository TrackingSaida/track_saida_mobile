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
  /** Gradiente tela de login: início */
  loginGradientStart: string;
  /** Gradiente tela de login: fim */
  loginGradientEnd: string;
  /** Fundo de chips / meta pills */
  chipBackground: string;
  /** Primário em baixa opacidade (fundo de ícones, pills ativos) */
  primarySoft: string;
  /** Gradiente header Operador/Admin: topo */
  operatorHeaderGradientStart: string;
  /** Gradiente header Operador/Admin: fundo da tela */
  operatorHeaderGradientEnd: string;
  /** Gradiente header Entregador: topo */
  deliveryHeaderGradientStart: string;
  /** Gradiente header Entregador: fundo da tela */
  deliveryHeaderGradientEnd: string;
  /** Cor de destaque do perfil entregador (botões, tab ativa, KPI) */
  deliveryAccent: string;
  /** Entregador: fundo suave para ícones / anéis */
  deliveryAccentSoft: string;
}

export const LIGHT_COLORS: ThemeColors = {
  background: "#F8FAFC",
  backgroundCard: "#ffffff",
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
  loginGradientStart: "#e3f2fd",
  loginGradientEnd: "#F8FAFC",
  chipBackground: "#f0f4f8",
  primarySoft: "rgba(13,110,253,0.12)",
  operatorHeaderGradientStart: "#E8F1FF",
  operatorHeaderGradientEnd: "#F8FAFC",
  deliveryHeaderGradientStart: "#E4F4EC",
  deliveryHeaderGradientEnd: "#F8FAFC",
  deliveryAccent: "#0d8f54",
  deliveryAccentSoft: "rgba(13,143,84,0.14)",
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
  loginGradientStart: "#1a1a2e",
  loginGradientEnd: "#121212",
  chipBackground: "#2a2a2a",
  primarySoft: "rgba(77,171,247,0.18)",
  operatorHeaderGradientStart: "#1a2838",
  operatorHeaderGradientEnd: "#121212",
  deliveryHeaderGradientStart: "#1a2e24",
  deliveryHeaderGradientEnd: "#121212",
  deliveryAccent: "#3dd68c",
  deliveryAccentSoft: "rgba(61,214,140,0.18)",
};

export function getColors(theme: ThemeMode): ThemeColors {
  return theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
}

export function useThemeColors(): ThemeColors {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => getColors(theme), [theme]);
}
