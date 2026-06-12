import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { useThemeStore } from "../../../store/themeStore";
import { space, radius } from "../../../theme/spacing";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  title: string;
  subtitle: string;
  icon: IoniconName;
  onPress: () => void;
  variant?: "primary" | "secondary";
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
        primaryBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.lg,
          paddingHorizontal: space.lg,
          minHeight: 72,
          borderRadius: radius.xl,
          overflow: "hidden",
        },
        secondaryCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.lg,
          paddingHorizontal: space.lg,
          minHeight: 72,
          borderRadius: radius.lg,
          backgroundColor: colors.backgroundCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        iconWrap: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: variant === "primary" ? "rgba(255,255,255,0.2)" : colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        },
        textWrap: { flex: 1 },
        title: {
          fontSize: variant === "primary" ? 18 : 16,
          fontWeight: "800",
          color: variant === "primary" ? colors.primaryContrast : colors.text,
        },
        subtitle: {
          fontSize: 13,
          color: variant === "primary" ? "rgba(255,255,255,0.9)" : colors.textSecondary,
          marginTop: 4,
          lineHeight: 18,
        },
      }),
    [colors, variant]
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
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.primaryContrast} />
          </LinearGradient>
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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
