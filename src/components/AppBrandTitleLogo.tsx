import React, { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

type Props = {
  size?: "home" | "header";
  maxWidth?: number;
};

const SIZE_PRESETS = {
  home: { height: 36, maxWidth: 220 },
  header: { height: 28, maxWidth: 170 },
} as const;

export default function AppBrandTitleLogo({ size = "header", maxWidth }: Props) {
  const preset = SIZE_PRESETS[size];
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          alignItems: "center",
          justifyContent: "center",
        },
        image: {
          height: preset.height,
          width: maxWidth ?? preset.maxWidth,
        },
      }),
    [maxWidth, preset.height, preset.maxWidth]
  );

  return (
    <View style={styles.wrap}>
      <Image
        source={require("../../assets/logo-light.png")}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel="ROTEVO"
        accessibilityRole="image"
      />
    </View>
  );
}
