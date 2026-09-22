import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import OperacaoEmptyState from "../components/OperacaoEmptyState";
import { useThemeColors } from "../../../theme/colors";
import type { StaffStackParamList } from "../../../navigation/staffStackTypes";
import {
  getAcompanhamentoSaidasDia,
  type AcompanhamentoServicoBreakdown,
} from "../acompanhamentoApi";
import { fmtSLA } from "../utils/acompanhamentoOperational";

type Props = NativeStackScreenProps<StaffStackParamList, "AcompanharMotoboyDia">;

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function pctOf(part: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 1000) / 10);
}

const EMPTY_BREAKDOWN: AcompanhamentoServicoBreakdown = {
  total: 0,
  pendentes: 0,
  entregues: 0,
  ausentes: 0,
};

export default function AcompanharMotoboyDiaScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { motoboyId, motoboyNome, data, pedidos, entregues, emRota, ocorrencias, sla } =
    route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAcompanhamentoSaidasDia>> | null>(
    null
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 32 },
        sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 10 },
        summaryCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          padding: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 16,
        },
        summaryName: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
        summaryMeta: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
        kpiGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
        },
        kpiMini: {
          width: "48%",
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          padding: 12,
        },
        kpiMiniLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
        kpiMiniValue: { fontSize: 22, fontWeight: "800", color: colors.text },
        progressBar: {
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.inputBackground,
          overflow: "hidden",
          marginTop: 4,
          marginBottom: 6,
        },
        progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
        progressMeta: { fontSize: 13, color: colors.textSecondary },
        serviceCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderLeftWidth: 4,
        },
        serviceHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        },
        serviceTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
        serviceCount: { fontSize: 22, fontWeight: "800", color: colors.text },
        serviceBreakdown: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
        resumoText: { fontSize: 14, color: colors.text, lineHeight: 21 },
        retryBtn: {
          marginTop: 12,
          alignSelf: "center",
          paddingVertical: 10,
          paddingHorizontal: 16,
        },
        retryText: { color: colors.primary, fontWeight: "700" },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAcompanhamentoSaidasDia(motoboyId, { data, modo: "saidas" });
      setDetail(res);
    } catch {
      setError("Não foi possível carregar o detalhe do motoboy.");
    } finally {
      setLoading(false);
    }
  }, [motoboyId, data]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const totalPedidos = pedidos ?? 0;
  const totalEntregues = entregues ?? 0;
  const progressPct = pctOf(totalEntregues, totalPedidos);

  const por = detail?.por_servico;
  const servicos = [
    {
      label: "Shopee",
      accent: "#ee4d2d",
      fallbackTotal: detail?.sum_shopee ?? 0,
      breakdown: por?.shopee ?? EMPTY_BREAKDOWN,
    },
    {
      label: "Mercado Livre",
      accent: "#c9a227",
      fallbackTotal: detail?.sum_mercado ?? 0,
      breakdown: por?.mercado_livre ?? EMPTY_BREAKDOWN,
    },
    {
      label: "Avulso",
      accent: "#6c757d",
      fallbackTotal: detail?.sum_avulso ?? 0,
      breakdown: por?.avulso ?? EMPTY_BREAKDOWN,
    },
  ];

  const totalHoje = detail?.total_hoje ?? detail?.pendentes_hoje ?? 0;
  const pendentesHoje = detail?.pendentes_hoje ?? 0;
  const entreguesHoje = detail?.entregues_hoje ?? 0;
  const ausentesHoje = detail?.ausentes_hoje ?? 0;

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Detalhe do dia"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryName}>{motoboyNome}</Text>
          <Text style={styles.summaryMeta}>Data: {formatDateLabel(data)}</Text>

          <View style={styles.kpiGrid}>
            <View style={styles.kpiMini}>
              <Text style={styles.kpiMiniLabel}>Pedidos</Text>
              <Text style={styles.kpiMiniValue}>{pedidos ?? "—"}</Text>
            </View>
            <View style={styles.kpiMini}>
              <Text style={styles.kpiMiniLabel}>Entregues</Text>
              <Text style={styles.kpiMiniValue}>{entregues ?? "—"}</Text>
            </View>
            <View style={styles.kpiMini}>
              <Text style={styles.kpiMiniLabel}>Em rota</Text>
              <Text style={styles.kpiMiniValue}>{emRota ?? "—"}</Text>
            </View>
            <View style={styles.kpiMini}>
              <Text style={styles.kpiMiniLabel}>Ocorrências</Text>
              <Text style={styles.kpiMiniValue}>{ocorrencias ?? "—"}</Text>
            </View>
          </View>

          <Text style={styles.progressMeta}>
            Progresso {progressPct}% · {fmtSLA(sla)}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Volumes por serviço</Text>
        {loading && !detail ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
        ) : error ? (
          <>
            <OperacaoEmptyState message={error} icon="cloud-offline-outline" />
            <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {servicos.map((s) => {
              const total = por ? s.breakdown.total : s.fallbackTotal;
              const bd = s.breakdown;
              return (
                <View key={s.label} style={[styles.serviceCard, { borderLeftColor: s.accent }]}>
                  <View style={styles.serviceHeader}>
                    <Text style={styles.serviceTitle}>{s.label}</Text>
                    <Text style={styles.serviceCount}>{total}</Text>
                  </View>
                  {por ? (
                    <Text style={styles.serviceBreakdown}>
                      Pendentes {bd.pendentes} · Entregues {bd.entregues} · Ausentes {bd.ausentes}
                    </Text>
                  ) : null}
                </View>
              );
            })}

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Resumo operacional</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.resumoText}>
                {totalHoje} pedido{totalHoje !== 1 ? "s" : ""} neste dia
                {por
                  ? `: ${pendentesHoje} pendente${pendentesHoje !== 1 ? "s" : ""}, ${entreguesHoje} entregue${
                      entreguesHoje !== 1 ? "s" : ""
                    }, ${ausentesHoje} ausente${ausentesHoje !== 1 ? "s" : ""}.`
                  : ", somando todos os serviços."}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
