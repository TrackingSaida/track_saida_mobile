import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import {
  getStopAddressLine,
  getStopPedidoLabel,
  getStopPrimaryCodigo,
  type GroupedStop,
} from "../utils/routeUtils";

interface RouteChangePositionSheetProps {
  group: GroupedStop;
  stopIndex: number;
  totalStops: number;
  minPosition: number;
  onConfirmRecalculate: (toIndex: number) => void;
  onConfirmSwapOnly: (toIndex: number) => void;
  onBack: () => void;
}

export default function RouteChangePositionSheet({
  group,
  stopIndex,
  totalStops,
  minPosition,
  onConfirmRecalculate,
  onConfirmSwapOnly,
  onBack,
}: RouteChangePositionSheetProps) {
  const colors = useThemeColors();
  const maxListHeight = Dimensions.get("window").height * 0.42;
  const first = group.deliveries[0];
  const positions = Array.from({ length: totalStops }, (_, i) => i + 1).filter(
    (pos) => pos >= minPosition
  );
  const [pendingPosition, setPendingPosition] = useState<number | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
        context: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
        currentPos: {
          fontSize: 14,
          fontWeight: "600",
          color: colors.primary,
          marginBottom: 16,
        },
        list: { maxHeight: maxListHeight, marginBottom: 8 },
        pickerItem: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          marginBottom: 8,
        },
        pickerItemActive: { borderWidth: 2, borderColor: colors.primary },
        pickerItemPending: { borderWidth: 2, borderColor: colors.warning },
        pickerItemText: { fontSize: 15, color: colors.text },
        pickerItemSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        summaryBox: {
          padding: 14,
          borderRadius: 10,
          backgroundColor: colors.inputBackground,
          marginBottom: 12,
        },
        summaryText: { fontSize: 15, color: colors.text, marginBottom: 12 },
        primaryBtn: {
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginBottom: 8,
        },
        primaryBtnText: { fontSize: 16, fontWeight: "700", color: colors.primaryContrast },
        linkBtn: { alignItems: "center", paddingVertical: 10 },
        linkText: { fontSize: 14, color: colors.textSecondary, textDecorationLine: "underline" },
        back: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
        backText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors, maxListHeight]
  );

  const confirmRecalculate = (toIndex: number) => {
    Alert.alert(
      "Recalcular rota?",
      "Esta parada será fixada na nova posição e as próximas serão reorganizadas pela melhor sequência.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Somente trocar posição",
          onPress: () => onConfirmSwapOnly(toIndex),
        },
        {
          text: "Recalcular rota",
          onPress: () => onConfirmRecalculate(toIndex),
        },
      ]
    );
  };

  const handleSelectPosition = (pos: number) => {
    if (pos === stopIndex) return;
    setPendingPosition(pos);
  };

  return (
    <View>
      <Text style={styles.title}>Alterar posição</Text>
      <Text style={styles.context} numberOfLines={1}>
        {getStopPrimaryCodigo(group)} · {first ? getStopPedidoLabel(first) : ""}
      </Text>
      <Text style={styles.context} numberOfLines={2}>
        {first ? getStopAddressLine(first) : "—"}
      </Text>
      <Text style={styles.currentPos}>
        Parada {stopIndex} de {totalStops}
      </Text>

      {pendingPosition != null ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>
            Mover da posição {stopIndex} para posição {pendingPosition}
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => confirmRecalculate(pendingPosition - 1)}
          >
            <Text style={styles.primaryBtnText}>Recalcular rota</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => onConfirmSwapOnly(pendingPosition - 1)}
          >
            <Text style={styles.linkText}>Somente trocar posição</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => setPendingPosition(null)}>
            <Text style={styles.linkText}>Escolher outra posição</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator>
          {positions.map((pos) => {
            const isCurrent = pos === stopIndex;
            return (
              <TouchableOpacity
                key={pos}
                style={[styles.pickerItem, isCurrent && styles.pickerItemActive]}
                onPress={() => handleSelectPosition(pos)}
                disabled={isCurrent}
              >
                <Text style={styles.pickerItemText}>
                  Posição {pos}
                  {isCurrent ? " (atual)" : ""}
                </Text>
                {isCurrent ? (
                  <Text style={styles.pickerItemSub}>Esta é a posição atual da parada</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}
