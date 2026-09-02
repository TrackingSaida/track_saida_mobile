import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import AppText from "../../../components/ui/AppText";
import OperacaoFilterButton from "../components/OperacaoFilterButton";
import OperacaoEmptyState from "../components/OperacaoEmptyState";
import FilterChip from "../components/FilterChip";
import KpiCard from "../components/KpiCard";
import MetricTrioCard from "../components/MetricTrioCard";
import MotoboyProgressCard from "../components/MotoboyProgressCard";
import SearchField from "../components/SearchField";
import SegmentedProgressBar from "../components/SegmentedProgressBar";
import { useThemeColors } from "../../../theme/colors";
import { radius, space } from "../../../theme/spacing";
import { useSemanticTones } from "../../../theme/semantic";
import type { StaffStackParamList } from "../../../navigation/staffStackTypes";
import { getAcompanhamentoDia, type AcompanhamentoMotoboyItem } from "../acompanhamentoApi";
import {
  applyQuickFilter,
  emptyMessageForFilter,
  type QuickFilterKey,
} from "../utils/acompanhamentoOperational";
import { formatPersonName } from "../../../utils/personName";
import { formatInteger, formatPercent, ratioPercentOrZero } from "../utils/dashboardFormat";
import { formatDateLabel, formatYmd } from "../utils/periodoConsulta";

type Props = NativeStackScreenProps<StaffStackParamList, "AcompanharOperacao">;

const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "criticos", label: "Críticos" },
  { key: "sem_entrega", label: "Sem entrega" },
  { key: "finalizados", label: "Finalizados" },
];

