import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import {
  ctaActionToIcon,
  operationalIcons,
  type OperationalIconKey,
} from "../../../theme/operationalIcons";
import type { HomeCta } from "../utils/homeOperationalState";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  cta: HomeCta;
  loading?: boolean;
  onPress: () => void;
};

export default function HomeNextAction({ cta, loading, onPress }: Props) {
  const colors = useThemeColors();
  const iconKey = ctaActionToIcon(cta.action);
  const isRoute =
    cta.action === "prepare_route" ||
    cta.action === "start_route" ||
    cta.action === "continue_route" ||
    cta.action === "edit_route";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: space.md },
        label: {
          fontSize: typo.sectionLabel,
          fontWeight: "700",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: colors.textSecondary,
          marginBottom: space.sm,
        },
        btn: {
          borderRadius: radius.lg,
          overflow: "hidden",
        },
        inner: {
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          minHeight: 52,
        },
        btnText: {
          color: colors.primaryContrast,
          fontSize: 16,
          fontWeight: "800",
        },
        subtitle: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          marginTop: space.xs,
        },
      }),
    [colors]
  );

  const gradient: readonly [string, string] = isRoute
    ? ["#2563eb", "#1d4ed8"]
    : [colors.deliveryAccent, "#0a6e42"];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Próxima ação</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={onPress}
        activeOpacity={0.9}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={cta.label}
      >
        <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inner}>
          {loading ? (
            <ActivityIndicator color={colors.primaryContrast} />
          ) : (
            <>
              {iconKey ? (
                <Ionicons
                  name={operationalIcons[iconKey as OperationalIconKey] as IoniconName}
                  size={20}
                  color={colors.primaryContrast}
                />
              ) : null}
              <Text style={styles.btnText}>{cta.label}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
      {cta.subtitle ? <Text style={styles.subtitle}>{cta.subtitle}</Text> : null}
    </View>
  );
}
