import { rootNavigationRef } from "./rootNavigation";
import { useAuthStore } from "../store/authStore";
import { isMotoboyRole } from "../utils/role";

export function navigateToAvisos(): void {
  if (!rootNavigationRef.isReady()) return;
  const role = useAuthStore.getState().currentUser?.role as number | undefined;
  const nav = rootNavigationRef as { navigate: (...args: unknown[]) => void };
  if (isMotoboyRole(role)) {
    nav.navigate("Avisos");
    return;
  }
  nav.navigate("Mais", { screen: "Avisos" });
}
