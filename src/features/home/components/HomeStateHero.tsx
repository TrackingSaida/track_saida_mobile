import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import { OperationalStatusIcon } from "../../../components/OperationalStatusIcon";
import {
  operationalIcons,
  type OperationalIconKey,
} from "../../../theme/operationalIcons";
import {
  HOME_STATE_ASSETS,
  resolveHomeStateIconColor,
  type HomeHeroState,
} from "../utils/homeStateAssets";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type HomeStateHeroCta = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  iconKey?: OperationalIconKey;
};

export type HomeStateHeroProps = {
  state: HomeHeroState;
  title: string;
  description: string;
  extraLines?: string[];
  primaryCta?: HomeStateHeroCta;
  secondaryCtas?: HomeStateHeroCta[];
  footer?: React.ReactNode;
};

function CtaIcon({
  iconKey,
  color,
  size = 20,
}: {
  iconKey: OperationalIconKey;
  color: string;
  size?: number;
}) {
  return (
    <Ionicons
      name={operationalIcons[iconKey] as IoniconName}
      size={size}
      color={color}
    />
  );
}

export default function HomeStateHero({
  state,
  title,
  description,
  extraLines = [],
  primaryCta,
  secondaryCtas = [],
  footer,
}: HomeStateHeroProps) {
  const colors = useThemeColors();
  const visual = HOME_STATE_ASSETS[state];
  const iconColor = resolveHomeStateIconColor(visual, colors);

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
          justifyContent: "center",
          flexDirection: "row",
          gap: space.sm,
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
    [colors]
  );

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.heroArea}>
          <OperationalStatusIcon
            name={visual.operationalIcon}
            color={iconColor}
          />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {extraLines.map((line) => (
          <Text key={line} style={styles.extraLine}>
            {line}
          </Text>
        ))}
      </View>

      {footer ?? (primaryCta ? (
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
                <>
                  {primaryCta.iconKey ? (
                    <CtaIcon iconKey={primaryCta.iconKey} color={colors.primaryContrast} />
                  ) : null}
                  <Text style={styles.btnPrimaryText}>{primaryCta.label}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {secondaryCtas.map((cta) => (
            <TouchableOpacity key={cta.label} style={styles.btnSecondary} onPress={cta.onPress} activeOpacity={0.85}>
              {cta.iconKey ? <CtaIcon iconKey={cta.iconKey} color={colors.text} /> : null}
              <Text style={styles.btnSecondaryText}>{cta.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null)}
    </View>
  );
}
