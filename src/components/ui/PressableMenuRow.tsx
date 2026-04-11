import React from "react";
import { Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { space } from "../../theme/spacing";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  iconColor?: string;
  /** Fundo suave atrás do ícone (identidade por perfil). */
  iconSoftBg?: string;
  showChevron?: boolean;
  danger?: boolean;
  isLast?: boolean;
};

export default function PressableMenuRow({
  icon,
  title,
  onPress,
  iconColor,
  iconSoftBg,
  showChevron = true,
  danger = false,
  isLast = false,
}: Props) {
  const colors = useThemeColors();
  const soft = iconSoftBg ?? colors.primarySoft;
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
    >
      <View style={[styles.iconCircle, { backgroundColor: danger ? colors.chipBackground : soft }]}>
        <Ionicons name={icon} size={22} color={danger ? colors.textSecondary : iconColor ?? colors.primary} />
      </View>
      <Text style={[styles.title, { color: danger ? colors.textSecondary : colors.text }]} numberOfLines={2}>
        {title}
      </Text>
      {showChevron ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.chevron} />
      ) : (
        <View style={styles.chevron} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    minHeight: 56,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  title: { flex: 1, fontSize: 16, fontWeight: "600" },
  chevron: { width: 24 },
});
