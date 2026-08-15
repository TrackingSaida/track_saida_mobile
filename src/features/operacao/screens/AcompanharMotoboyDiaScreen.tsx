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
import { getAcompanhamentoSaidasDia } from "../acompanhamentoApi";
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
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        serviceTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
        serviceCount: { fontSize: 22, fontWeight: "800", color: colors.text },
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
      const res = await getAcompanhamentoSaidasDia(motoboyId, data);
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

  const servicos = [
    { label: "Shopee", value: detail?.sum_shopee ?? 0, accent: "#ee4d2d" },
    { label: "Mercado Livre", value: detail?.sum_mercado ?? 0, accent: "#c9a227" },
    { label: "Avulso", value: detail?.sum_avulso ?? 0, accent: "#6c757d" },
  ];

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
            {servicos.map((s) => (
              <View key={s.label} style={[styles.serviceCard, { borderLeftColor: s.accent }]}>
                <Text style={styles.serviceTitle}>{s.label}</Text>
                <Text style={styles.serviceCount}>{s.value}</Text>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Resumo operacional</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.resumoText}>
                {detail?.pendentes_hoje ?? 0} pedido
                {(detail?.pendentes_hoje ?? 0) !== 1 ? "s" : ""} ainda em andamento neste dia,
                somando todos os serviços.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
