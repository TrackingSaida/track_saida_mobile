import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import type { HomeCta } from "../utils/homeOperationalState";

type Props = {
  title: string;
  description: string;
  action?: HomeCta;
  onPress?: () => void;
};

export default function HomeCompletedState({ title, description, action, onPress }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: radius.lg,
          overflow: "hidden",
        },
        inner: {
          padding: space.lg,
        },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.primaryContrast,
          marginBottom: 4,
        },
        description: {
          fontSize: typo.body,
          color: "rgba(255,255,255,0.9)",
        },
        btn: {
          alignSelf: "flex-start",
          marginTop: space.md,
          paddingVertical: space.sm,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          backgroundColor: "rgba(255,255,255,0.2)",
        },
        btnText: {
          color: colors.primaryContrast,
          fontWeight: "700",
          fontSize: typo.bodySmall,
        },
      }),
    [colors]
  );

  return (
    <LinearGradient colors={[colors.deliveryAccent, "#0a6e42"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.inner}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {action && onPress ? (
          <TouchableOpacity style={styles.btn} onPress={onPress} accessibilityRole="button">
            <Text style={styles.btnText}>{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </LinearGradient>
  );
}
