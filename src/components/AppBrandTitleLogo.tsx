import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../theme/colors";

type Props = {
  size?: "home" | "header";
  maxWidth?: number;
};

const SIZE_PRESETS = {
  home: { icon: 42, fontSize: 24, gap: 10 },
  header: { icon: 34, fontSize: 20, gap: 8 },
} as const;

const LIME = "#C6F531";

export default function AppBrandTitleLogo({ size = "header" }: Props) {
  const colors = useThemeColors();
  const preset = SIZE_PRESETS[size];
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: "row",
          alignItems: "center",
          gap: preset.gap,
        },
        image: {
          height: preset.icon,
          width: preset.icon,
        },
        wordmark: {
          fontWeight: "800",
          fontSize: preset.fontSize,
          letterSpacing: 1.2,
          color: colors.text,
          lineHeight: preset.fontSize + 4,
        },
        accent: {
          color: LIME,
        },
      }),
    [colors.text, preset.fontSize, preset.gap, preset.icon]
  );

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="ROTEVO">
      <Image
        source={require("../../assets/logo-pin.png")}
        style={styles.image}
        resizeMode="contain"
      />
      <Text style={styles.wordmark}>
        ROT<Text style={styles.accent}>E</Text>VO
      </Text>
    </View>
  );
}
