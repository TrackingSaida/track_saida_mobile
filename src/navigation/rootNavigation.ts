import { createNavigationContainerRef } from "@react-navigation/native";

/** Ref global do NavigationContainer — uso fora de screens (gates, push, etc.). */
export const rootNavigationRef = createNavigationContainerRef();

export function getCurrentRouteName(): string {
  if (!rootNavigationRef.isReady()) return "";
  return rootNavigationRef.getCurrentRoute()?.name ?? "";
}
