import React, { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/colors";
import { space } from "../../theme/spacing";
import { type as typo } from "../../theme/typography";

type Props = {
  gradientColors: readonly [string, string];
  title: string;
  subtitle?: string;
  tertiary?: string;
  children?: ReactNode;
  paddingBottom?: number;
};

export default function GradientScreenHeader({
  gradientColors,
  title,
  subtitle,
  tertiary,
  children,
  paddingBottom = space.lg,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <LinearGradient colors={[...gradientColors]} locations={[0, 1]} style={{ paddingBottom }}>
      <View style={[styles.inner, { paddingTop: Math.max(space.md, insets.top), paddingHorizontal: space.lg }]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
        {tertiary ? (
          <Text style={[styles.tertiary, { color: colors.textSecondary }]}>{tertiary}</Text>
        ) : null}
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inner: { paddingBottom: space.sm },
  title: { fontSize: typo.screenTitle, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: typo.subtitle, marginTop: space.xs, fontWeight: "500" },
  tertiary: { fontSize: typo.bodySmall, marginTop: space.xs },
});
