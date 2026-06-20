import React, { useMemo } from "react";
import { TouchableOpacity, Text, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";

type Props = {
  onPress: () => void;
  activeCount?: number;
  label?: string;
};

export default function OperacaoFilterButton({ onPress, activeCount = 0, label = "Filtro" }: Props) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const compact = width < 360;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        btn: {
          minHeight: 36,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          position: "relative",
        },
        text: { fontSize: 13, fontWeight: "700", color: colors.text },
        dot: {
          position: "absolute",
          top: 6,
          right: 6,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        },
      }),
    [colors]
  );

  const badgeLabel = activeCount > 0 ? `${label} · ${activeCount}` : label;

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} accessibilityLabel="Filtros">
      <Ionicons name="filter-outline" size={16} color={colors.text} />
      {!compact ? <Text style={styles.text}>{badgeLabel}</Text> : null}
      {compact && activeCount > 0 ? <View style={styles.dot} /> : null}
    </TouchableOpacity>
  );
}
