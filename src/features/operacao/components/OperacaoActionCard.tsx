import React, { useMemo } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { useThemeStore } from "../../../store/themeStore";
import { space, radius } from "../../../theme/spacing";
import AppText from "../../../components/ui/AppText";
import { useFontScale } from "../../../hooks/useFontScale";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  title: string;
  subtitle: string;
  icon: IoniconName;
  onPress: () => void;
  variant?: "primary" | "secondary" | "compact";
};

export default function OperacaoActionCard({
  title,
  subtitle,
  icon,
  onPress,
  variant = "secondary",
}: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.theme);
  const { ms } = useFontScale();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shadow: {
          borderRadius: radius.xl,
          marginBottom: space.sm,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: variant === "primary" ? 6 : 2 },
          shadowOpacity: variant === "primary" ? 0.15 : 0.06,
          shadowRadius: variant === "primary" ? 14 : 8,
          elevation: variant === "primary" ? 6 : 2,
        },
        gridShadow: {
          flex: 1,
          minWidth: "47%",
          maxWidth: "48.5%",
          borderRadius: radius.lg,
          marginBottom: space.sm,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        },
        primaryBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.lg,
          paddingHorizontal: space.lg,
          minHeight: ms(72),
          borderRadius: radius.xl,
        },
        secondaryCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.lg,
          paddingHorizontal: space.lg,
          minHeight: ms(72),
          borderRadius: radius.lg,
          backgroundColor: colors.backgroundCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        compactCard: {
          paddingVertical: space.md,
          paddingHorizontal: space.sm,
          minHeight: ms(108),
          borderRadius: radius.lg,
          backgroundColor: colors.backgroundCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: "flex-start",
        },
        iconWrap: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: variant === "primary" ? "rgba(255,255,255,0.2)" : colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        },
        compactIconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        },
        textWrap: { flex: 1, minWidth: 0 },
        title: {
          fontSize: variant === "primary" ? 18 : variant === "compact" ? 14 : 16,
          lineHeight: variant === "primary" ? 24 : variant === "compact" ? 19 : 22,
          fontWeight: "800",
          color: variant === "primary" ? colors.primaryContrast : colors.text,
        },
        subtitle: {
          fontSize: variant === "compact" ? 11 : 13,
          color: variant === "primary" ? "rgba(255,255,255,0.9)" : colors.textSecondary,
          marginTop: 4,
          lineHeight: variant === "compact" ? 16 : 18,
        },
      }),
    [colors, variant, ms]
  );

  if (variant === "primary") {
    return (
      <View style={styles.shadow}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.92} accessibilityRole="button">
          <LinearGradient
            colors={themeMode === "dark" ? [colors.primary, "#2563ab"] : [colors.primary, "#0a58ca"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryBtn}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={icon} size={26} color={colors.primaryContrast} />
            </View>
            <View style={styles.textWrap}>
              <AppText style={styles.title}>{title}</AppText>
              <AppText style={styles.subtitle}>{subtitle}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.primaryContrast} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  if (variant === "compact") {
    return (
      <View style={styles.gridShadow}>
        <TouchableOpacity style={styles.compactCard} onPress={onPress} activeOpacity={0.88}>
          <View style={styles.compactIconWrap}>
            <Ionicons name={icon} size={20} color={colors.primary} />
          </View>
          <AppText style={styles.title} numberOfLines={3}>
            {title}
          </AppText>
          <AppText style={styles.subtitle} numberOfLines={3}>
            {subtitle}
          </AppText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.shadow}>
      <TouchableOpacity style={styles.secondaryCard} onPress={onPress} activeOpacity={0.88}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <AppText style={styles.title}>{title}</AppText>
          <AppText style={styles.subtitle}>{subtitle}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
