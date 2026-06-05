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
import type { EntregaListItem } from "../types";
import {
  ADDRESS_REVIEW_LABELS,
  getAddressReviewIssue,
  getStopPedidoLabel,
} from "../utils/routeUtils";

interface RoutePartialReviewModalProps {
  visible: boolean;
  deliveries: EntregaListItem[];
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>;
  onClose: () => void;
  onCorrigir: (delivery: EntregaListItem) => void;
}

export default function RoutePartialReviewModal({
  visible,
  deliveries,
  geocodedCoords,
  onClose,
  onCorrigir,
}: RoutePartialReviewModalProps) {
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
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
        subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
        row: {
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        pedido: { fontSize: 14, fontWeight: "600", color: colors.text },
        motivo: { fontSize: 13, color: colors.warning, marginTop: 2 },
        codigo: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        corrigirBtn: {
          marginTop: 8,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 6,
          backgroundColor: colors.primary,
        },
        corrigirText: { fontSize: 13, fontWeight: "600", color: colors.primaryContrast },
        closeBtn: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
        closeText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Endereços para revisão</Text>
          <Text style={styles.subtitle}>
            {deliveries.length} endereço{deliveries.length !== 1 ? "s" : ""} precisam de atenção
          </Text>
          <FlatList
            data={deliveries}
            keyExtractor={(item) => String(item.id_saida)}
            renderItem={({ item }) => {
              const issue = getAddressReviewIssue(item, geocodedCoords);
              return (
                <View style={styles.row}>
                  <Text style={styles.pedido}>{getStopPedidoLabel(item)}</Text>
                  {issue && (
                    <Text style={styles.motivo}>{ADDRESS_REVIEW_LABELS[issue]}</Text>
                  )}
                  <Text style={styles.codigo}>{item.codigo || "—"}</Text>
                  <TouchableOpacity style={styles.corrigirBtn} onPress={() => onCorrigir(item)}>
                    <Text style={styles.corrigirText}>Corrigir agora</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
