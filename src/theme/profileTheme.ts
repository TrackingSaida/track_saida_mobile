import { useMemo } from "react";
import type { ThemeMode } from "../store/themeStore";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { isMotoboyRole } from "../utils/role";
import { getColors } from "./colors";

export type ProfileTheme = {
  accent: string;
  accentSoft: string;
  contrastOnAccent: string;
  headerGradient: readonly [string, string];
  tabBarActive: string;
};

/**
 * Cores de destaque e gradiente de header por perfil (Operador/Admin = azul, Entregador = verde).
 */
export function getProfileThemeColors(theme: ThemeMode, role: number | undefined): ProfileTheme {
  const c = getColors(theme);
  if (isMotoboyRole(role)) {
    return {
      accent: c.deliveryAccent,
      accentSoft: c.deliveryAccentSoft,
      contrastOnAccent: c.primaryContrast,
      headerGradient: [c.deliveryHeaderGradientStart, c.deliveryHeaderGradientEnd] as const,
      tabBarActive: c.deliveryAccent,
    };
  }
  return {
    accent: c.primary,
    accentSoft: c.primarySoft,
    contrastOnAccent: c.primaryContrast,
    headerGradient: [c.operatorHeaderGradientStart, c.operatorHeaderGradientEnd] as const,
    tabBarActive: c.primary,
  };
}

export function useProfileTheme(): ProfileTheme {
  const theme = useThemeStore((s) => s.theme);
  const role = useAuthStore((s) => s.currentUser?.role) as number | undefined;
  return useMemo(() => getProfileThemeColors(theme, role), [theme, role]);
}
