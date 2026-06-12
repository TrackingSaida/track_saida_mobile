import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import type { GroupedStop } from "../utils/routeUtils";
import {
  getStopAddressLineFromGroup,
  getStopCodigosList,
  getApproximateLocationLabel,
} from "../utils/routeUtils";

interface PendingMapGroupSheetProps {
  visible: boolean;
  group: GroupedStop | null;
  bottomInset: number;
  onClose: () => void;
  onCriarRota: (group: GroupedStop) => void;
  onEditarEndereco: (group: GroupedStop) => void;
  onVerPedido: (idSaida: number) => void;
}

export default function PendingMapGroupSheet({
  visible,
  group,
  bottomInset,
  onClose,
  onCriarRota,
  onEditarEndereco,
  onVerPedido,
}: PendingMapGroupSheetProps) {
  const colors = useThemeColors();
  const [showPedidos, setShowPedidos] = useState(false);

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
          paddingHorizontal: 20,
          paddingTop: 16,
          maxHeight: "80%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
        address: { fontSize: 14, color: colors.text, marginBottom: 12, lineHeight: 20 },
        approxBadge: {
          fontSize: 12,
          fontWeight: "600",
          color: colors.warning,
          marginBottom: 12,
        },
        codigosWrap: { marginBottom: 16 },
        codigosLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
        codigosText: { fontSize: 14, color: colors.text, fontWeight: "600" },
        action: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        actionText: { fontSize: 16, color: colors.text, flex: 1 },
        pedidosList: { maxHeight: 220, marginBottom: 8 },
        pedidoItem: {
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        pedidoCodigo: { fontSize: 15, fontWeight: "600", color: colors.text },
        pedidoCliente: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        cancel: { marginTop: 12, alignItems: "center", paddingVertical: 12, marginBottom: 8 },
        cancelText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  const codigos = group ? getStopCodigosList(group) : [];
  const count = group?.deliveries.length ?? 0;
  const approximateLabel = group
    ? getApproximateLocationLabel(group.representativeDelivery)
    : null;

  const handleClose = () => {
    setShowPedidos(false);
    onClose();
  };

  if (!group) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View
          style={[styles.box, { paddingBottom: Math.max(24, bottomInset) }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title}>
            {count} pedido{count !== 1 ? "s" : ""} neste endereço
          </Text>
          <Text style={styles.subtitle}>Endereço agrupado por localização</Text>
          <Text style={styles.address}>{getStopAddressLineFromGroup(group)}</Text>
          {approximateLabel ? (
            <Text style={styles.approxBadge}>{approximateLabel}</Text>
          ) : null}

          <View style={styles.codigosWrap}>
            <Text style={styles.codigosLabel}>Códigos</Text>
            <Text style={styles.codigosText}>
              {codigos.length > 0 ? codigos.join(" · ") : "—"}
            </Text>
          </View>

          {showPedidos && (
            <FlatList
              data={group.deliveries}
              keyExtractor={(item) => String(item.id_saida)}
              style={styles.pedidosList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pedidoItem}
                  onPress={() => {
                    handleClose();
                    onVerPedido(item.id_saida);
                  }}
                >
                  <Text style={styles.pedidoCodigo}>{item.codigo ?? "—"}</Text>
                  <Text style={styles.pedidoCliente}>{item.cliente ?? "—"}</Text>
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity
            style={styles.action}
            onPress={() => onCriarRota(group)}
          >
            <Ionicons name="navigate-outline" size={22} color={colors.primary} />
            <Text style={styles.actionText}>Criar rota com este endereço</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.action}
            onPress={() => {
              handleClose();
              onEditarEndereco(group);
            }}
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
            <Text style={styles.actionText}>Editar endereço</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.action}
            onPress={() => {
              if (count === 1) {
                handleClose();
                onVerPedido(group.deliveries[0].id_saida);
                return;
              }
              setShowPedidos((v) => !v);
            }}
          >
            <Ionicons name="list-outline" size={22} color={colors.primary} />
            <Text style={styles.actionText}>
              {showPedidos ? "Ocultar pedidos" : "Ver pedidos"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} onPress={handleClose}>
            <Text style={styles.cancelText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

import type { RouteReconcileResult } from "../utils/routeReconcile";

export async function confirmCreateRouteFromGroup(
  onConfirm: () => void,
  options: {
    getActiveRouteId: () => string | null;
    reconcileActiveRoute: () => Promise<RouteReconcileResult>;
    onContinueRoute: () => void;
  }
): Promise<void> {
  if (options.getActiveRouteId() != null) {
    await options.reconcileActiveRoute();
  }
  if (options.getActiveRouteId() != null) {
    Alert.alert("Atenção", "Finalize a rota ativa antes de montar outra.", [
      { text: "Continuar rota", onPress: options.onContinueRoute },
      { text: "Cancelar", style: "cancel" },
    ]);
    return;
  }
  onConfirm();
}
