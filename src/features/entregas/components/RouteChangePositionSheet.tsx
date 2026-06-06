import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  onSelectPosition: (toIndex: number) => void;
  onBack: () => void;
}

export default function RouteChangePositionSheet({
  group,
  stopIndex,
  totalStops,
  minPosition,
  onSelectPosition,
  onBack,
}: RouteChangePositionSheetProps) {
  const colors = useThemeColors();
  const maxListHeight = Dimensions.get("window").height * 0.42;
  const first = group.deliveries[0];
  const positions = Array.from({ length: totalStops }, (_, i) => i + 1).filter(
    (pos) => pos >= minPosition
  );
  const canMoveUp = stopIndex > minPosition;
  const canMoveDown = stopIndex < totalStops;

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
        quickRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
        quickBtn: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
        },
        quickBtnDisabled: { opacity: 0.4 },
        quickBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
        list: { maxHeight: maxListHeight, marginBottom: 8 },
        pickerItem: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          marginBottom: 8,
        },
        pickerItemActive: { borderWidth: 2, borderColor: colors.primary },
        pickerItemText: { fontSize: 15, color: colors.text },
        pickerItemSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        back: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
        backText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors, maxListHeight]
  );

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
        Posição atual: {stopIndex} de {totalStops}
      </Text>

      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickBtn, !canMoveUp && styles.quickBtnDisabled]}
          onPress={() => canMoveUp && onSelectPosition(stopIndex - 2)}
          disabled={!canMoveUp}
        >
          <Ionicons name="arrow-up-outline" size={18} color={colors.text} />
          <Text style={styles.quickBtnText}>Subir 1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, !canMoveDown && styles.quickBtnDisabled]}
          onPress={() => canMoveDown && onSelectPosition(stopIndex)}
          disabled={!canMoveDown}
        >
          <Ionicons name="arrow-down-outline" size={18} color={colors.text} />
          <Text style={styles.quickBtnText}>Descer 1</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator>
        {positions.map((pos) => {
          const isCurrent = pos === stopIndex;
          return (
            <TouchableOpacity
              key={pos}
              style={[styles.pickerItem, isCurrent && styles.pickerItemActive]}
              onPress={() => !isCurrent && onSelectPosition(pos - 1)}
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

      <TouchableOpacity style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}
