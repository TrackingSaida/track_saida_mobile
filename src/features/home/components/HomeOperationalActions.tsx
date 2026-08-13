import React, { useMemo } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { textStyle, type as typo } from "../../../theme/typography";
import AppText from "../../../components/ui/AppText";
import { useFontScale } from "../../../hooks/useFontScale";
import {
  operationalIcons,
  type OperationalIconKey,
} from "../../../theme/operationalIcons";
import type { HomeCta, HomeOperationalActionsCtas } from "../utils/homeOperationalState";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type ActionHandlers = {
  onAction: (action: HomeCta["action"]) => void;
};

type Props = Omit<HomeOperationalActionsCtas, "layout"> & ActionHandlers;

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

function ScanActionButton({
  cta,
  variant,
  onPress,
  iconKey,
  fullWidth = false,
}: {
  cta: HomeCta;
  variant: "insert" | "deliver";
  onPress: () => void;
  iconKey: OperationalIconKey;
  fullWidth?: boolean;
}) {
  const colors = useThemeColors();
  const { ms } = useFontScale();
  const isDeliver = variant === "deliver";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        btn: {
          flex: fullWidth ? undefined : 1,
          width: fullWidth ? "100%" : undefined,
          minWidth: 0,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDeliver ? colors.success : colors.border,
        },
        inner: {
          paddingVertical: space.md,
          paddingHorizontal: space.sm,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          minHeight: ms(72),
        },
        innerNeutral: {
          backgroundColor: colors.chipBackground,
        },
        label: {
          ...textStyle("bodySmall"),
          fontWeight: "800",
          color: isDeliver ? colors.primaryContrast : colors.text,
          textAlign: "center",
        },
        subtitle: {
          fontSize: typo.caption,
          lineHeight: Math.round(typo.caption * 1.3),
          color: isDeliver ? "rgba(255,255,255,0.85)" : colors.textSecondary,
          textAlign: "center",
        },
      }),
    [colors, isDeliver, fullWidth, ms]
  );

  const content = (
    <>
      <CtaIcon
        iconKey={iconKey}
        color={isDeliver ? colors.primaryContrast : colors.text}
        size={22}
      />
      <AppText style={styles.label}>{cta.label}</AppText>
      {cta.subtitle ? <AppText style={styles.subtitle}>{cta.subtitle}</AppText> : null}
    </>
  );

  if (isDeliver) {
    return (
      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.92}>
        <LinearGradient
          colors={[colors.success, "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inner}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.inner, styles.innerNeutral]}>{content}</View>
    </TouchableOpacity>
  );
}

export default function HomeOperationalActions({
  viewPending,
  scanInsert,
  scanDeliver,
  tertiary = [],
  onAction,
}: Props) {
  const colors = useThemeColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { gap: space.sm, marginTop: space.md },
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
        scanRow: {
          flexDirection: "row",
          gap: space.sm,
        },
        btnTertiary: {
          paddingVertical: space.md,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: space.sm,
          borderRadius: radius.md,
          backgroundColor: colors.backgroundCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        btnTertiaryText: {
          color: colors.primary,
          fontSize: 15,
          fontWeight: "700",
        },
      }),
    [colors]
  );

  const showScanPair = scanDeliver != null;

  return (
    <View style={styles.container}>
      {viewPending ? (
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => onAction(viewPending.action)}
          activeOpacity={0.85}
        >
          <CtaIcon iconKey="pendingList" color={colors.text} />
          <AppText style={styles.btnSecondaryText}>{viewPending.label}</AppText>
        </TouchableOpacity>
      ) : null}

      {showScanPair ? (
        <View style={styles.scanRow}>
          <ScanActionButton
            cta={scanInsert}
            variant="insert"
            iconKey="scanInsert"
            onPress={() => onAction(scanInsert.action)}
          />
          <ScanActionButton
            cta={scanDeliver}
            variant="deliver"
            iconKey="scanDeliver"
            onPress={() => onAction(scanDeliver.action)}
          />
        </View>
      ) : (
        <ScanActionButton
          cta={scanInsert}
          variant="insert"
          iconKey="scanInsert"
          fullWidth
          onPress={() => onAction(scanInsert.action)}
        />
      )}

      {tertiary.map((cta) => (
        <TouchableOpacity
          key={cta.label}
          style={styles.btnTertiary}
          onPress={() => onAction(cta.action)}
          activeOpacity={0.85}
        >
          <CtaIcon iconKey="prepareRoute" color={colors.primary} />
          <AppText style={styles.btnTertiaryText}>{cta.label}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}
