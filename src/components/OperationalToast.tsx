import React, { useMemo } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../theme/colors";
import { useToastStore } from "../store/toastStore";
import AppText from "./ui/AppText";
import { textStyle } from "../theme/typography";

export default function OperationalToast() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const visible = useToastStore((s) => s.visible);
  const title = useToastStore((s) => s.title);
  const message = useToastStore((s) => s.message);
  const tone = useToastStore((s) => s.tone);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: "absolute",
          left: 16,
          right: 16,
          top: Math.max(12, insets.top + 8),
          zIndex: 1000,
          elevation: 20,
        },
        card: {
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: StyleSheet.hairlineWidth,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        title: { fontSize: 15, lineHeight: 20, fontWeight: "800", color: colors.text },
        message: { ...textStyle("bodySmall"), fontSize: 13, color: colors.textSecondary, marginTop: 2 },
      }),
    [colors, insets.top]
  );

  if (!visible) return null;

  const bg =
    tone === "warn"
      ? colors.warning + "EE"
      : tone === "info"
        ? colors.backgroundCard
        : colors.success + "EE";
  const border =
    tone === "warn" ? colors.warning : tone === "info" ? colors.border : colors.success;
  const titleColor = tone === "success" || tone === "warn" ? "#fff" : colors.text;
  const messageColor = tone === "success" || tone === "warn" ? "rgba(255,255,255,0.92)" : colors.textSecondary;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
        <AppText style={[styles.title, { color: titleColor }]}>{title}</AppText>
        {message ? <AppText style={[styles.message, { color: messageColor }]}>{message}</AppText> : null}
      </Animated.View>
    </View>
  );
}
