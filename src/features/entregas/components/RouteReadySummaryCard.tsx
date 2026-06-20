import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { getEstimatedRouteDurationParts } from "../utils/routeUtils";

interface RouteReadySummaryCardProps {
  pedidoCount: number;
  stopCount: number;
  distanceKm: number;
  estimatedMinutes: number;
  localizedStops?: number;
  reviewCount?: number;
  priorityLabel?: string | null;
  routeStatusLabel?: string | null;
  onReviewPress?: () => void;
}

function MetricSep({ style }: { style: object }) {
  return <Text style={style}> · </Text>;
}

export default function RouteReadySummaryCard({
  pedidoCount,
  stopCount,
  distanceKm,
  estimatedMinutes,
  localizedStops,
  reviewCount = 0,
  priorityLabel = null,
  routeStatusLabel = null,
  onReviewPress,
}: RouteReadySummaryCardProps) {
  const colors = useThemeColors();

  const durationParts = useMemo(
    () => getEstimatedRouteDurationParts(estimatedMinutes),
    [estimatedMinutes]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.success + "18",
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.success + "40",
        },
        titleRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        },
        check: {
          fontSize: 16,
          color: colors.success,
          marginRight: 6,
        },
        title: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.text,
        },
        statusBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          backgroundColor: colors.warning + "25",
        },
        statusBadgeText: {
          fontSize: 11,
          fontWeight: "700",
          color: colors.warning,
        },
        metricsLine: {
          fontSize: 15,
          lineHeight: 22,
        },
        metricsLineSecond: {
          marginTop: 2,
        },
        metricValue: {
          fontWeight: "700",
          color: colors.text,
        },
        metricLabel: {
          fontWeight: "400",
          color: colors.textSecondary,
        },
        metricSep: {
          color: colors.textSecondary,
          fontWeight: "400",
        },
        priorityLine: {
          fontSize: 14,
          color: colors.text,
          marginTop: 8,
        },
        priorityValue: {
          fontWeight: "700",
        },
        priorityLabel: {
          fontWeight: "400",
          color: colors.textSecondary,
        },
        subLine: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 8,
        },
        reviewLink: {
          fontSize: 12,
          fontWeight: "600",
          color: colors.warning,
          marginTop: 6,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.check}>✓</Text>
        <Text style={styles.title}>Rota pronta</Text>
        {routeStatusLabel ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{routeStatusLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.metricsLine}>
        <Text style={styles.metricValue}>{pedidoCount}</Text>
        <Text style={styles.metricLabel}>
          {" "}
          pedido{pedidoCount !== 1 ? "s" : ""}
        </Text>
        <MetricSep style={styles.metricSep} />
        <Text style={styles.metricValue}>{stopCount}</Text>
        <Text style={styles.metricLabel}>
          {" "}
          parada{stopCount !== 1 ? "s" : ""}
        </Text>
      </Text>

      <Text style={[styles.metricsLine, styles.metricsLineSecond]}>
        <Text style={styles.metricValue}>{distanceKm.toFixed(1)}</Text>
        <Text style={styles.metricLabel}> km</Text>
        <MetricSep style={styles.metricSep} />
        <Text style={styles.metricValue}>{durationParts.value}</Text>
        <Text style={styles.metricLabel}> {durationParts.label}</Text>
      </Text>

      {priorityLabel ? (
        <Text style={styles.priorityLine}>
          <Text style={styles.priorityLabel}>Prioridade: </Text>
          <Text style={styles.priorityValue}>{priorityLabel}</Text>
        </Text>
      ) : null}
      {localizedStops != null && (
        <Text style={styles.subLine}>
          {localizedStops} localizado{localizedStops !== 1 ? "s" : ""}
        </Text>
      )}
      {reviewCount > 0 && onReviewPress ? (
        <TouchableOpacity onPress={onReviewPress}>
          <Text style={styles.reviewLink}>
            {reviewCount} endereço{reviewCount !== 1 ? "s" : ""} precisam revisão
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
