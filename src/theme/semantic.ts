import { useMemo } from "react";
import type { ThemeMode } from "../store/themeStore";
import { useThemeStore } from "../store/themeStore";
import { DARK_COLORS, LIGHT_COLORS } from "./colors";

export type SemanticKey =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "route"
  | "collection"
  | "marketplaceShopee"
  | "marketplaceML"
  | "marketplaceAvulso"
  | "neutral";

export type SemanticTone = {
  fg: string;
  fgMuted: string;
  bg: string;
  bgFilled: string;
  bgFilledEnd: string;
  border: string;
  bar: string;
  iconBg: string;
};

const LIGHT_SEMANTIC: Record<SemanticKey, SemanticTone> = {
  primary: {
    fg: LIGHT_COLORS.primary,
    fgMuted: "#3b82c4",
    bg: "rgba(13,110,253,0.08)",
    bgFilled: "#E8F1FF",
    bgFilledEnd: "#F4F8FF",
    border: "rgba(13,110,253,0.22)",
    bar: LIGHT_COLORS.primary,
    iconBg: "rgba(13,110,253,0.14)",
  },
  success: {
    fg: LIGHT_COLORS.success,
    fgMuted: "#3d9a6a",
    bg: "rgba(25,135,84,0.08)",
    bgFilled: "#E8F6EE",
    bgFilledEnd: "#F3FAF6",
    border: "rgba(25,135,84,0.22)",
    bar: LIGHT_COLORS.success,
    iconBg: "rgba(25,135,84,0.14)",
  },
  warning: {
    fg: "#b45309",
    fgMuted: "#d97706",
    bg: "rgba(245,158,11,0.10)",
    bgFilled: "#FFF6E5",
    bgFilledEnd: "#FFFBF3",
    border: "rgba(245,158,11,0.28)",
    bar: "#f59e0b",
    iconBg: "rgba(245,158,11,0.16)",
  },
  danger: {
    fg: LIGHT_COLORS.danger,
    fgMuted: "#e35d6a",
    bg: "rgba(220,53,69,0.08)",
    bgFilled: "#FDECEC",
    bgFilledEnd: "#FFF6F6",
    border: "rgba(220,53,69,0.22)",
    bar: LIGHT_COLORS.danger,
    iconBg: "rgba(220,53,69,0.14)",
  },
  route: {
    fg: "#c2410c",
    fgMuted: "#ea580c",
    bg: "rgba(234,88,12,0.08)",
    bgFilled: "#FFF1E6",
    bgFilledEnd: "#FFF8F1",
    border: "rgba(234,88,12,0.24)",
    bar: "#f59e0b",
    iconBg: "rgba(234,88,12,0.14)",
  },
  collection: {
    fg: "#6d28d9",
    fgMuted: "#7c3aed",
    bg: "rgba(109,40,217,0.08)",
    bgFilled: "#F3EEFF",
    bgFilledEnd: "#F8F5FF",
    border: "rgba(109,40,217,0.22)",
    bar: "#7c3aed",
    iconBg: "rgba(109,40,217,0.14)",
  },
  marketplaceShopee: {
    fg: "#c2410c",
    fgMuted: "#ee4d2d",
    bg: "rgba(238,77,45,0.08)",
    bgFilled: "#FEECEA",
    bgFilledEnd: "#FFF6F4",
    border: "rgba(238,77,45,0.28)",
    bar: "#ee4d2d",
    iconBg: "rgba(238,77,45,0.14)",
  },
  marketplaceML: {
    fg: "#a16207",
    fgMuted: "#c9a227",
    bg: "rgba(201,162,39,0.12)",
    bgFilled: "#FBF6E8",
    bgFilledEnd: "#FFFCF3",
    border: "rgba(201,162,39,0.35)",
    bar: "#c9a227",
    iconBg: "rgba(201,162,39,0.18)",
  },
  marketplaceAvulso: {
    fg: "#475569",
    fgMuted: "#64748b",
    bg: "rgba(100,116,139,0.10)",
    bgFilled: "#F1F5F9",
    bgFilledEnd: "#F8FAFC",
    border: "rgba(100,116,139,0.28)",
    bar: "#64748b",
    iconBg: "rgba(100,116,139,0.16)",
  },
  neutral: {
    fg: LIGHT_COLORS.text,
    fgMuted: LIGHT_COLORS.textSecondary,
    bg: LIGHT_COLORS.chipBackground,
    bgFilled: LIGHT_COLORS.backgroundCard,
    bgFilledEnd: LIGHT_COLORS.backgroundCard,
    border: LIGHT_COLORS.border,
    bar: LIGHT_COLORS.textSecondary,
    iconBg: LIGHT_COLORS.chipBackground,
  },
};

