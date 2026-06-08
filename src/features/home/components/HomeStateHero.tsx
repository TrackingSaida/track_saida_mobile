import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import { HOME_STATE_ASSETS, type HomeHeroState } from "../utils/homeStateAssets";

export type HomeStateHeroCta = {
  label: string;
  onPress: () => void;
  loading?: boolean;
};

export type HomeStateHeroProps = {
  state: HomeHeroState;
  title: string;
  description: string;
  extraLines?: string[];
  primaryCta: HomeStateHeroCta;
  secondaryCtas?: HomeStateHeroCta[];
};

export default function HomeStateHero({
  state,
  title,
  description,
  extraLines = [],
  primaryCta,
  secondaryCtas = [],
}: HomeStateHeroProps) {
  const colors = useThemeColors();
  const { height: windowHeight } = useWindowDimensions();
  const visual = HOME_STATE_ASSETS[state];
  const [imageFailed, setImageFailed] = useState(false);

  const imageHeight = Math.min(140, Math.max(88, windowHeight * 0.14));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flex: 1,
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
          paddingBottom: space.md,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4,
        },
        heroArea: {
          alignItems: "center",
          marginBottom: space.md,
        },
        image: {
          width: "68%",
          height: imageHeight,
        },
        fallbackCircle: {
          width: imageHeight,
          height: imageHeight,
          borderRadius: imageHeight / 2,
          backgroundColor: colors.chipBackground,
          alignItems: "center",
          justifyContent: "center",
        },
        title: {
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
          textAlign: "center",
          letterSpacing: -0.4,
          marginBottom: space.sm,
        },
        description: {
          fontSize: typo.body,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 22,
        },
        extraLine: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: 4,
        },
        content: {
          flex: 1,
          justifyContent: "center",
        },
        actions: {
          gap: space.sm,
          marginTop: space.md,
        },
        btnPrimary: {
          borderRadius: radius.lg,
          overflow: "hidden",
        },
        btnPrimaryInner: {
          paddingVertical: space.lg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: space.sm,
        },
        btnPrimaryText: {
          color: colors.primaryContrast,
          fontSize: 17,
          fontWeight: "800",
        },
        btnSecondary: {
          paddingVertical: space.md,
          alignItems: "center",
          borderRadius: radius.md,
          backgroundColor: colors.chipBackground,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        btnSecondaryText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: "700",
        },
        btnDisabled: { opacity: 0.7 },
      }),
    [colors, imageHeight]
  );

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.heroArea}>
          {!imageFailed ? (
            <Image
              source={visual.image}
              style={styles.image}
              resizeMode="contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.fallbackCircle}>
              <Ionicons name={visual.fallbackIcon} size={Math.round(imageHeight * 0.45)} color={visual.fallbackIconColor} />
            </View>
          )}
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {extraLines.map((line) => (
          <Text key={line} style={styles.extraLine}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={primaryCta.onPress}
          activeOpacity={0.92}
          disabled={primaryCta.loading}
          style={[styles.btnPrimary, primaryCta.loading ? styles.btnDisabled : undefined]}
        >
          <LinearGradient colors={[...visual.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnPrimaryInner}>
            {primaryCta.loading ? (
              <ActivityIndicator color={colors.primaryContrast} />
            ) : (
              <Text style={styles.btnPrimaryText}>{primaryCta.label}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {secondaryCtas.map((cta) => (
          <TouchableOpacity key={cta.label} style={styles.btnSecondary} onPress={cta.onPress} activeOpacity={0.85}>
            <Text style={styles.btnSecondaryText}>{cta.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
