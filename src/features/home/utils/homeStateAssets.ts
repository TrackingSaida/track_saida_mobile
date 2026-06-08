import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { ImageSourcePropType } from "react-native";

export type HomeHeroState =
  | "idle"
  | "pending"
  | "route_ready"
  | "route_active"
  | "route_completed";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type HomeStateVisual = {
  image: ImageSourcePropType;
  gradient: readonly [string, string];
  fallbackIcon: IoniconName;
  fallbackIconColor: string;
};

export const HOME_STATE_ASSETS: Record<HomeHeroState, HomeStateVisual> = {
  idle: {
    image: require("../../../assets/homeStates/home-scan.png"),
    gradient: ["#2563eb", "#1d4ed8"],
    fallbackIcon: "scan-outline",
    fallbackIconColor: "#2563eb",
  },
  pending: {
    image: require("../../../assets/homeStates/home-pending.png"),
    gradient: ["#2563eb", "#ea580c"],
    fallbackIcon: "cube-outline",
    fallbackIconColor: "#ea580c",
  },
  route_ready: {
    image: require("../../../assets/homeStates/home-route-ready.png"),
    gradient: ["#6366f1", "#2563eb"],
    fallbackIcon: "map-outline",
    fallbackIconColor: "#6366f1",
  },
  route_active: {
    image: require("../../../assets/homeStates/home-route-active.png"),
    gradient: ["#0a6e42", "#059669"],
    fallbackIcon: "navigate-outline",
    fallbackIconColor: "#0a6e42",
  },
  route_completed: {
    image: require("../../../assets/homeStates/home-route-completed.png"),
    gradient: ["#059669", "#10b981"],
    fallbackIcon: "checkmark-circle-outline",
    fallbackIconColor: "#059669",
  },
};

export const HOME_PAGE_LABELS = ["Próximo", "Hoje", "Atalhos"] as const;
