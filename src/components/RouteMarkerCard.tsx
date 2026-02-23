import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeColors } from "../theme/colors";
import type { EntregaListItem } from "../features/entregas/types";

export interface RouteMarkerCardProps {
  delivery: EntregaListItem;
  status: "pendente" | "entregue" | "ausente";
  /** Ordem da parada na rota (1-based). Exibido quando fornecido. */
  orderNumber?: number;
  onClose: () => void;
  onMarcarEntregue: () => void;
  onMarcarAusente: () => void;
  onNavegar: () => void;
}

function enderecoCompleto(d: EntregaListItem): string {
  const parts = [d.endereco, d.bairro, d.endereco_formatado].filter(Boolean);
  if (parts.length === 0) return "—";
  return d.endereco_formatado || [d.endereco, d.bairro].filter(Boolean).join(", ");
}

export default function RouteMarkerCard({
  delivery,
  status,
  orderNumber,
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
          alignItems: "center",
          marginBottom: 12,
        },
        close: { padding: 4 },
        closeText: { fontSize: 18, color: colors.textSecondary, fontWeight: "600" },
        label: { fontSize: 11, color: colors.textSecondary, marginBottom: 2, textTransform: "uppercase" },
        value: { fontSize: 15, color: colors.text, fontWeight: "500" },
        valueBlock: { marginBottom: 10 },
        addressBlock: { marginBottom: 16 },
        addressValue: { fontSize: 14, color: colors.text },
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
        orderLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2, textTransform: "uppercase" },
      }),
    [colors]
  );

  const podeAcoes = status === "pendente";
  const temCoords = delivery.latitude != null && delivery.longitude != null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {orderNumber != null && (
            <Text style={styles.orderLabel}>Parada {orderNumber}</Text>
          )}
          <Text style={styles.value} numberOfLines={1}>
            {delivery.codigo || "—"}
          </Text>
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

      <View style={styles.addressBlock}>
        <Text style={styles.label}>Endereço</Text>
        <Text style={styles.addressValue}>{enderecoCompleto(delivery)}</Text>
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

      {temCoords && (
        <TouchableOpacity
          style={[styles.btn, styles.btnNavegar, { marginTop: podeAcoes ? 10 : 0 }]}
          onPress={onNavegar}
        >
          <Text style={styles.btnText}>Navegar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
