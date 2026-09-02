import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { radius, space } from "../../../theme/spacing";
import { useSemanticTones, type SemanticKey } from "../../../theme/semantic";
import AppText from "../../../components/ui/AppText";
import { formatInteger, formatPercent, taxaSaidaPercent } from "../utils/dashboardFormat";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Metric = {
  label: string;
  value: number;
};

type Props = {
  name: string;
  icon: IoniconName;
  semantic: SemanticKey;
  metrics: Metric[];
  saidas?: number;
  entradas?: number;
  showTaxa?: boolean;
};

export default function ServiceCard({
  name,
  icon,
  semantic,
  metrics,
  saidas = 0,
  entradas = 0,
  showTaxa = false,
}: Props) {
  const colors = useThemeColors();
  const tones = useSemanticTones();
  const tone = tones[semantic];
  const taxa = showTaxa ? taxaSaidaPercent(saidas, entradas) : null;
  const barWidth = taxa == null ? 0 : Math.max(0, Math.min(100, taxa));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          padding: space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: tone.bar,
          marginBottom: space.sm,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: space.sm,
        },
        iconWrap: {
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: tone.iconBg,
          alignItems: "center",
          justifyContent: "center",
        },
        title: {
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: "800",
          color: colors.text,
        },
        row: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
          gap: 8,
        },
        label: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
        value: { fontSize: 14, fontWeight: "700", color: colors.text },
        taxaWrap: { marginTop: space.sm },
        taxaRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          gap: 8,
        },
        taxaLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
        taxaValue: { fontSize: 13, fontWeight: "800", color: tone.fg },
        track: {
          height: 4,
          borderRadius: radius.full,
          backgroundColor: colors.inputBackground,
          overflow: "hidden",
        },
        fill: {
          height: "100%",
          borderRadius: radius.full,
          backgroundColor: tone.bar,
        },
      }),
    [colors, tone]
  );

  return (
    <View
      style={styles.card}
      accessibilityLabel={`${name}${taxa != null ? `, taxa de saída ${formatPercent(taxa)}` : ""}`}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={16} color={tone.fg} />
        </View>
        <AppText style={styles.title} numberOfLines={1}>
          {name}
        </AppText>
      </View>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.row}>
          <AppText style={styles.label}>{metric.label}</AppText>
          <AppText style={styles.value}>{formatInteger(metric.value)}</AppText>
        </View>
      ))}
      {showTaxa ? (
        <View style={styles.taxaWrap}>
          <View style={styles.taxaRow}>
            <AppText style={styles.taxaLabel}>Taxa saída</AppText>
            <AppText style={styles.taxaValue}>{taxa == null ? "—" : formatPercent(taxa)}</AppText>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${barWidth}%` }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
