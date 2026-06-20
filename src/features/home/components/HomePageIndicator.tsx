import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import { HOME_PAGE_LABELS } from "../utils/homeStateAssets";

type Props = {
  pageIndex: number;
  onSelectPage: (index: number) => void;
};

export default function HomePageIndicator({ pageIndex, onSelectPage }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: space.md,
          gap: space.lg,
        },
        item: {
          alignItems: "center",
          minWidth: 72,
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.border,
          marginBottom: 6,
        },
        dotActive: {
          backgroundColor: colors.deliveryAccent,
          width: 10,
          height: 10,
          borderRadius: 5,
        },
        label: {
          fontSize: typo.label,
          color: colors.textSecondary,
          fontWeight: "600",
        },
        labelActive: {
          color: colors.deliveryAccent,
          fontWeight: "800",
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      {HOME_PAGE_LABELS.map((label, index) => {
        const active = index === pageIndex;
        return (
          <TouchableOpacity
            key={label}
            style={styles.item}
            onPress={() => onSelectPage(index)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.dot, active ? styles.dotActive : undefined]} />
            <Text style={[styles.label, active ? styles.labelActive : undefined]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
