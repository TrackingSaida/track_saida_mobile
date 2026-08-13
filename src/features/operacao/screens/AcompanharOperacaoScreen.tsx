import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import OperacaoFilterButton from "../components/OperacaoFilterButton";
import OperacaoEmptyState from "../components/OperacaoEmptyState";
import { useThemeColors } from "../../../theme/colors";
import type { StaffStackParamList } from "../../../navigation/staffStackTypes";
import { getAcompanhamentoDia, type AcompanhamentoMotoboyItem } from "../acompanhamentoApi";
import {
  applyQuickFilter,
  deriveStatus,
  emptyMessageForFilter,
  fmtSLA,
  fmtUltimaEntrega,
  motoboyStatusColors,
  type QuickFilterKey,
} from "../utils/acompanhamentoOperational";
import { formatPersonName } from "../../../utils/personName";

type Props = NativeStackScreenProps<StaffStackParamList, "AcompanharOperacao">;

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function pctOf(part: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 1000) / 10);
}

const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "criticos", label: "Críticos" },
  { key: "sem_entrega", label: "Sem entrega" },
  { key: "finalizados", label: "Finalizados" },
];

const SERVICE_CHIP_COLORS = {
  shopee: { bg: "#fee2e2", fg: "#b91c1c" },
  ml: { bg: "#fef3c7", fg: "#a16207" },
  avulso: { bg: "#e5e7eb", fg: "#374151" },
};

