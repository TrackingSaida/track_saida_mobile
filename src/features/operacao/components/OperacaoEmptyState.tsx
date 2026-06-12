import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";

type Props = {
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export default function OperacaoEmptyState({ message, icon = "information-circle-outline" }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          paddingVertical: 28,
          paddingHorizontal: 20,
          alignItems: "center",
        },
        icon: { marginBottom: 10 },
        text: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 20,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={32} color={colors.textSecondary} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}
