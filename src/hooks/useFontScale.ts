import { useMemo } from "react";
import { PixelRatio } from "react-native";

/**
 * Escala de fonte do sistema (acessibilidade).
 * Padrão B: sem teto — layouts devem usar minHeight / wrap / onLayout.
 */
export function useFontScale() {
  const fontScale = PixelRatio.getFontScale();

  return useMemo(() => {
    const scale = (n: number) => Math.round(n * fontScale);
    /** Escala com piso (útil para chrome: tab bar, chips). */
    const ms = (n: number, min = n) => Math.max(min, scale(n));
    return { fontScale, scale, ms };
  }, [fontScale]);
}
