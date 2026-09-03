import { rootNavigationRef } from "./rootNavigation";

export function navigateToAvisos(): void {
  if (!rootNavigationRef.isReady()) return;
  (rootNavigationRef as { navigate: (...args: unknown[]) => void }).navigate("Mais", {
    screen: "Avisos",
  });
}
