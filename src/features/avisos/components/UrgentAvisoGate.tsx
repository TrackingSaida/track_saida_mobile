import React, { useCallback, useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, AppState } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { useAuthStore } from "../../../store/authStore";
import { isMotoboyRole } from "../../../utils/role";
import { listUrgentesPendentes, type AvisoItem } from "../api";
import { playSound } from "../../../utils/sound";

/** Rotas onde não devemos interromper o scanner. */
const SCAN_ROUTE_NAMES = new Set(["Scan", "DeliverScan", "LeituraSaidas", "LeituraColetas", "LeituraEntradas"]);

export default function UrgentAvisoGate() {
  const role = useAuthStore((s) => s.currentUser?.role);
  const token = useAuthStore((s) => s.token);
  const navigation = useNavigation<any>();
  const [queue, setQueue] = useState<AvisoItem[]>([]);
  const [visible, setVisible] = useState(false);

  const routeName = useNavigationState((state) => {
    if (!state) return "";
    let route: any = state.routes[state.index];
    while (route?.state) {
      const nested = route.state;
      route = nested.routes[nested.index];
    }
    return String(route?.name || "");
  });

  const refresh = useCallback(async () => {
    if (!token || !isMotoboyRole(role)) {
      setQueue([]);
      setVisible(false);
      return;
    }
    try {
      const items = await listUrgentesPendentes();
      setQueue(items);
    } catch {
      // ignore
    }
  }, [token, role]);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    const t = setInterval(() => void refresh(), 45_000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, [refresh]);

  useEffect(() => {
    if (!queue.length) {
      setVisible(false);
      return;
    }
    if (SCAN_ROUTE_NAMES.has(routeName)) {
      setVisible(false);
      return;
    }
    setVisible(true);
    void playSound("warn");
  }, [queue, routeName]);

  const current = queue[0];

  const onVerAgora = () => {
    if (!current) return;
    setVisible(false);
    navigation.navigate("Mais", {
      screen: "AvisoDetail",
      params: { avisoId: current.id },
    });
    // remove da fila local; ao voltar o refresh confirma lido
    setQueue((q) => q.slice(1));
  };

  if (!isMotoboyRole(role) || !current) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Você tem um aviso urgente</Text>
          <Text style={styles.body}>{current.titulo}</Text>
          <TouchableOpacity style={styles.btn} onPress={onVerAgora}>
            <Text style={styles.btnText}>Ver agora</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    color: "#444",
    textAlign: "center",
  },
  btn: {
    marginTop: 22,
    backgroundColor: "#B91C1C",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