export default function AcompanharOperacaoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
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
        content: { padding: 16, paddingBottom: 32 },
        sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 10 },
        sectionHint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
        search: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          color: colors.text,
          marginBottom: 12,
        },
        kpiGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 14,
        },
        kpiMini: {
          width: "48%",
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          padding: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          minHeight: 88,
        },
        kpiMiniLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
        kpiMiniValue: { fontSize: 26, fontWeight: "800", color: colors.text },
        kpiMiniHint: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        entradaCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          padding: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 14,
        },
        entradaTitle: {
          fontSize: 13,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 10,
        },
        entradaRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
        entradaCell: { flex: 1, alignItems: "center" },
        entradaLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
        entradaValue: { fontSize: 20, fontWeight: "800", color: colors.text },
        progressWrap: { marginBottom: 16 },
        progressLegend: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 8,
        },
        legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
        legendDot: { width: 8, height: 8, borderRadius: 999 },
        legendText: { fontSize: 12, color: colors.textSecondary },
        progressBar: {
          height: 12,
          borderRadius: 999,
          backgroundColor: colors.inputBackground,
          overflow: "hidden",
          flexDirection: "row",
        },
        progressSeg: { height: "100%" },
        progressMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
        chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
        chip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
        },
        chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
        chipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
        chipTextActive: { color: colors.primary },
        motoboyCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        motoboyTop: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: 8,
        },
        motoboyName: { fontSize: 16, fontWeight: "800", color: colors.text, flex: 1 },
        motoboyMeta: { fontSize: 14, color: colors.text, marginBottom: 4 },
        motoboySub: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
        miniBar: {
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.inputBackground,
          overflow: "hidden",
          flexDirection: "row",
          marginBottom: 10,
        },
        serviceRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
        serviceChip: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
        },
        serviceChipText: { fontSize: 11, fontWeight: "700" },
        statusBadge: {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
        },
        statusBadgeText: { fontSize: 11, fontWeight: "800" },
        sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          paddingBottom: 28,
        },
        sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 16 },
        dateBtn: {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          marginBottom: 10,
        },
        dateBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        dateBtnText: { fontSize: 15, fontWeight: "600", color: colors.text },
        sheetActions: { flexDirection: "row", gap: 10, marginTop: 12 },
        btnPrimary: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
        },
        btnPrimaryText: { color: colors.primaryContrast, fontWeight: "700" },
        btnSecondary: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
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

  const progressPct = useMemo(() => pctOf(totais.entregues, totais.pedidos), [totais]);
  const segEntregues = useMemo(() => pctOf(totais.entregues, totais.pedidos), [totais]);
  const segEmRota = useMemo(() => pctOf(totais.em_rota, totais.pedidos), [totais]);
  const segOcorrencias = useMemo(
    () => pctOf(totais.ausente_ou_ocorrencias, totais.pedidos),
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
      >
        <Text style={styles.sectionTitle}>{resumoTitle}</Text>
        <Text style={styles.sectionHint}>Data: {formatDateLabel(dataRef)}</Text>

        {loading && items.length === 0 ? (
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
            <View style={styles.kpiGrid}>
              <View style={styles.kpiMini}>
                <Text style={styles.kpiMiniLabel}>Pedidos</Text>
                <Text style={styles.kpiMiniValue}>{totais.pedidos}</Text>
                <Text style={styles.kpiMiniHint}>Total do dia</Text>
              </View>
              <View style={styles.kpiMini}>
                <Text style={styles.kpiMiniLabel}>Entregues</Text>
                <Text style={styles.kpiMiniValue}>{totais.entregues}</Text>
                <Text style={styles.kpiMiniHint}>{progressPct}% concluído</Text>
              </View>
              <View style={styles.kpiMini}>
                <Text style={styles.kpiMiniLabel}>Em rota</Text>
                <Text style={styles.kpiMiniValue}>{totais.em_rota}</Text>
                <Text style={styles.kpiMiniHint}>{pctOf(totais.em_rota, totais.pedidos)}% do total</Text>
              </View>
              <View style={styles.kpiMini}>
                <Text style={styles.kpiMiniLabel}>Ocorrências</Text>
                <Text style={styles.kpiMiniValue}>{totais.ausente_ou_ocorrencias}</Text>
                <Text style={styles.kpiMiniHint}>{fmtSLA(totais.sla)}</Text>
              </View>
            </View>

            {totais.entrada_habilitada ? (
              <View style={styles.entradaCard}>
                <Text style={styles.entradaTitle}>Entrada na base × saídas</Text>
                <View style={styles.entradaRow}>
                  <View style={styles.entradaCell}>
                    <Text style={styles.entradaLabel}>Entradas</Text>
                    <Text style={styles.entradaValue}>{totais.entradas ?? 0}</Text>
                  </View>
                  <View style={styles.entradaCell}>
                    <Text style={styles.entradaLabel}>Já saíram</Text>
                    <Text style={styles.entradaValue}>{totais.saidas ?? 0}</Text>
                  </View>
                  <View style={styles.entradaCell}>
                    <Text style={styles.entradaLabel}>% saída</Text>
                    <Text style={styles.entradaValue}>
                      {totais.pct_saida_sobre_entrada != null
                        ? `${totais.pct_saida_sobre_entrada}%`
                        : "—"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.progressWrap}>
              <Text style={styles.sectionTitle}>Progresso geral</Text>
              <View style={styles.progressLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.legendText}>Entregues</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
                  <Text style={styles.legendText}>Em rota</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                  <Text style={styles.legendText}>Ocorrências</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                {segEntregues > 0 ? (
                  <View
                    style={[
                      styles.progressSeg,
                      { width: `${segEntregues}%`, backgroundColor: colors.primary },
                    ]}
                  />
                ) : null}
                {segEmRota > 0 ? (
                  <View
                    style={[styles.progressSeg, { width: `${segEmRota}%`, backgroundColor: "#f59e0b" }]}
                  />
                ) : null}
                {segOcorrencias > 0 ? (
                  <View
                    style={[
                      styles.progressSeg,
                      { width: `${segOcorrencias}%`, backgroundColor: colors.danger },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={styles.progressMeta}>
                {totais.entregues} / {totais.pedidos} entregues · {fmtSLA(totais.sla)}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Motoboys</Text>
            <View style={styles.chipsRow}>
              {QUICK_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, quickFilter === f.key && styles.chipActive]}
                  onPress={() => setQuickFilter(f.key)}
                >
                  <Text style={[styles.chipText, quickFilter === f.key && styles.chipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.search}
              value={filtroNome}
              onChangeText={setFiltroNome}
              placeholder="Filtrar por motoboy"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
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
              filteredItems.map((row) => {
                const status = deriveStatus(row);
                const colorsBadge = motoboyStatusColors(status.key);
                const ultima = fmtUltimaEntrega(row.ultima_entrega);
                const rowPct = pctOf(row.entregues, row.pedidos);
                const rowEmRota = pctOf(row.em_rota, row.pedidos);
                const rowOcorr = pctOf(row.ausente_ou_ocorrencias, row.pedidos);
                const shopee = row.sum_shopee ?? 0;
                const ml = row.sum_mercado ?? 0;
                const avulso = row.sum_avulso ?? 0;
                const hasServicos = shopee + ml + avulso > 0;
                return (
                  <TouchableOpacity
                    key={row.motoboy_id}
                    style={styles.motoboyCard}
                    activeOpacity={0.85}
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
                  >
                    <View style={styles.motoboyTop}>
                      <Text style={styles.motoboyName}>
                        {formatPersonName(row.motoboy_nome || "")}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: colorsBadge.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: colorsBadge.fg }]}>
                          {status.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.motoboyMeta}>
                      {row.entregues}/{row.pedidos} entregues · {rowPct}% · {fmtSLA(row.sla)}
                    </Text>
                    <Text style={styles.motoboySub}>
                      Em rota {row.em_rota} · Ocorrências {row.ausente_ou_ocorrencias} · {ultima.text}
                    </Text>
                    <View style={styles.miniBar}>
                      {rowPct > 0 ? (
                        <View
                          style={[
                            styles.progressSeg,
                            { width: `${rowPct}%`, backgroundColor: colors.primary },
                          ]}
                        />
                      ) : null}
                      {rowEmRota > 0 ? (
                        <View
                          style={[
                            styles.progressSeg,
                            { width: `${rowEmRota}%`, backgroundColor: "#f59e0b" },
                          ]}
                        />
                      ) : null}
                      {rowOcorr > 0 ? (
                        <View
                          style={[
                            styles.progressSeg,
                            { width: `${rowOcorr}%`, backgroundColor: colors.danger },
                          ]}
                        />
                      ) : null}
                    </View>
                    {hasServicos ? (
                      <View style={styles.serviceRow}>
                        <View
                          style={[
                            styles.serviceChip,
                            { backgroundColor: SERVICE_CHIP_COLORS.shopee.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.serviceChipText,
                              { color: SERVICE_CHIP_COLORS.shopee.fg },
                            ]}
                          >
                            Shopee {shopee}
                          </Text>
                        </View>
                        <View
                          style={[styles.serviceChip, { backgroundColor: SERVICE_CHIP_COLORS.ml.bg }]}
                        >
                          <Text
                            style={[styles.serviceChipText, { color: SERVICE_CHIP_COLORS.ml.fg }]}
                          >
                            ML {ml}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.serviceChip,
                            { backgroundColor: SERVICE_CHIP_COLORS.avulso.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.serviceChipText,
                              { color: SERVICE_CHIP_COLORS.avulso.fg },
                            ]}
                          >
                            Avulso {avulso}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={filterSheetVisible} transparent animationType="slide">
        <Pressable style={styles.sheetOverlay} onPress={() => setFilterSheetVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Filtros</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Data</Text>
            {[today, yesterday].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.dateBtn, draftDate === d && styles.dateBtnActive]}
                onPress={() => setDraftDate(d)}
              >
                <Text style={styles.dateBtnText}>
                  {d === today ? "Hoje" : "Ontem"} ({formatDateLabel(d)})
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => {
                  setDraftDate(today);
                }}
              >
                <Text style={{ fontWeight: "600", color: colors.text }}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => {
                  setDataRef(draftDate);
                  setFilterSheetVisible(false);
                }}
              >
                <Text style={styles.btnPrimaryText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
