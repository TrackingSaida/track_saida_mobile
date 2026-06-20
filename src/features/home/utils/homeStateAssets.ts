import type { OperationalIconKey } from "../../../theme/operationalIcons";

export type HomeHeroState =
  | "idle"
  | "pending"
  | "route_ready"
  | "route_active"
  | "route_completed";

export type HomeStateIconColorKey = "primary" | "success" | "warning" | "custom";

export type HomeStateVisual = {
  gradient: readonly [string, string];
  operationalIcon: OperationalIconKey;
  iconColorKey: HomeStateIconColorKey;
  /** Usado quando iconColorKey === "custom". */
  customIconColor?: string;
};

export const HOME_STATE_ASSETS: Record<HomeHeroState, HomeStateVisual> = {
  idle: {
    gradient: ["#2563eb", "#1d4ed8"],
    operationalIcon: "readyToScan",
    iconColorKey: "primary",
  },
  pending: {
    gradient: ["#2563eb", "#ea580c"],
    operationalIcon: "packagesWaiting",
    iconColorKey: "custom",
    customIconColor: "#F97316",
  },
  route_ready: {
    gradient: ["#6366f1", "#2563eb"],
    operationalIcon: "prepareRoute",
    iconColorKey: "primary",
  },
  route_active: {
    gradient: ["#0a6e42", "#059669"],
    operationalIcon: "routeActive",
    iconColorKey: "success",
  },
  route_completed: {
    gradient: ["#059669", "#10b981"],
    operationalIcon: "delivered",
    iconColorKey: "success",
  },
};

export const HOME_PAGE_LABELS = ["Agora", "Resumo", "Atalhos"] as const;

export function resolveHomeStateIconColor(
  visual: HomeStateVisual,
  colors: { primary: string; success: string; warning: string }
): string {
  switch (visual.iconColorKey) {
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "custom":
      return visual.customIconColor ?? colors.primary;
    case "primary":
    default:
      return colors.primary;
  }
}
