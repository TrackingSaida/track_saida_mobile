import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeColors } from "../theme/colors";
import type { EntregaListItem } from "../features/entregas/types";
import { getStopPedidoLabel, getStopAddressLine, servicoTipo } from "../features/entregas/utils/routeUtils";

export interface RouteMarkerCardProps {
  delivery: EntregaListItem;
  status: "pendente" | "entregue" | "ausente";
  /** Ordem da parada na rota (1-based). Exibido quando fornecido. */
  orderNumber?: number;
  /** Se false, oculta ações de marcar entregue/ausente e exibe mensagem para iniciar a rota. Default true. */
  canMarkDelivery?: boolean;
  onClose: () => void;
  onMarcarEntregue: () => void;
  onMarcarAusente: () => void;
  onNavegar: () => void;
}

export default function RouteMarkerCard({
  delivery,
  status,
  orderNumber,
  canMarkDelivery = true,
  onClose,
  onMarcarEntregue,
  onMarcarAusente,
  onNavegar,
}: RouteMarkerCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
          paddingBottom: 24,
          borderWidth: 1,
          borderColor: colors.separator,
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        },
        close: { padding: 4 },
        closeText: { fontSize: 18, color: colors.textSecondary, fontWeight: "600" },
        orderLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2, textTransform: "uppercase" },
        codigo: { fontSize: 20, fontWeight: "800", color: colors.primary },
        pedido: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        label: { fontSize: 11, color: colors.textSecondary, marginBottom: 2, textTransform: "uppercase" },
        value: { fontSize: 15, color: colors.text, fontWeight: "500" },
        valueBlock: { marginBottom: 10 },
        addressBlock: { marginBottom: 16 },
        addressValue: { fontSize: 14, color: colors.text },
        marketplace: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
        row: { flexDirection: "row", gap: 10, marginTop: 4 },
        btn: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
        },
        btnEntregue: { backgroundColor: colors.success },
        btnAusente: { backgroundColor: colors.danger },
        btnNavegar: { backgroundColor: colors.primary },
        btnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
        statusBadge: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          alignSelf: "flex-start",
        },
        statusBadgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },
        hintText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 8, marginBottom: 4 },
      }),
    [colors]
  );

  const podeAcoes = status === "pendente" && canMarkDelivery;
  const temCoords = delivery.latitude != null && delivery.longitude != null;
  const showStartRouteHint = status === "pendente" && !canMarkDelivery;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {orderNumber != null && (
            <Text style={styles.orderLabel}>Parada {orderNumber}</Text>
          )}
          <Text style={styles.codigo} numberOfLines={1}>
            {delivery.codigo || "—"}
          </Text>
          <Text style={styles.pedido}>{getStopPedidoLabel(delivery)}</Text>
        </View>
        {status !== "pendente" && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: status === "entregue" ? colors.success : colors.danger },
            ]}
          >
            <Text style={styles.statusBadgeText}>{status === "entregue" ? "Entregue" : "Ausente"}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.valueBlock}>
        <Text style={styles.label}>Destinatário</Text>
        <Text style={styles.value}>{delivery.cliente || delivery.exibicao || "—"}</Text>
      </View>

      <Text style={styles.marketplace}>{servicoTipo(delivery.servico)}</Text>

      <View style={styles.addressBlock}>
        <Text style={styles.label}>Endereço</Text>
        <Text style={styles.addressValue}>{getStopAddressLine(delivery)}</Text>
      </View>

      {podeAcoes && (
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.btnEntregue]} onPress={onMarcarEntregue}>
            <Text style={styles.btnText}>Marcar como Entregue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnAusente]} onPress={onMarcarAusente}>
            <Text style={styles.btnText}>Marcar como Ausente</Text>
          </TouchableOpacity>
        </View>
      )}

      {showStartRouteHint && (
        <Text style={styles.hintText}>Inicie a rota para marcar entregas.</Text>
      )}

      {temCoords && (
        <TouchableOpacity
          style={[styles.btn, styles.btnNavegar, { marginTop: podeAcoes || showStartRouteHint ? 10 : 0 }]}
          onPress={onNavegar}
        >
          <Text style={styles.btnText}>Navegar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
