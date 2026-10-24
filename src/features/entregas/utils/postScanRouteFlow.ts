import { Alert } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import type { EntregaListItem } from "../types";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import {
  ACTIVE_ROUTE_PENDING_MESSAGE,
  PENDING_ADDED_MESSAGE,
  PENDING_ADDED_TITLE,
  deliveryNeedsAddressForRoute,
  resolvePostScanRouteContext,
  shouldPromptAddressDuringScan,
} from "./postScanRouteFlowCore";

export {
  ACTIVE_ROUTE_PENDING_MESSAGE,
  PENDING_ADDED_MESSAGE,
  PENDING_ADDED_TITLE,
  deliveryNeedsAddressForRoute,
  resolvePostScanRouteContext,
  shouldPromptAddressDuringScan,
  type PostScanRouteContext,
} from "./postScanRouteFlowCore";

type ScanNavigation = NativeStackNavigationProp<RootStackParamList, "Scan">;

export function notifyPendingAdded(): void {
  Alert.alert(PENDING_ADDED_TITLE, PENDING_ADDED_MESSAGE);
}

export function notifyActiveRoutePendingAdded(): void {
  Alert.alert(PENDING_ADDED_TITLE, ACTIVE_ROUTE_PENDING_MESSAGE);
}

export type PostScanRouteFlowOpts = {
  /** Entrega retornada pelo /scan — upsert local, sem GET /entregas. */
  delivery?: EntregaListItem | null;
};

/**
 * Pós-bipagem: atualiza store local e, se houver rota, pergunta/notifica.
 * Não chama loadDeliveries no hot path (listagem completa derruba a API).
 */
export function runPostScanRouteFlow(
  idSaida: number,
  navigation: ScanNavigation,
  opts?: PostScanRouteFlowOpts
): void {
  const delivery = opts?.delivery ?? null;
  if (delivery) {
    useDeliveryStore.getState().upsertPendingDelivery(delivery);
  }

  const roteirizacaoHabilitada = useMotoboyPrefsStore.getState().roteirizacaoHabilitada;
  const prepararDuranteBipagem =
    useMotoboyPrefsStore.getState().prepararRotaMomento === "durante_bipagem";
  const { routeOrder, activeRouteId } = useDeliveryStore.getState();
  const ctx = resolvePostScanRouteContext({
    roteirizacaoHabilitada,
    routeOrderLength: routeOrder.length,
    activeRouteId,
  });

  if (
    delivery &&
    shouldPromptAddressDuringScan({
      roteirizacaoHabilitada,
      prepararDuranteBipagem,
      routeContext: ctx,
      needsAddress: deliveryNeedsAddressForRoute(delivery),
    })
  ) {
    navigation.navigate("PrepareDeliveries", {
      addressDeliveryId: idSaida,
      returnToScan: true,
    });
    return;
  }

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
