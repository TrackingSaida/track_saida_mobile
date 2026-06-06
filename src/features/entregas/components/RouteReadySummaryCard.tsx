import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/colors";

interface RouteReadySummaryCardProps {
  pedidoCount: number;
  stopCount: number;
  distanceKm: number;
  estimatedMinutes: number;
  localizedStops?: number;
  reviewCount?: number;
  priorityLabel?: string | null;
  onReviewPress?: () => void;
}

export default function RouteReadySummaryCard({
  pedidoCount,
  stopCount,
  distanceKm,
  estimatedMinutes,
  localizedStops,
  reviewCount = 0,
  priorityLabel = null,
  onReviewPress,
}: RouteReadySummaryCardProps) {
  const colors = useThemeColors();

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
        metricsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
        },
        metric: {
          minWidth: "42%",
        },
        metricValue: {
          fontSize: 18,
          fontWeight: "700",
          color: colors.text,
        },
        metricLabel: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 2,
        },
        priorityLine: {
          fontSize: 13,
          color: colors.text,
          marginTop: 8,
          fontWeight: "600",
        },
        subLine: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 10,
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
      </View>
      <View style={styles.metricsGrid}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{pedidoCount}</Text>
          <Text style={styles.metricLabel}>
            pedido{pedidoCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{stopCount}</Text>
          <Text style={styles.metricLabel}>
            parada{stopCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{distanceKm.toFixed(1)}</Text>
          <Text style={styles.metricLabel}>km</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>~{estimatedMinutes}</Text>
          <Text style={styles.metricLabel}>min estimados</Text>
        </View>
      </View>
      {priorityLabel ? (
        <Text style={styles.priorityLine}>Prioridade: {priorityLabel}</Text>
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
