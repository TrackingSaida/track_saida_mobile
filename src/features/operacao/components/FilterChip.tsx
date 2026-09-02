import React, { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { radius, space } from "../../../theme/spacing";
import AppText from "../../../components/ui/AppText";
import { useFontScale } from "../../../hooks/useFontScale";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IoniconName;
};

export default function FilterChip({ label, selected, onPress, icon }: Props) {
  const colors = useThemeColors();
  const { ms } = useFontScale();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chip: {
          minHeight: ms(44),
          paddingHorizontal: space.sm + 2,
          paddingVertical: 8,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.inputBorder,
          backgroundColor: selected ? colors.primarySoft : colors.inputBackground,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        text: {
          fontSize: 13,
          fontWeight: selected ? "700" : "600",
          color: selected ? colors.primary : colors.textSecondary,
        },
      }),
    [colors, ms, selected]
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.86 }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={selected ? colors.primary : colors.textSecondary} />
      ) : null}
      <AppText style={styles.text}>{label}</AppText>
    </Pressable>
  );
}
