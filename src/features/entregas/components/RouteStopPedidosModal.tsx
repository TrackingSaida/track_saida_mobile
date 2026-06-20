import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import EntregaCodigoHeader from "./EntregaCodigoHeader";
import type { EntregaListItem } from "../types";
import { getStopPedidoLabel, type GroupedStop } from "../utils/routeUtils";

interface RouteStopPedidosModalProps {
  visible: boolean;
  group: GroupedStop | null;
  routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente">;
  onClose: () => void;
  onSelectPedido?: (delivery: EntregaListItem) => void;
}

function statusLabel(status: "pendente" | "entregue" | "ausente"): string {
  if (status === "entregue") return "Entregue";
  if (status === "ausente") return "Ausente";
  return "Pendente";
}

export default function RouteStopPedidosModal({
  visible,
  group,
  routeDeliveryStatus,
  onClose,
  onSelectPedido,
}: RouteStopPedidosModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          maxHeight: "75%",
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text },
        closeText: { fontSize: 16, color: colors.textSecondary },
        item: {
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: colors.inputBackground,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        pedido: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
        destinatario: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>Pedidos nesta parada</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
          {group && (
            <FlatList
              data={group.deliveries}
              keyExtractor={(item) => String(item.id_saida)}
              renderItem={({ item }) => {
                const status = routeDeliveryStatus[item.id_saida] ?? "pendente";
                const podeSelecionar = status === "pendente" && onSelectPedido;
                return (
                  <TouchableOpacity
                    style={styles.item}
                    onPress={podeSelecionar ? () => onSelectPedido(item) : undefined}
                    disabled={!podeSelecionar}
                    activeOpacity={podeSelecionar ? 0.7 : 1}
                  >
                    <Text style={styles.pedido}>{getStopPedidoLabel(item)}</Text>
                    <EntregaCodigoHeader
                      codigo={item.codigo}
                      servico={item.servico}
                      exibicao={item.exibicao || statusLabel(status)}
                      data={item.data}
                      compact
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={styles.destinatario}>
                      {item.cliente || item.exibicao || "—"}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
