import React, { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "../../theme/colors";
import { space } from "../../theme/spacing";
import { type as typo } from "../../theme/typography";

type Props = {
  title: string;
  children: ReactNode;
};

export default function SettingsSection({ title, children }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
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
  wrap: { marginBottom: space.lg },
  title: {
    fontSize: typo.sectionLabel,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: space.sm,
    marginLeft: space.xs,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
});
