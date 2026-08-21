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
  rightElement?: ReactNode;
};

export default function CompactStaffHeader({
  gradientColors,
  title,
  titleNode,
  subtitle,
  tertiary,
  rightElement,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <LinearGradient colors={[...gradientColors]} locations={[0, 1]}>
      <View style={[styles.inner, { paddingTop: Math.max(space.sm, insets.top) }]}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            {titleNode ??
              (title ? (
                <AppText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </AppText>
              ) : null)}
            {subtitle ? (
              <AppText style={[styles.subtitle, { color: colors.text }]} numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
            {tertiary ? (
              <AppText style={[styles.tertiary, { color: colors.textSecondary }]} numberOfLines={1}>
                {tertiary}
              </AppText>
            ) : null}
          </View>
          {rightElement ? <View style={styles.rightSlot}>{rightElement}</View> : null}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  titleBlock: { flex: 1, minWidth: 0 },
  rightSlot: { marginLeft: space.sm },
  title: { ...textStyle("screenTitle"), fontWeight: "800", letterSpacing: -0.4, fontSize: 22, lineHeight: 28 },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: "700", marginTop: 2 },
  tertiary: { ...textStyle("bodySmall"), marginTop: 2, fontWeight: "500" },
});
