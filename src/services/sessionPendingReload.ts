import { useDeliveryStore } from "../store/deliveryStore";
import { useMotoboyPrefsStore } from "../store/motoboyPrefsStore";

let reloadInFlight: Promise<void> | null = null;

/**
 * Recarrega os pendentes na memória da sessão.
 * Usado na volta do sinal, independente da tela aberta ou da roteirização.
 */
export function reloadPendingDeliveriesForSession(): Promise<void> {
  if (reloadInFlight) return reloadInFlight;
  reloadInFlight = (async () => {
    try {
      const onlyToday = useMotoboyPrefsStore.getState().somenteHojePendentes;
      await useDeliveryStore.getState().loadDeliveries({ onlyToday });
    } finally {
      reloadInFlight = null;
    }
  })();
  return reloadInFlight;
}
