import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import AppText from "../ui/AppText";
import { textStyle } from "../../theme/typography";

type Props = {
  label: string;
  description?: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
  isLast?: boolean;
};

export default function SettingsValueRow({
  label,
  description,
  value,
  onPress,
  disabled = false,
  isLast = false,
}: Props) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.textWrap}>
        <AppText style={[styles.label, { color: colors.text }]}>{label}</AppText>
        {description ? (
          <AppText style={[styles.description, { color: colors.textSecondary }]}>{description}</AppText>
        ) : null}
      </View>
      <AppText style={[styles.value, { color: colors.textSecondary }]} numberOfLines={1}>
        {value}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    minHeight: 52,
  },
  textWrap: { flex: 1, minWidth: 0, paddingRight: 4 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  description: { ...textStyle("bodySmall"), marginTop: 4, fontSize: 13 },
  value: { fontSize: 14, fontWeight: "600", maxWidth: "42%", textAlign: "right" },
});
