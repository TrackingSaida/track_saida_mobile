import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../../theme/colors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  title: string;
  icon: IoniconName;
  children: React.ReactNode;
};

export default function DetailInfoBlock({ title, icon, children }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 16,
          marginBottom: 12,
        },
        header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
        title: { fontSize: 15, fontWeight: "700", color: colors.text },
        body: { gap: 8 },
      }),
    [colors]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

export function DetailFieldRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { gap: 2 },
        label: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
        value: { fontSize: 15, color: colors.text, fontWeight: "500" },
        valueMuted: { fontSize: 15, color: colors.textSecondary, fontStyle: "italic" },
      }),
    [colors]
  );

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={muted ? styles.valueMuted : styles.value}>{value}</Text>
    </View>
  );
}
