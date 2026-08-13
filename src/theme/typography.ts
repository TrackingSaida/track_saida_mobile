/**
 * Tokens tipográficos reutilizáveis.
 * Pesos: aplicar fontWeight nos estilos conforme necessário.
 * lineHeight relativo acompanha fontScale do sistema (padrão B).
 */
export const type = {
  screenTitle: 28,
  screenTitleMotoboy: 26,
  headerTitle: 17,
  subtitle: 16,
  body: 16,
  bodySmall: 14,
  caption: 12,
  label: 11,
  tabLabel: 12,
  metricLarge: 40,
  metricMedium: 26,
  sectionLabel: 12,
  badge: 10,
} as const;

export type TypeToken = keyof typeof type;

/** Fator de lineHeight por papel tipográfico. */
const LINE_HEIGHT_FACTOR: Record<TypeToken, number> = {
  screenTitle: 1.2,
  screenTitleMotoboy: 1.2,
  headerTitle: 1.25,
  subtitle: 1.35,
  body: 1.35,
  bodySmall: 1.35,
  caption: 1.3,
  label: 1.3,
  tabLabel: 1.2,
  metricLarge: 1.1,
  metricMedium: 1.15,
  sectionLabel: 1.3,
  badge: 1.2,
};

export function lineHeightFor(token: TypeToken, fontSize = type[token]): number {
  return Math.round(fontSize * LINE_HEIGHT_FACTOR[token]);
}

export function textStyle(token: TypeToken): { fontSize: number; lineHeight: number } {
  const fontSize = type[token];
  return { fontSize, lineHeight: lineHeightFor(token, fontSize) };
}