export default function AcompanharOperacaoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const tones = useSemanticTones();
  const today = useMemo(() => formatYmd(new Date()), []);

  const [dataRef, setDataRef] = useState(today);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("todos");
  const [items, setItems] = useState<AcompanhamentoMotoboyItem[]>([]);
  const [totais, setTotais] = useState({
    pedidos: 0,
    entregues: 0,
    em_rota: 0,
    ausente_ou_ocorrencias: 0,
    sla: null as number | null,
    entrada_habilitada: false,
    entradas: null as number | null,
    saidas: null as number | null,
    pct_saida_sobre_entrada: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(today);
  const [filtroNome, setFiltroNome] = useState("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: space.md, paddingBottom: 32 },
        sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 6 },
        sectionHint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
        kpiGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: space.md,
        },
        progressWrap: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          padding: space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: space.md,
        },
        progressTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 10 },
        progressLegend: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 8,
        },
        legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
        legendDot: { width: 8, height: 8, borderRadius: 999 },
        legendText: { fontSize: 12, color: colors.textSecondary },
        progressMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
        chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: space.md },
        sheetOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          padding: space.lg,
          paddingBottom: 28,
        },
        sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: space.md },
        sheetLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
        dateBtn: {
          minHeight: 44,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          marginBottom: 10,
          justifyContent: "center",
        },
        dateBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        dateBtnText: { fontSize: 15, fontWeight: "600", color: colors.text },
        sheetActions: { flexDirection: "row", gap: 10, marginTop: 12 },
        btnPrimary: {
          flex: 1,
          minHeight: 48,
          paddingVertical: 14,
          borderRadius: radius.md,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        btnPrimaryText: { color: colors.primaryContrast, fontWeight: "700" },
        btnSecondary: {
          minHeight: 48,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          justifyContent: "center",
        },
        btnSecondaryText: { fontWeight: "600", color: colors.text },
        retryBtn: {
          marginTop: 12,
          alignSelf: "center",
          paddingVertical: 10,
          paddingHorizontal: 16,
          minHeight: 44,
          justifyContent: "center",
        },
        retryText: { color: colors.primary, fontWeight: "700" },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAcompanhamentoDia(dataRef);
      setItems(res.items);
      setTotais({
        pedidos: res.totais.pedidos,
        entregues: res.totais.entregues,
        em_rota: res.totais.em_rota,
        ausente_ou_ocorrencias: res.totais.ausente_ou_ocorrencias,
        sla: res.totais.sla ?? null,
        entrada_habilitada: Boolean(res.totais.entrada_habilitada),
        entradas: res.totais.entradas ?? null,
        saidas: res.totais.saidas ?? null,
        pct_saida_sobre_entrada: res.totais.pct_saida_sobre_entrada ?? null,
      });
    } catch {
      setError("Não foi possível carregar o acompanhamento.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [dataRef]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filteredItems = useMemo(() => {
    const byStatus = applyQuickFilter(items, quickFilter);
    const q = filtroNome.trim().toLocaleLowerCase("pt-BR");
    if (!q) return byStatus;
    return byStatus.filter((row) =>
      (row.motoboy_nome || "").toLocaleLowerCase("pt-BR").includes(q)
    );
  }, [filtroNome, items, quickFilter]);

  const progressPct = useMemo(
    () => ratioPercentOrZero(totais.entregues, totais.pedidos),
    [totais]
  );
  const ocorrenciasPct = useMemo(
    () => ratioPercentOrZero(totais.ausente_ou_ocorrencias, totais.pedidos),
    [totais]
  );
  const emRotaPct = useMemo(
    () => ratioPercentOrZero(totais.em_rota, totais.pedidos),
    [totais]
  );

  const filterActiveCount = dataRef !== today ? 1 : 0;
  const resumoTitle = dataRef === today ? "Resumo de hoje" : "Resumo do dia";

  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatYmd(d);
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Acompanhamento"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
        rightElement={
          <OperacaoFilterButton
            activeCount={filterActiveCount}
            onPress={() => {
              setDraftDate(dataRef);
              setFilterSheetVisible(true);
            }}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        keyboardShouldPersistTaps="handled"
      >
        <AppText style={styles.sectionTitle}>{resumoTitle}</AppText>
        <AppText style={styles.sectionHint}>Data: {formatDateLabel(dataRef)}</AppText>

        {loading && items.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
        ) : error ? (
          <>
            <OperacaoEmptyState message={error} icon="cloud-offline-outline" />
            <TouchableOpacity style={styles.retryBtn} onPress={() => void load()} accessibilityRole="button">
              <AppText style={styles.retryText}>Tentar novamente</AppText>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <KpiCard
                title="Pedidos"
                value={totais.pedidos}
                subtitle="Total do dia"
                icon="cube-outline"
                semantic="primary"
                variant="tonal"
              />
              <KpiCard
                title="Entregues"
                value={totais.entregues}
                subtitle={`${formatPercent(progressPct)} concluído`}
                icon="checkmark-circle-outline"
                semantic="success"
                variant="tonal"
                progress={progressPct}
              />
              <KpiCard
                title="Em rota"
                value={totais.em_rota}
                subtitle={`${formatPercent(emRotaPct)} do total`}
                icon="navigate-outline"
                semantic="route"
                variant="tonal"
                progress={emRotaPct}
              />
              <KpiCard
                title="Ocorrências"
                value={totais.ausente_ou_ocorrencias}
                subtitle={`${formatPercent(ocorrenciasPct)} do total`}
                icon="alert-circle-outline"
                semantic="danger"
                variant="tonal"
                progress={ocorrenciasPct}
              />
            </View>

            {totais.entrada_habilitada ? (
              <MetricTrioCard
                title="Entrada na base × saídas"
                items={[
                  {
                    label: "Entradas",
                    value: totais.entradas ?? 0,
                    semantic: "primary",
                    icon: "download-outline",
                  },
                  {
                    label: "Já saíram",
                    value: totais.saidas ?? 0,
                    semantic: "success",
                    icon: "arrow-up-circle-outline",
                  },
                  {
                    label: "% saída",
                    value:
                      totais.pct_saida_sobre_entrada != null
                        ? totais.pct_saida_sobre_entrada
                        : "—",
                    semantic: "collection",
                    icon: "analytics-outline",
                    isPercent: totais.pct_saida_sobre_entrada != null,
                  },
                ]}
              />
            ) : null}

            <View style={styles.progressWrap}>
              <AppText style={styles.progressTitle}>Progresso geral</AppText>
              <View style={styles.progressLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: tones.success.bar }]} />
                  <AppText style={styles.legendText}>Entregues</AppText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: tones.route.bar }]} />
                  <AppText style={styles.legendText}>Em rota</AppText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: tones.danger.bar }]} />
                  <AppText style={styles.legendText}>Ocorrências</AppText>
                </View>
              </View>
              <SegmentedProgressBar
                total={totais.pedidos}
                segments={[
                  { value: totais.entregues, color: tones.success.bar },
                  { value: totais.em_rota, color: tones.route.bar },
                  { value: totais.ausente_ou_ocorrencias, color: tones.danger.bar },
                ]}
                accessibilityLabel={`Progresso: ${formatInteger(totais.entregues)} de ${formatInteger(totais.pedidos)} entregues`}
              />
              <AppText style={styles.progressMeta}>
                {formatInteger(totais.entregues)} / {formatInteger(totais.pedidos)} entregues ·{" "}
                {formatPercent(progressPct)} concluído
              </AppText>
            </View>

            <AppText style={styles.sectionTitle}>Motoboys</AppText>
            <View style={styles.chipsRow}>
              {QUICK_FILTERS.map((f) => (
                <FilterChip
                  key={f.key}
                  label={f.label}
                  selected={quickFilter === f.key}
                  onPress={() => setQuickFilter(f.key)}
                />
              ))}
            </View>
            <SearchField
              value={filtroNome}
              onChangeText={setFiltroNome}
              placeholder="Filtrar por motoboy"
            />

            {items.length === 0 ? (
              <OperacaoEmptyState message="Sem dados para a data selecionada." />
            ) : filteredItems.length === 0 ? (
              <OperacaoEmptyState
                message={
                  filtroNome.trim()
                    ? "Nenhum motoboy encontrado com este nome."
                    : emptyMessageForFilter(quickFilter)
                }
              />
            ) : (
              filteredItems.map((row) => (
                <MotoboyProgressCard
                  key={row.motoboy_id}
                  row={row}
                  onPress={() =>
                    navigation.navigate("AcompanharMotoboyDia", {
                      motoboyId: row.motoboy_id,
                      motoboyNome: formatPersonName(row.motoboy_nome || ""),
                      data: dataRef,
                      pedidos: row.pedidos,
                      entregues: row.entregues,
                      emRota: row.em_rota,
                      ocorrencias: row.ausente_ou_ocorrencias,
                      sla: row.sla ?? null,
                    })
                  }
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={filterSheetVisible} transparent animationType="slide">
        <Pressable style={styles.sheetOverlay} onPress={() => setFilterSheetVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <AppText style={styles.sheetTitle}>Filtros</AppText>
            <AppText style={styles.sheetLabel}>Data</AppText>
            {[today, yesterday].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.dateBtn, draftDate === d && styles.dateBtnActive]}
                onPress={() => setDraftDate(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: draftDate === d }}
              >
                <AppText style={styles.dateBtnText}>
                  {d === today ? "Hoje" : "Ontem"} ({formatDateLabel(d)})
                </AppText>
              </TouchableOpacity>
            ))}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => {
                  setDraftDate(today);
                }}
                accessibilityRole="button"
                accessibilityLabel="Limpar filtros"
              >
                <AppText style={styles.btnSecondaryText}>Limpar</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => {
                  setDataRef(draftDate);
                  setFilterSheetVisible(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Aplicar filtros"
              >
                <AppText style={styles.btnPrimaryText}>Aplicar</AppText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
