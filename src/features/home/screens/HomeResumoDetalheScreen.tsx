import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useHomeData } from "../hooks/useHomeData";
import { computeHomeResumoMetrics } from "../utils/homeResumoMetrics";
import type { MotoboyRootStackParamList } from "../../../navigation/motoboyStackTypes";

type Props = NativeStackScreenProps<MotoboyRootStackParamList, "ResumoDetalhe">;

export default function HomeResumoDetalheScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const data = useHomeData();
  const metrics = useMemo(() => computeHomeResumoMetrics(data.resumo), [data.resumo]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: {
          paddingHorizontal: space.md,
          paddingTop: space.md,
          paddingBottom: space.xl,
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
      }),
    [colors]
  );

  const goEntregas = (tab: "pendente" | "finalizadas" | "ausentes", todosPendentes?: boolean) => {
    navigation.navigate("Tabs", {
      screen: "Entregas",
      params: { initialTab: tab, ...(todosPendentes ? { todosPendentes: true } : {}) },
    });
  };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Resumo de hoje" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
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
            {data.resumo.finalizadas_hoje} concluída{data.resumo.finalizadas_hoje !== 1 ? "s" : ""} •{" "}
            {metrics.percentualConcluido}%
          </Text>
        </View>

        <TouchableOpacity style={styles.kpiRow} onPress={() => goEntregas("pendente")} activeOpacity={0.9}>
          <View style={styles.kpiLeft}>
            <Ionicons name="cube-outline" size={20} color={colors.primary} />
            <Text style={styles.kpiLabel}>Pendentes</Text>
          </View>
          <Text style={styles.kpiValue}>{data.resumo.pendentes}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.kpiRow} onPress={() => goEntregas("finalizadas")} activeOpacity={0.9}>
          <View style={styles.kpiLeft}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
            <Text style={styles.kpiLabel}>Entregues</Text>
          </View>
          <Text style={styles.kpiValue}>{data.resumo.finalizadas_hoje}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.kpiRow} onPress={() => goEntregas("ausentes")} activeOpacity={0.9}>
          <View style={styles.kpiLeft}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
            <Text style={styles.kpiLabel}>Ausências</Text>
          </View>
          <Text style={styles.kpiValue}>{data.resumo.ausentes}</Text>
        </TouchableOpacity>

        {metrics.taxaSucesso != null ? (
          <View style={styles.kpiRow}>
            <View style={styles.kpiLeft}>
              <Ionicons name="analytics-outline" size={20} color={colors.success} />
              <Text style={styles.kpiLabel}>Taxa de sucesso</Text>
            </View>
            <Text style={styles.kpiValue}>{metrics.taxaSucesso}%</Text>
          </View>
        ) : null}

        {data.resumo.atraso_d1 > 0 ? (
          <TouchableOpacity
            style={styles.kpiRow}
            onPress={() => goEntregas("pendente", true)}
            activeOpacity={0.9}
          >
            <View style={styles.kpiLeft}>
              <Ionicons name="timer-outline" size={20} color={colors.danger} />
              <Text style={styles.kpiLabel}>Atrasos</Text>
            </View>
            <Text style={styles.kpiValue}>{data.resumo.atraso_d1}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}
