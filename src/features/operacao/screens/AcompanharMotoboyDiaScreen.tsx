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
        kpiRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        kpiLabel: { fontSize: 14, color: colors.textSecondary },
        kpiValue: { fontSize: 16, fontWeight: "800", color: colors.text },
        serviceCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        serviceTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
        serviceCount: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 4 },
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

  const servicos = [
    { label: "Shopee", value: detail?.sum_shopee ?? 0 },
    { label: "Mercado Livre / Flex", value: detail?.sum_mercado ?? 0 },
    { label: "Avulso", value: detail?.sum_avulso ?? 0 },
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
          {[
            ["Total pedidos", pedidos ?? "—"],
            ["Entregues", entregues ?? "—"],
            ["Em rota", emRota ?? "—"],
            ["Ocorrências", ocorrencias ?? "—"],
            ["SLA", sla != null ? fmtSLA(sla) : "—"],
          ].map(([label, value]) => (
            <View style={styles.kpiRow} key={String(label)}>
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={styles.kpiValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Pendentes por serviço</Text>
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
              <View key={s.label} style={styles.serviceCard}>
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
