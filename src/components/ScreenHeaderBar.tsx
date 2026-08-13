import React, { useMemo } from "react";
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";
import AppText from "./ui/AppText";
import { textStyle } from "../theme/typography";
import { useFontScale } from "../hooks/useFontScale";

type HeaderBackButtonProps = {
  onPress: () => void;
  label?: string;
};

export function HeaderBackButton({ onPress, label = "Voltar" }: HeaderBackButtonProps) {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const { ms } = useFontScale();
  const compactHeader = windowWidth < 360;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backButton: {
          minHeight: ms(36),
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          paddingHorizontal: 10,
          paddingVertical: 6,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        },
        backLabel: { ...textStyle("bodySmall"), fontWeight: "600", color: colors.text },
      }),
    [colors, ms]
  );

  return (
    <TouchableOpacity style={styles.backButton} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name="chevron-back" size={18} color={colors.text} />
      {!compactHeader ? <AppText style={styles.backLabel}>{label}</AppText> : null}
    </TouchableOpacity>
  );
}

type Props = {
  title?: string;
  titleNode?: React.ReactNode;
  onBack: () => void;
  rightElement?: React.ReactNode;
  paddingTop?: number;
};

export default function ScreenHeaderBar({ title, titleNode, onBack, rightElement, paddingTop }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { ms } = useFontScale();
  const resolvedPaddingTop = paddingTop ?? Math.max(12, insets.top);

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
          minHeight: ms(44),
        },
        sideSlot: {
          minWidth: ms(72),
          maxWidth: 120,
          flexShrink: 0,
          flexDirection: "row",
          alignItems: "center",
        },
        sideSlotRight: {
          justifyContent: "flex-end",
        },
        title: {
          flex: 1,
          minWidth: 0,
          textAlign: "center",
          ...textStyle("headerTitle"),
          fontWeight: "700",
          color: colors.text,
        },
        titleSlot: {
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, ms]
  );

  return (
    <View style={[styles.wrap, { paddingTop: resolvedPaddingTop }]}>
      <View style={styles.bar}>
        <View style={styles.sideSlot}>
          <HeaderBackButton onPress={onBack} />
        </View>
        {titleNode ? (
          <View style={styles.titleSlot}>{titleNode}</View>
        ) : (
          <AppText style={styles.title} numberOfLines={2}>
            {title}
          </AppText>
        )}
        <View style={[styles.sideSlot, styles.sideSlotRight]}>{rightElement ?? null}</View>
      </View>
    </View>
  );
}
