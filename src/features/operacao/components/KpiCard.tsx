import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeColors } from "../../../theme/colors";
import { useThemeStore } from "../../../store/themeStore";
import { radius, space } from "../../../theme/spacing";
import { textStyle } from "../../../theme/typography";
import { useSemanticTones, type SemanticKey } from "../../../theme/semantic";
import AppText from "../../../components/ui/AppText";
import { useFontScale } from "../../../hooks/useFontScale";
import { formatInteger } from "../utils/dashboardFormat";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type KpiCardVariant = "filledSoft" | "tonal";

type Props = {
  title: string;
  value: number;
  subtitle?: string;
  icon: IoniconName;
  semantic: SemanticKey;
  variant?: KpiCardVariant;
  microLabel?: string;
  progress?: number | null;
};

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  semantic,
  variant = "filledSoft",
  microLabel,
  progress,
}: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.theme);
  const tones = useSemanticTones();
  const tone = tones[semantic];
  const { ms } = useFontScale();
  const filled = variant === "filledSoft";
  const displayValue = formatInteger(value);
  const accessibilityBits = [title, displayValue, subtitle, microLabel].filter(Boolean).join(", ");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: "48%",
          borderRadius: radius.lg,
          padding: space.md,
          minHeight: ms(118),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: filled ? tone.border : colors.border,
          overflow: "hidden",
          backgroundColor: filled ? tone.bgFilled : colors.backgroundCard,
        },
        iconWrap: {
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: tone.iconBg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        },
        title: {
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "600",
          color: filled ? tone.fg : colors.textSecondary,
          marginBottom: 4,
        },
        value: {
          ...textStyle("metricKpi"),
          fontWeight: "800",
          color: tone.fg,
        },
        subtitle: {
          fontSize: 12,
          lineHeight: 16,
          color: filled ? tone.fgMuted : colors.textSecondary,
          marginTop: 4,
        },
        micro: {
          fontSize: 12,
          lineHeight: 16,
          fontWeight: "700",
          color: tone.fg,
          marginTop: 4,
        },
        progressTrack: {
          height: 4,
          borderRadius: radius.full,
          backgroundColor: themeMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          overflow: "hidden",
          marginTop: 8,
        },
        progressFill: {
          height: "100%",
          borderRadius: radius.full,
          backgroundColor: tone.bar,
        },
      }),
    [colors, filled, ms, themeMode, tone]
  );

  const body = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={tone.fg} />
      </View>
      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      <AppText style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {displayValue}
      </AppText>
      {subtitle ? (
        <AppText style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </AppText>
      ) : null}
      {microLabel ? (
        <AppText style={styles.micro} numberOfLines={1}>
          {microLabel}
        </AppText>
      ) : null}
      {progress != null ? (
        <View style={styles.progressTrack} accessibilityElementsHidden>
          <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress))}%` }]} />
        </View>
      ) : null}
    </>
  );

  if (filled) {
    return (
      <LinearGradient
        colors={[tone.bgFilled, tone.bgFilledEnd] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
        accessibilityLabel={accessibilityBits}
        accessible
      >
        {body}
      </LinearGradient>
    );
  }

  return (
    <View style={styles.card} accessibilityLabel={accessibilityBits} accessible>
      {body}
    </View>
  );
}
