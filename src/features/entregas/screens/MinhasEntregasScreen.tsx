import React, { useCallback, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, TextInput } from "react-native";
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

export default function MinhasEntregasScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const quinzena = useMemo(() => getQuinzenaAtualIntervalo(), []);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { justifyContent: "center", alignItems: "center" },
        backBtn: { paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 },
        backText: { fontSize: 16, color: colors.primary },
        title: { fontSize: 22, fontWeight: "700", marginBottom: 16, paddingHorizontal: 16, color: colors.text },
        listContent: { padding: 16, paddingBottom: 48 },
        filtersCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
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
        resumoGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
        resumoCard: {
          flex: 1,
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 12,
        },
        resumoLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
        resumoValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
        row: {
          backgroundColor: colors.backgroundCard,
          padding: 14,
          marginBottom: 8,
          borderRadius: 12,
        },
        rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
        rowDate: { fontSize: 16, fontWeight: "600", color: colors.text },
        rowValue: { fontSize: 15, fontWeight: "700", color: colors.success },
        rowResumo: { fontSize: 13, color: colors.textSecondary },
        emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
        footerInfo: {
          backgroundColor: colors.backgroundCard,
          padding: 12,
          borderRadius: 10,
          marginTop: 10,
          marginBottom: 24,
        },
        footerInfoText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
      }),
    [colors]
  );
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState(quinzena.inicio);
  const [dataFim, setDataFim] = useState(quinzena.fim);
  const [statusFiltro, setStatusFiltro] = useState<ExtratoStatusFiltro>("grupo_entregue");
  const [extrato, setExtrato] = useState<ExtratoFinanceiro | null>(null);

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
    void load();
  }, [load]);

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
      <Text style={styles.title}>Minhas Entregas</Text>
      <View style={styles.listContent}>
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
                Entregue (Saiu/Em rota/Entregue)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, statusFiltro === "todos" && styles.chipActive]}
              onPress={() => setStatusFiltro("todos")}
            >
              <Text style={[styles.chipText, statusFiltro === "todos" && styles.chipTextActive]}>
                Todos (inclui cancelados)
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btnAplicar} onPress={handleAplicar}>
            <Text style={styles.btnAplicarText}>Aplicar filtros</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resumoGrid}>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoLabel}>Valor a receber</Text>
            <Text style={styles.resumoValue}>
              {formatCurrencyBRL(extrato?.valor_a_receber ?? "0")}
            </Text>
          </View>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoLabel}>Pacotes associados</Text>
            <Text style={styles.resumoValue}>{extrato?.total_pacotes_associados ?? 0}</Text>
          </View>
        </View>
      </View>
      <FlatList
        data={extrato?.dias ?? []}
        keyExtractor={(item) => item.data}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Sem dados no período selecionado.</Text>}
        renderItem={({ item }) => {
          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.rowDate}>{formatarDiaParaExibicao(item.data)}</Text>
                <Text style={styles.rowValue}>{formatCurrencyBRL(item.valor_dia)}</Text>
              </View>
              <Text style={styles.rowResumo}>
                Filtrados: {item.total_pacotes_filtrados} | Associados: {item.total_pacotes_associados}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.footerInfo}>
            <Text style={styles.footerInfoText}>
              Período: {extrato?.periodo_inicio ?? dataInicio} até {extrato?.periodo_fim ?? dataFim}
            </Text>
            <Text style={styles.footerInfoText}>
              Cancelados no período: {extrato?.total_cancelados ?? 0}
            </Text>
            <Text style={styles.footerInfoText}>
              Serviços filtrados: Shopee {extrato?.resumo_por_servico?.shopee ?? 0} | Flex {extrato?.resumo_por_servico?.flex ?? 0} | Avulso {extrato?.resumo_por_servico?.avulso ?? 0}
            </Text>
          </View>
        }
      />
    </View>
  );
}
