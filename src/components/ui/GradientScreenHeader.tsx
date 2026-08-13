import React, { type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/colors";
import { space } from "../../theme/spacing";
import { textStyle } from "../../theme/typography";
import AppText from "./AppText";

type Props = {
  gradientColors: readonly [string, string];
  title?: string;
  titleNode?: ReactNode;
  subtitle?: string;
  tertiary?: string;
  children?: ReactNode;
  rightElement?: ReactNode;
  paddingBottom?: number;
};

export default function GradientScreenHeader({
  gradientColors,
  title,
  titleNode,
  subtitle,
  tertiary,
  children,
  rightElement,
  paddingBottom = space.lg,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <LinearGradient colors={[...gradientColors]} locations={[0, 1]} style={{ paddingBottom }}>
      <View style={[styles.inner, { paddingTop: Math.max(space.md, insets.top), paddingHorizontal: space.lg }]}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            {titleNode ??
              (title ? (
                <AppText style={[styles.title, { color: colors.text }]}>{title}</AppText>
              ) : null)}
            {subtitle ? (
              <AppText style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</AppText>
            ) : null}
            {tertiary ? (
              <AppText style={[styles.tertiary, { color: colors.textSecondary }]}>{tertiary}</AppText>
            ) : null}
          </View>
          {rightElement ? <View style={styles.rightSlot}>{rightElement}</View> : null}
        </View>
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inner: { paddingBottom: space.sm },
  topRow: { flexDirection: "row", alignItems: "flex-start" },
  titleBlock: { flex: 1, minWidth: 0 },
  rightSlot: { marginLeft: space.sm, paddingTop: 2 },
  title: { ...textStyle("screenTitle"), fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { ...textStyle("subtitle"), marginTop: space.xs, fontWeight: "500" },
  tertiary: { ...textStyle("bodySmall"), marginTop: space.xs },
});
