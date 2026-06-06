import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { useThemeColors } from "../../theme/colors";

type Props = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
};

export default function SettingsToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  isLast = false,
}: Props) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
      ]}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.separator, true: colors.primary }}
        thumbColor={colors.backgroundCard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  textWrap: { flex: 1, paddingRight: 8 },
  label: { fontSize: 15, fontWeight: "600" },
  description: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
