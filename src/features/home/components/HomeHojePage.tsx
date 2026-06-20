import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import { operationalIcons, type OperationalIconKey } from "../../../theme/operationalIcons";
import type { HomeResumo } from "../utils/homeOperationalState";
import { computeHomeResumoMetrics } from "../utils/homeResumoMetrics";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type SummaryKpiKey = "pendentes" | "finalizadas" | "ausentes" | "atrasadas";

type SummaryColorKey = "primary" | "success" | "warning" | "danger";

type SummaryKpiConfig = {
  key: SummaryKpiKey;
  label: string;
  iconKey: OperationalIconKey;
  colorKey: SummaryColorKey;
  getValue: (resumo: HomeResumo) => number;
};

const COMPACT_KPIS: SummaryKpiConfig[] = [
  {
    key: "pendentes",
    label: "Pendentes",
    iconKey: "summaryPending",
    colorKey: "primary",
    getValue: (r) => r.pendentes,
  },
  {
    key: "finalizadas",
    label: "Finalizadas",
    iconKey: "summaryFinished",
    colorKey: "success",
    getValue: (r) => r.finalizadas_hoje,
  },
  {
    key: "ausentes",
    label: "Ausências",
    iconKey: "summaryAbsent",
    colorKey: "warning",
    getValue: (r) => r.ausentes,
  },
];

const ATRASOS_KPI: SummaryKpiConfig = {
  key: "atrasadas",
  label: "Atrasos",
  iconKey: "summaryDelayed",
  colorKey: "danger",
  getValue: (r) => r.atraso_d1,
};

type Props = {
  resumo: HomeResumo;
  onPendentes: () => void;
  onFinalizadas: () => void;
  onAusentes: () => void;
  onAtrasadas: () => void;
};

const KPI_HANDLERS: Record<SummaryKpiKey, keyof Pick<Props, "onPendentes" | "onFinalizadas" | "onAusentes" | "onAtrasadas">> = {
  pendentes: "onPendentes",
  finalizadas: "onFinalizadas",
  ausentes: "onAusentes",
  atrasadas: "onAtrasadas",
};

function resolveSummaryColor(
  colorKey: SummaryColorKey,
  colors: { primary: string; success: string; warning: string; danger: string }
): string {
  return colors[colorKey];
}

export default function HomeHojePage({
  resumo,
  onPendentes,
  onFinalizadas,
  onAusentes,
  onAtrasadas,
}: Props) {
  const colors = useThemeColors();
  const handlers = { onPendentes, onFinalizadas, onAusentes, onAtrasadas };
  const metrics = useMemo(() => computeHomeResumoMetrics(resumo), [resumo]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        scrollContent: {
          paddingHorizontal: space.md,
          paddingTop: space.md,
          paddingBottom: space.lg,
          gap: space.sm,
        },
        progressCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          padding: space.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: space.xs,
        },
        progressTitle: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: space.sm,
        },
        progressTotal: {
          fontSize: typo.body,
          color: colors.textSecondary,
          marginBottom: space.md,
        },
        progressBarTrack: {
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.chipBackground,
          overflow: "hidden",
          marginBottom: space.sm,
        },
        progressBarFill: {
          height: "100%",
          borderRadius: 5,
          backgroundColor: colors.success,
        },
        progressMeta: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          fontWeight: "600",
        },
        kpiRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.md,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          minHeight: 52,
        },
        kpiLeft: {
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          flex: 1,
        },
        kpiLabel: {
          fontSize: typo.body,
          color: colors.text,
          fontWeight: "600",
        },
        kpiValue: {
          fontSize: 20,
          fontWeight: "800",
          color: colors.text,
        },
        kpiMuted: {
          opacity: 0.85,
        },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Resumo do dia</Text>
        <Text style={styles.progressTotal}>
          {metrics.totalDia} entrega{metrics.totalDia !== 1 ? "s" : ""} hoje
        </Text>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, Math.max(0, metrics.percentualConcluido))}%` },
            ]}
          />
        </View>
        <Text style={styles.progressMeta}>
          {resumo.finalizadas_hoje} concluída{resumo.finalizadas_hoje !== 1 ? "s" : ""} •{" "}
          {metrics.percentualConcluido}%
        </Text>
      </View>

      {COMPACT_KPIS.map((kpi) => {
        const iconColor = resolveSummaryColor(kpi.colorKey, colors);
        const handlerKey = KPI_HANDLERS[kpi.key];
        return (
          <TouchableOpacity
            key={kpi.key}
            style={styles.kpiRow}
            onPress={handlers[handlerKey]}
            activeOpacity={0.9}
          >
            <View style={styles.kpiLeft}>
              <Ionicons
                name={operationalIcons[kpi.iconKey] as IoniconName}
                size={20}
                color={iconColor}
              />
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
            <Text style={styles.kpiValue}>{kpi.getValue(resumo)}</Text>
          </TouchableOpacity>
        );
      })}

      {metrics.taxaSucesso != null ? (
        <View style={[styles.kpiRow, styles.kpiMuted]}>
          <View style={styles.kpiLeft}>
            <Ionicons name="analytics-outline" size={20} color={colors.success} />
            <Text style={styles.kpiLabel}>Taxa de sucesso</Text>
          </View>
          <Text style={styles.kpiValue}>{metrics.taxaSucesso}%</Text>
        </View>
      ) : null}

      {ATRASOS_KPI.getValue(resumo) > 0 ? (
        <TouchableOpacity
          style={[styles.kpiRow, styles.kpiMuted]}
          onPress={onAtrasadas}
          activeOpacity={0.9}
        >
          <View style={styles.kpiLeft}>
            <Ionicons
              name={operationalIcons[ATRASOS_KPI.iconKey] as IoniconName}
              size={20}
              color={colors.danger}
            />
            <Text style={styles.kpiLabel}>{ATRASOS_KPI.label}</Text>
          </View>
          <Text style={styles.kpiValue}>{ATRASOS_KPI.getValue(resumo)}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
