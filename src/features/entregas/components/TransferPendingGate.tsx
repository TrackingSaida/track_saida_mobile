import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuthStore } from "../../../store/authStore";
import { useTransferPendingStore } from "../../../store/transferPendingStore";
import { isMotoboyRole } from "../../../utils/role";
import { useThemeColors } from "../../../theme/colors";
import {
  getCurrentRouteName,
  rootNavigationRef,
} from "../../../navigation/rootNavigation";
import {
  aceitarTransferencia,
  recusarTransferencia,
} from "../api";
import {
  promptRemovedFromRoute,
  syncRouteOrderFromServer,
} from "../utils/transferPendingFlow";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { playSound } from "../../../utils/sound";

/** Não interromper bipagem ativa. */
const SCAN_ROUTE_NAMES = new Set([
  "Scan",
  "DeliverScan",
  "LeituraSaidas",
  "LeituraColetas",
  "LeituraEntradas",
]);

const SAFETY_TIMEOUT_MS = 60_000;

export default function TransferPendingGate() {
  const colors = useThemeColors();
  const role = useAuthStore((s) => s.currentUser?.role);
  const token = useAuthStore((s) => s.token);
  const queue = useTransferPendingStore((s) => s.queue);
  const resolving = useTransferPendingStore((s) => s.resolving);
  const [routeName, setRouteName] = useState("");
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    const syncRoute = () => setRouteName(getCurrentRouteName());
    syncRoute();
    const unsub = rootNavigationRef.addListener("state", syncRoute);
    return unsub;
  }, []);

  useEffect(() => {
    if (!token || !isMotoboyRole(role)) {
      useTransferPendingStore.getState().clear();
      setVisible(false);
      shownAtRef.current = null;
      return;
    }
    if (!queue.length) {
      setVisible(false);
      shownAtRef.current = null;
      return;
    }
    if (SCAN_ROUTE_NAMES.has(routeName)) {
      setVisible(false);
      return;
    }
    const wasHidden = !visible;
    setVisible(true);
    if (wasHidden) {
      shownAtRef.current = Date.now();
      void playSound("warn");
    }
  }, [queue, routeName, token, role, visible]);

  // Failsafe: se o modal ficar preso sem resposta, libera o item atual.
  useEffect(() => {
    if (!visible || !queue.length) return;
    const t = setInterval(() => {
      const started = shownAtRef.current;
      if (started == null) return;
      if (Date.now() - started < SAFETY_TIMEOUT_MS) return;
      useTransferPendingStore.getState().dequeueCurrent();
      shownAtRef.current = null;
    }, 5_000);
    return () => clearInterval(t);
  }, [visible, queue.length]);

  const current = queue[0];

  const onRecusar = useCallback(async () => {
    if (!current || resolving) return;
    useTransferPendingStore.getState().setResolving(true);
    try {
      await recusarTransferencia(current.transferencia_id);
      useTransferPendingStore.getState().dequeueCurrent();
    } catch {
      useTransferPendingStore.getState().setResolving(false);
      Alert.alert("Erro", "Não foi possível recusar a transferência.");
    }
  }, [current, resolving]);

  const onAceitar = useCallback(async () => {
    if (!current || resolving) return;
    useTransferPendingStore.getState().setResolving(true);
    try {
      await aceitarTransferencia(current.transferencia_id);
      const sync = await syncRouteOrderFromServer();
      useTransferPendingStore.getState().dequeueCurrent();
      promptRemovedFromRoute({
        removedCount: Math.max(sync.removedIds.length, 1),
        geometryStale: sync.geometryStale,
        isActive: sync.status === "em_entrega",
        onReoptimize: () => {
          void useDeliveryStore.getState().reoptimizeFullRoute();
        },
        onRefreshGeometry: () => {
          const routeId =
            useDeliveryStore.getState().activeRouteId ??
            useDeliveryStore.getState().persistedRouteId;
          if (!routeId) return;
          void import("../api").then(({ postRotasGeometryRefresh }) =>
            postRotasGeometryRefresh(routeId)
          );
        },
      });
    } catch {
      useTransferPendingStore.getState().setResolving(false);
      Alert.alert("Erro", "Não foi possível aceitar a transferência.");
    }
  }, [current, resolving]);

  if (!isMotoboyRole(role) || !current) return null;

  const codigo = current.codigo || String(current.id_saida || current.transferencia_id);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.title, { color: colors.text }]}>Transferência de pedido</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {`O pedido ${codigo} pode sair da sua rota. Se você aceitar, as paradas restantes podem mudar. Aceitar transferência?`}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger, { borderColor: colors.danger }]}
              disabled={resolving}
              onPress={() => void onRecusar()}
            >
              {resolving ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={[styles.btnText, { color: colors.danger }]}>Recusar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
              disabled={resolving}
              onPress={() => void onAceitar()}
            >
              {resolving ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={[styles.btnText, { color: colors.primaryContrast }]}>Aceitar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  actions: {
    marginTop: 22,
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnDanger: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  btnPrimary: {},
  btnText: {
    fontWeight: "800",
    fontSize: 16,
  },
});