const DARK_SEMANTIC: Record<SemanticKey, SemanticTone> = {
  primary: {
    fg: DARK_COLORS.primary,
    fgMuted: "#7ab8f0",
    bg: "rgba(77,171,247,0.12)",
    bgFilled: "#152238",
    bgFilledEnd: "#121820",
    border: "rgba(77,171,247,0.28)",
    bar: DARK_COLORS.primary,
    iconBg: "rgba(77,171,247,0.18)",
  },
  success: {
    fg: "#3dd68c",
    fgMuted: "#6ee7b7",
    bg: "rgba(61,214,140,0.12)",
    bgFilled: "#14241c",
    bgFilledEnd: "#121816",
    border: "rgba(61,214,140,0.26)",
    bar: "#3dd68c",
    iconBg: "rgba(61,214,140,0.18)",
  },
  warning: {
    fg: "#fbbf24",
    fgMuted: "#fcd34d",
    bg: "rgba(245,158,11,0.14)",
    bgFilled: "#2a2212",
    bgFilledEnd: "#1c1812",
    border: "rgba(245,158,11,0.30)",
    bar: "#f59e0b",
    iconBg: "rgba(245,158,11,0.20)",
  },
  danger: {
    fg: "#f87171",
    fgMuted: "#fca5a5",
    bg: "rgba(224,49,49,0.14)",
    bgFilled: "#2a1518",
    bgFilledEnd: "#1c1214",
    border: "rgba(224,49,49,0.30)",
    bar: "#e03131",
    iconBg: "rgba(224,49,49,0.20)",
  },
  route: {
    fg: "#fb923c",
    fgMuted: "#fdba74",
    bg: "rgba(234,88,12,0.16)",
    bgFilled: "#2a1f12",
    bgFilledEnd: "#1c1612",
    border: "rgba(234,88,12,0.32)",
    bar: "#f59e0b",
    iconBg: "rgba(234,88,12,0.22)",
  },
  collection: {
    fg: "#c4b5fd",
    fgMuted: "#ddd6fe",
    bg: "rgba(167,139,250,0.14)",
    bgFilled: "#1e1730",
    bgFilledEnd: "#16141f",
    border: "rgba(167,139,250,0.28)",
    bar: "#a78bfa",
    iconBg: "rgba(167,139,250,0.20)",
  },
  marketplaceShopee: {
    fg: "#fb7185",
    fgMuted: "#fda4af",
    bg: "rgba(238,77,45,0.16)",
    bgFilled: "#2a1716",
    bgFilledEnd: "#1c1414",
    border: "rgba(238,77,45,0.32)",
    bar: "#ee4d2d",
    iconBg: "rgba(238,77,45,0.22)",
  },
  marketplaceML: {
    fg: "#fbbf24",
    fgMuted: "#fde68a",
    bg: "rgba(201,162,39,0.16)",
    bgFilled: "#2a2414",
    bgFilledEnd: "#1c1a12",
    border: "rgba(201,162,39,0.32)",
    bar: "#c9a227",
    iconBg: "rgba(201,162,39,0.22)",
  },
  marketplaceAvulso: {
    fg: "#94a3b8",
    fgMuted: "#cbd5e1",
    bg: "rgba(148,163,184,0.14)",
    bgFilled: "#1c2228",
    bgFilledEnd: "#161a1e",
    border: "rgba(148,163,184,0.28)",
    bar: "#94a3b8",
    iconBg: "rgba(148,163,184,0.18)",
  },
  neutral: {
    fg: DARK_COLORS.text,
    fgMuted: DARK_COLORS.textSecondary,
    bg: DARK_COLORS.chipBackground,
    bgFilled: DARK_COLORS.backgroundCard,
    bgFilledEnd: DARK_COLORS.backgroundCard,
    border: DARK_COLORS.border,
    bar: DARK_COLORS.textSecondary,
    iconBg: DARK_COLORS.chipBackground,
  },
};

export function getSemanticTones(mode: ThemeMode): Record<SemanticKey, SemanticTone> {
  return mode === "dark" ? DARK_SEMANTIC : LIGHT_SEMANTIC;
}

export function useSemanticTones(): Record<SemanticKey, SemanticTone> {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => getSemanticTones(theme), [theme]);
}

export function serviceSemanticKey(nome: string): SemanticKey {
  if (nome === "Shopee") return "marketplaceShopee";
  if (nome === "Mercado Livre") return "marketplaceML";
  if (nome === "Avulso") return "marketplaceAvulso";
  return "neutral";
}
