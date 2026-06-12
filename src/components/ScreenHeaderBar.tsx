import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";

type HeaderBackButtonProps = {
  onPress: () => void;
  label?: string;
};

export function HeaderBackButton({ onPress, label = "Voltar" }: HeaderBackButtonProps) {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const compactHeader = windowWidth < 360;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backButton: {
          minHeight: 36,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        },
        backLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
      }),
    [colors]
  );

  return (
    <TouchableOpacity style={styles.backButton} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name="chevron-back" size={18} color={colors.text} />
      {!compactHeader ? <Text style={styles.backLabel}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

type Props = {
  title: string;
  onBack: () => void;
  rightElement?: React.ReactNode;
  paddingTop?: number;
};

export default function ScreenHeaderBar({ title, onBack, rightElement, paddingTop = 12 }: Props) {
  const colors = useThemeColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          paddingHorizontal: 12,
          paddingBottom: 10,
          backgroundColor: colors.backgroundCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        bar: {
          flexDirection: "row",
          alignItems: "center",
          minHeight: 44,
        },
        sideSlot: {
          width: 100,
          flexDirection: "row",
          alignItems: "center",
        },
        sideSlotRight: {
          justifyContent: "flex-end",
        },
        title: {
          flex: 1,
          textAlign: "center",
          fontSize: 17,
          fontWeight: "700",
          color: colors.text,
        },
      }),
    [colors]
  );

  return (
    <View style={[styles.wrap, { paddingTop }]}>
      <View style={styles.bar}>
        <View style={styles.sideSlot}>
          <HeaderBackButton onPress={onBack} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.sideSlot, styles.sideSlotRight]}>{rightElement ?? null}</View>
      </View>
    </View>
  );
}
