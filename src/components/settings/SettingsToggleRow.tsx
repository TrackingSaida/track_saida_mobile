import React from "react";
import { View, Switch, StyleSheet } from "react-native";
import { useThemeColors } from "../../theme/colors";
import AppText from "../ui/AppText";
import { textStyle } from "../../theme/typography";

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
        <AppText style={[styles.label, { color: colors.text }]}>{label}</AppText>
        {description ? (
          <AppText style={[styles.description, { color: colors.textSecondary }]}>{description}</AppText>
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
    minHeight: 52,
  },
  textWrap: { flex: 1, minWidth: 0, paddingRight: 8 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  description: { ...textStyle("bodySmall"), marginTop: 4, fontSize: 13 },
});
