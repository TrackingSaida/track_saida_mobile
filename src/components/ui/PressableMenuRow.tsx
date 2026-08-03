import React from "react";
import { Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { space } from "../../theme/spacing";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  iconColor?: string;
  /** Fundo suave atrás do ícone (identidade por perfil). */
  iconSoftBg?: string;
  showChevron?: boolean;
  danger?: boolean;
  isLast?: boolean;
  /** Contador de badge (ex.: avisos não lidos). */
  badgeCount?: number;
};

export default function PressableMenuRow({
  icon,
  title,
  subtitle,
  onPress,
  iconColor,
  iconSoftBg,
  showChevron = true,
  danger = false,
  isLast = false,
  badgeCount = 0,
}: Props) {
  const colors = useThemeColors();
  const soft = iconSoftBg ?? colors.primarySoft;
  const showBadge = badgeCount > 0;
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
        {showBadge ? (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : String(badgeCount)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: danger ? colors.textSecondary : colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
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
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "600" },
  subtitle: { fontSize: 13, marginTop: 2, fontWeight: "500" },
  chevron: { width: 24 },
});
