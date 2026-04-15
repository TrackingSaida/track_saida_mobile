import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeColors } from "../../../theme/colors";
import { getExtratoFinanceiro } from "../api";
import type { ExtratoFinanceiro, ExtratoStatusFiltro } from "../types";
import { formatarDiaParaExibicao, getQuinzenaAtualIntervalo } from "../utils/quinzena";
import type { MaisStackParamList } from "../../../screens/MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "MinhasEntregas">;

function formatCurrencyBRL(value: string): string {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeServico(servico: string): "Shopee" | "Flex" | "Avulso" {
  const s = (servico || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("flex") || s.includes("mercado") || s.includes("ml")) return "Flex";
  return "Avulso";
}

export default function MinhasEntregasScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const quinzena = useMemo(() => getQuinzenaAtualIntervalo(), []);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { justifyContent: "center", alignItems: "center" },
        backBtn: { paddingHorizontal: 16, paddingVertical: 8 },
        backText: { fontSize: 16, color: colors.primary },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          marginBottom: 10,
        },
        filterIconBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.border,
        },
        content: { paddingHorizontal: 16, paddingBottom: 24 },
        topBar: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        topBarRow: { flexDirection: "row", gap: 10 },
        topCard: {
          flex: 1,
          backgroundColor: colors.chipBackground,
          borderRadius: 10,
          padding: 10,
        },
        topLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
        topValue: { color: colors.text, fontSize: 19, fontWeight: "800" },
        topPeriod: { marginTop: 10, color: colors.textSecondary, fontSize: 12 },
        listContent: { paddingBottom: 42 },
        dayCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 12,
          marginBottom: 8,
        },
        dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        dayTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
        dayTotalBadge: {
          borderRadius: 999,
          backgroundColor: colors.primary,
          paddingVertical: 4,
          paddingHorizontal: 10,
        },
        dayTotalText: { color: colors.primaryContrast, fontSize: 12, fontWeight: "700" },
        badgesRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
        serviceBadge: {
          borderRadius: 999,
          paddingVertical: 3,
          paddingHorizontal: 8,
        },
        serviceBadgeText: { fontSize: 11, fontWeight: "700" },
        itensWrap: {
          marginTop: 10,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: 8,
        },
        itemRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 7,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        itemCodigo: { color: colors.text, fontSize: 14, fontWeight: "600" },
        statusBadge: {
          borderRadius: 999,
          paddingVertical: 3,
          paddingHorizontal: 8,
          backgroundColor: colors.chipBackground,
        },
        statusText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
        filtersCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 12,
          marginTop: 8,
        },
        filterLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
        filterRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.separator,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: colors.text,
          backgroundColor: colors.background,
        },
        actionsRow: { flexDirection: "row", gap: 8 },
        chip: {
          flex: 1,
          borderRadius: 8,
          paddingVertical: 10,
          alignItems: "center",
          backgroundColor: colors.background,
        },
        chipActive: { backgroundColor: colors.primary },
        chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
        chipTextActive: { color: colors.primaryContrast },
        btnAplicar: {
          marginTop: 8,
          backgroundColor: colors.primary,
          borderRadius: 8,
          alignItems: "center",
          paddingVertical: 10,
        },
        btnAplicarText: { color: colors.primaryContrast, fontWeight: "700" },
        emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
        modalOverlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        modalSheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 16,
          paddingTop: 10,
        },
        modalHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        },
        modalTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
        closeBtn: { padding: 6 },
      }),
    [colors]
  );
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState(quinzena.inicio);
  const [dataFim, setDataFim] = useState(quinzena.fim);
  const [statusFiltro, setStatusFiltro] = useState<ExtratoStatusFiltro>("grupo_entregue");
  const [extrato, setExtrato] = useState<ExtratoFinanceiro | null>(null);
  const [showFiltros, setShowFiltros] = useState(false);
  const [expandedByDay, setExpandedByDay] = useState<Record<string, boolean>>({});

  const load = useCallback(async (custom?: { dataInicio?: string; dataFim?: string; statusFiltro?: ExtratoStatusFiltro }) => {
    setLoading(true);
    try {
      const res = await getExtratoFinanceiro({
        data_inicio: custom?.dataInicio ?? dataInicio,
        data_fim: custom?.dataFim ?? dataFim,
        status_filtro: custom?.statusFiltro ?? statusFiltro,
      });
      setExtrato(res);
    } catch {
      setExtrato(null);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, statusFiltro]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleAplicar = useCallback(() => {
    setShowFiltros(false);
    void load();
  }, [load]);

  const toggleDia = useCallback((dia: string) => {
    setExpandedByDay((prev) => ({ ...prev, [dia]: !prev[dia] }));
  }, []);

  const serviceBadgeStyle = useCallback(
    (servico: "Shopee" | "Flex" | "Avulso") => {
      if (servico === "Shopee") return { bg: "rgba(238,77,45,0.16)", fg: "#ee4d2d" };
      if (servico === "Flex") return { bg: "rgba(255,224,102,0.28)", fg: "#6a5a00" };
      return { bg: "rgba(99,102,241,0.16)", fg: "#6366f1" };
    },
    []
  );

  const getStatusColor = useCallback(
    (status: string) => {
      const s = (status || "").trim().toLowerCase();
      if (s.includes("entreg")) return colors.success;
      if (s.includes("ausente")) return colors.warning;
      if (s.includes("cancel")) return colors.danger;
      if (s.includes("rota") || s.includes("saiu")) return colors.primary;
      return colors.textSecondary;
    },
    [colors]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(24, insets.top) }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Minhas Entregas</Text>
        <TouchableOpacity style={styles.filterIconBtn} onPress={() => setShowFiltros(true)}>
          <Ionicons name="filter-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.topBarRow}>
            <View style={styles.topCard}>
              <Text style={styles.topLabel}>Valor total</Text>
              <Text style={styles.topValue}>{formatCurrencyBRL(extrato?.valor_a_receber ?? "0")}</Text>
            </View>
            <View style={styles.topCard}>
              <Text style={styles.topLabel}>Total de pedidos</Text>
              <Text style={styles.topValue}>{extrato?.total_pacotes_filtrados ?? 0}</Text>
            </View>
          </View>
          <Text style={styles.topPeriod}>
            Período: {extrato?.periodo_inicio ?? dataInicio} até {extrato?.periodo_fim ?? dataFim}
          </Text>
        </View>
      </View>

      <FlatList
        data={extrato?.dias ?? []}
        keyExtractor={(item) => item.data}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Sem dados no período selecionado.</Text>}
        renderItem={({ item }) => {
          const expanded = !!expandedByDay[item.data];
          const byServico = { Shopee: 0, Flex: 0, Avulso: 0 };
          item.itens.forEach((it) => {
            const t = normalizeServico(it.servico);
            byServico[t] += 1;
          });

          return (
            <View style={styles.dayCard}>
              <TouchableOpacity style={styles.dayHeader} onPress={() => toggleDia(item.data)} activeOpacity={0.8}>
                <Text style={styles.dayTitle}>{formatarDiaParaExibicao(item.data)}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={styles.dayTotalBadge}>
                    <Text style={styles.dayTotalText}>{item.total_pacotes_filtrados} pedidos</Text>
                  </View>
                  <Ionicons
                    name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
                    size={16}
                    color={colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              <View style={styles.badgesRow}>
                {(["Shopee", "Flex", "Avulso"] as const).map((serv) => {
                  const c = serviceBadgeStyle(serv);
                  return (
                    <View key={`${item.data}-${serv}`} style={[styles.serviceBadge, { backgroundColor: c.bg }]}>
                      <Text style={[styles.serviceBadgeText, { color: c.fg }]}>{serv}: {byServico[serv]}</Text>
                    </View>
                  );
                })}
              </View>

              {expanded ? (
                <View style={styles.itensWrap}>
                  {item.itens.map((it) => (
                    <View key={`${item.data}-${it.id_saida}`} style={styles.itemRow}>
                      <Text style={styles.itemCodigo}>{it.codigo || "—"}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(it.exibicao)}22` }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(it.exibicao) }]}>{it.exibicao}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <Modal visible={showFiltros} transparent animationType="slide" onRequestClose={() => setShowFiltros(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFiltros(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(20, insets.bottom + 10) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowFiltros(false)}>
                <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.filtersCard}>
              <Text style={styles.filterLabel}>Período (YYYY-MM-DD)</Text>
              <View style={styles.filterRow}>
                <TextInput
                  style={styles.input}
                  value={dataInicio}
                  onChangeText={setDataInicio}
                  placeholder="2026-04-01"
                  placeholderTextColor={colors.placeholder}
                />
                <TextInput
                  style={styles.input}
                  value={dataFim}
                  onChangeText={setDataFim}
                  placeholder="2026-04-15"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.chip, statusFiltro === "grupo_entregue" && styles.chipActive]}
                  onPress={() => setStatusFiltro("grupo_entregue")}
                >
                  <Text style={[styles.chipText, statusFiltro === "grupo_entregue" && styles.chipTextActive]}>
                    Entregue
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, statusFiltro === "todos" && styles.chipActive]}
                  onPress={() => setStatusFiltro("todos")}
                >
                  <Text style={[styles.chipText, statusFiltro === "todos" && styles.chipTextActive]}>
                    Todos
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.btnAplicar} onPress={handleAplicar}>
                <Text style={styles.btnAplicarText}>Aplicar filtros</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
