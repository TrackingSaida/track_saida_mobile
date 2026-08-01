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

const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "criticos", label: "Críticos" },
  { key: "sem_entrega", label: "Sem entrega" },
  { key: "finalizados", label: "Finalizados" },
];

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
        kpiCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          padding: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 16,
        },
        kpiRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        kpiLabel: { fontSize: 14, color: colors.textSecondary },
        kpiValue: { fontSize: 16, fontWeight: "800", color: colors.text },
        progressWrap: { marginBottom: 16 },
        progressBar: {
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.inputBackground,
          overflow: "hidden",
          marginTop: 8,
          marginBottom: 6,
        },
        progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
        progressMeta: { fontSize: 13, color: colors.textSecondary },
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
        motoboyName: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 6 },
        motoboyMeta: { fontSize: 14, color: colors.text, marginBottom: 4 },
        motoboySub: { fontSize: 12, color: colors.textSecondary },
        statusBadge: {
          alignSelf: "flex-start",
          marginTop: 8,
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

  const progressPct = useMemo(() => {
    if (!totais.pedidos) return 0;
    return Math.min(100, Math.round((totais.entregues / totais.pedidos) * 1000) / 10);
  }, [totais]);

  const filterActiveCount = dataRef !== today ? 1 : 0;

  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatYmd(d);
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Operação"
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
        <Text style={styles.sectionTitle}>Resumo de hoje</Text>
        <Text style={[styles.progressMeta, { marginBottom: 8 }]}>
          Data: {formatDateLabel(dataRef)}
        </Text>

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
            <View style={styles.kpiCard}>
              {[
                ["Total pedidos", totais.pedidos],
                ["Entregues", totais.entregues],
                ["Em rota", totais.em_rota],
                ["Ocorrências", totais.ausente_ou_ocorrencias],
              ].map(([label, value]) => (
                <View style={styles.kpiRow} key={String(label)}>
                  <Text style={styles.kpiLabel}>{label}</Text>
                  <Text style={styles.kpiValue}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.progressWrap}>
              <Text style={styles.sectionTitle}>Progresso geral</Text>
              <Text style={styles.progressMeta}>
                {totais.entregues} / {totais.pedidos} entregues · {fmtSLA(totais.sla)}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
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
                return (
                  <TouchableOpacity
                    key={row.motoboy_id}
                    style={styles.motoboyCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate("AcompanharMotoboyDia", {
                        motoboyId: row.motoboy_id,
                        motoboyNome: row.motoboy_nome,
                        data: dataRef,
                        pedidos: row.pedidos,
                        entregues: row.entregues,
                        emRota: row.em_rota,
                        ocorrencias: row.ausente_ou_ocorrencias,
                        sla: row.sla ?? null,
                      })
                    }
                  >
                    <Text style={styles.motoboyName}>{row.motoboy_nome}</Text>
                    <Text style={styles.motoboyMeta}>
                      {row.entregues}/{row.pedidos} entregues · {fmtSLA(row.sla)}
                    </Text>
                    <Text style={styles.motoboySub}>{ultima.text}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: colorsBadge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: colorsBadge.fg }]}>
                        {status.label}
                      </Text>
                    </View>
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
