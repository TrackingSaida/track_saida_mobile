import React, { type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColors } from "../../theme/colors";
import { space } from "../../theme/spacing";
import { textStyle } from "../../theme/typography";
import AppText from "./AppText";

type Props = {
  label: string;
  children: ReactNode;
};

export default function MenuSection({ label, children }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.wrap}>
      <AppText style={[styles.label, { color: colors.textSecondary }]}>{label}</AppText>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.backgroundCard,
            borderColor: colors.border,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.xl },
  label: {
    ...textStyle("sectionLabel"),
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: space.sm,
    marginLeft: space.xs,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
