import { Alert } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import {
  ACTIVE_ROUTE_PENDING_MESSAGE,
  PENDING_ADDED_MESSAGE,
  PENDING_ADDED_TITLE,
  resolvePostScanRouteContext,
} from "./postScanRouteFlowCore";

export {
  ACTIVE_ROUTE_PENDING_MESSAGE,
  PENDING_ADDED_MESSAGE,
  PENDING_ADDED_TITLE,
  deliveryNeedsAddressForRoute,
  resolvePostScanRouteContext,
  type PostScanRouteContext,
} from "./postScanRouteFlowCore";

type ScanNavigation = NativeStackNavigationProp<RootStackParamList, "Scan">;

export function notifyPendingAdded(): void {
  Alert.alert(PENDING_ADDED_TITLE, PENDING_ADDED_MESSAGE);
}

export function notifyActiveRoutePendingAdded(): void {
  Alert.alert(PENDING_ADDED_TITLE, ACTIVE_ROUTE_PENDING_MESSAGE);
}

export async function runPostScanRouteFlow(
  idSaida: number,
  navigation: ScanNavigation,
  loadDeliveries: (opts?: { onlyToday?: boolean }) => Promise<{ ok: boolean; count: number }>
): Promise<void> {
  await loadDeliveries();
  const roteirizacaoHabilitada = useMotoboyPrefsStore.getState().roteirizacaoHabilitada;
  const { routeOrder, activeRouteId } = useDeliveryStore.getState();
  const ctx = resolvePostScanRouteContext({
    roteirizacaoHabilitada,
    routeOrderLength: routeOrder.length,
    activeRouteId,
  });

  if (ctx === "route_active_notify") {
    notifyActiveRoutePendingAdded();
    return;
  }

  if (ctx === "route_ready_gate") {
    Alert.alert(
      "Adicionar na rota?",
      "Este pacote foi inserido. Deseja incluí-lo na rota planejada agora?",
      [
        { text: "Não", style: "cancel", onPress: notifyPendingAdded },
        {
          text: "Sim",
          onPress: () =>
            navigation.navigate("RouteBuilder", { pendingAddToRoute: idSaida }),
        },
      ]
    );
  }
}
