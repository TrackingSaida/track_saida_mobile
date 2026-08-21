import React from "react";
import { TouchableOpacity, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { space } from "../../theme/spacing";
import { textStyle } from "../../theme/typography";
import AppText from "./AppText";
import { useFontScale } from "../../hooks/useFontScale";

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
  disabled?: boolean;
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
  disabled = false,
  badgeCount = 0,
}: Props) {
  const colors = useThemeColors();
  const { ms } = useFontScale();
  const soft = iconSoftBg ?? colors.primarySoft;
  const showBadge = badgeCount > 0;
  return (
    <TouchableOpacity
      style={[
        styles.row,
        { minHeight: ms(56), opacity: disabled ? 0.55 : 1 },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <View style={[styles.iconCircle, { backgroundColor: danger ? colors.chipBackground : soft }]}>
        <Ionicons name={icon} size={22} color={danger ? colors.textSecondary : iconColor ?? colors.primary} />
        {showBadge ? (
          <View style={[styles.badge, { backgroundColor: colors.danger, minHeight: ms(18) }]}>
            <AppText style={styles.badgeText}>{badgeCount > 99 ? "99+" : String(badgeCount)}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.textCol}>
        <AppText
          style={[styles.title, { color: danger ? colors.textSecondary : colors.text }]}
          numberOfLines={2}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={3}>
            {subtitle}
          </AppText>
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
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", ...textStyle("badge"), fontWeight: "800" },
  textCol: { flex: 1, minWidth: 0 },
  title: { ...textStyle("body"), fontWeight: "600" },
  subtitle: { ...textStyle("bodySmall"), marginTop: 2, fontWeight: "500", fontSize: 13, lineHeight: 18 },
  chevron: { width: 24 },
});
