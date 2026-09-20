import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import { operationalIcons } from "../../../theme/operationalIcons";
import {
  HOME_STATE_ASSETS,
  resolveHomeStateIconColor,
  type HomeHeroState,
} from "../utils/homeStateAssets";
import type { HomeCta } from "../utils/homeOperationalState";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  state: HomeHeroState;
  title: string;
  description: string;
  extraLines?: string[];
  viewPending?: HomeCta;
  onViewPending?: () => void;
  cardAction?: HomeCta;
  onCardAction?: () => void;
  coletaAction?: HomeCta;
  onColetaAction?: () => void;
};

export default function HomeOperationalCard({
  state,
  title,
  description,
  extraLines = [],
  viewPending,
  onViewPending,
  cardAction,
  onCardAction,
  coletaAction,
  onColetaAction,
}: Props) {
  const colors = useThemeColors();
  const visual = HOME_STATE_ASSETS[state];
  const iconColor = resolveHomeStateIconColor(visual, colors);
  const showPrimary = Boolean(cardAction && onCardAction && !viewPending);
  const showColeta = Boolean(showPrimary && coletaAction && onColetaAction);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: space.lg,
        },
        row: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space.md,
        },
        icon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
        },
        textCol: { flex: 1, minWidth: 0 },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          letterSpacing: -0.3,
          marginBottom: 4,
        },
        description: {
          fontSize: typo.body,
          color: colors.textSecondary,
          lineHeight: 22,
        },
        extra: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          marginTop: 4,
        },
        cta: {
          marginTop: space.md,
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        ctaText: {
          fontSize: typo.body,
          fontWeight: "700",
          color: colors.deliveryAccent,
        },
        primaryBtn: {
          marginTop: space.md,
          borderRadius: radius.lg,
          overflow: "hidden",
        },
        primaryInner: {
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          minHeight: 52,
        },
        primaryText: {
          color: colors.primaryContrast,
          fontSize: 16,
          fontWeight: "800",
        },
        secondaryCta: {
          marginTop: space.sm,
          alignSelf: "center",
          paddingVertical: space.xs,
        },
        secondaryText: {
          fontSize: typo.bodySmall,
          fontWeight: "600",
          color: colors.textSecondary,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons
            name={operationalIcons[visual.operationalIcon] as IoniconName}
            size={22}
            color={iconColor}
          />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          {extraLines.map((line) => (
            <Text key={line} style={styles.extra}>
              {line}
            </Text>
          ))}
        </View>
      </View>
      {viewPending && onViewPending ? (
        <TouchableOpacity
          style={styles.cta}
          onPress={onViewPending}
          accessibilityRole="button"
          accessibilityLabel={viewPending.label}
        >
          <Text style={styles.ctaText}>{viewPending.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.deliveryAccent} />
        </TouchableOpacity>
      ) : null}
      {showPrimary ? (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onCardAction}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={cardAction?.label}
        >
          <LinearGradient
            colors={[colors.deliveryAccent, "#0a6e42"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryInner}
          >
            <Ionicons
              name={operationalIcons.scanInsert as IoniconName}
              size={20}
              color={colors.primaryContrast}
            />
            <Text style={styles.primaryText}>{cardAction?.label}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}
      {showColeta ? (
        <TouchableOpacity
          style={styles.secondaryCta}
          onPress={onColetaAction}
          accessibilityRole="button"
          accessibilityLabel={coletaAction?.label}
        >
          <Text style={styles.secondaryText}>{coletaAction?.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
