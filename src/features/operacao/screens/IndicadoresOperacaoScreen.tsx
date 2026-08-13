import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import OperacaoEmptyState from "../components/OperacaoEmptyState";
import { useThemeColors } from "../../../theme/colors";
import { useAuthStore } from "../../../store/authStore";
import type { StaffStackParamList } from "../../../navigation/staffStackTypes";
import {
  effectiveEntradaObrigatoria,
  effectivePodeLerColeta,
  isAdminRole,
} from "../../../utils/role";
import { formatApiError } from "../../../utils/formatApiError";
import {
  getDashboardColetasPeriodo,
  getDashboardSaidasPeriodo,
  type DashboardMarketplaceItem,
} from "../indicadoresApi";
import {
  buildPeriodo,
  formatDateLabel,
  labelPeriodo,
  parseYmd,
  type PeriodoConsulta,
  type PeriodoPreset,
} from "../utils/periodoConsulta";

type Props = NativeStackScreenProps<StaffStackParamList, "IndicadoresOperacao">;

const PRESETS: { key: PeriodoPreset; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "quinzena", label: "Quinzena atual" },
  { key: "outro", label: "Outro dia" },
];

const MP_COLORS: Record<string, string> = {
  Shopee: "#ee4d2d",
  "Mercado Livre": "#c9a227",
  Avulso: "#6c757d",
};

function findMp(items: DashboardMarketplaceItem[] | undefined, nome: string): DashboardMarketplaceItem | null {
  if (!items?.length) return null;
  return items.find((x) => x.nome === nome) || null;
}

export default function IndicadoresOperacaoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const role = currentUser?.role as number | undefined;
  const mostrarEntrada = effectiveEntradaObrigatoria(currentUser);
  const mostrarColeta = effectivePodeLerColeta(currentUser);

  const [periodo, setPeriodo] = useState<PeriodoConsulta>(() => buildPeriodo("hoje"));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSaidas, setTotalSaidas] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [aindaNaBase, setAindaNaBase] = useState(0);
  const [aindaNaBaseDetalhe, setAindaNaBaseDetalhe] = useState<Array<{ date: string; qty: number }>>([]);
  const [totalColetas, setTotalColetas] = useState(0);
  const [mpSaidas, setMpSaidas] = useState<DashboardMarketplaceItem[]>([]);
  const [mpEntradas, setMpEntradas] = useState<DashboardMarketplaceItem[]>([]);
  const [mpColetas, setMpColetas] = useState<DashboardMarketplaceItem[]>([]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 40 },
        fieldLabel: {
          fontSize: 12,
          fontWeight: "700",
          color: colors.textSecondary,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
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
        periodoMeta: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
        grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
        kpiCard: {
          width: "48%",
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          padding: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          minHeight: 96,
        },
        kpiLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
        kpiValue: { fontSize: 28, fontWeight: "800", color: colors.text },
        kpiHint: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        sectionTitle: {
          fontSize: 15,
          fontWeight: "800",
          color: colors.text,
          marginTop: 20,
          marginBottom: 10,
        },
        mpCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          padding: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 10,
          borderLeftWidth: 4,
        },
        mpTitle: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 8, letterSpacing: 0.3 },
        mpRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
        mpLabel: { fontSize: 13, color: colors.textSecondary },
        mpValue: { fontSize: 14, fontWeight: "700", color: colors.text },
        detalheBox: {
          marginTop: 12,
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        detalheTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 6 },
        detalheLine: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
        center: { paddingVertical: 40, alignItems: "center" },
        errorText: { color: colors.danger, textAlign: "center", marginTop: 12 },
      }),
    [colors]
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isAdminRole(role)) {
        setError("Indicadores disponíveis apenas para admin.");
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const saidas = await getDashboardSaidasPeriodo(periodo.dataInicio, periodo.dataFim);
        setTotalSaidas(Number(saidas?.cards?.total_saidas || 0));
        setMpSaidas(saidas?.por_marketplace || []);

        if (mostrarEntrada && saidas?.entrada_habilitada && saidas.entrada) {
          setTotalEntradas(Number(saidas.entrada.total_entradas || 0));
          setAindaNaBase(Number(saidas.entrada.ainda_na_base || 0));
          setAindaNaBaseDetalhe(saidas.entrada.ainda_na_base_detalhe || []);
          setMpEntradas(saidas.entrada.por_marketplace || []);
        } else {
          setTotalEntradas(0);
          setAindaNaBase(0);
          setAindaNaBaseDetalhe([]);
          setMpEntradas([]);
        }

        if (mostrarColeta) {
          try {
            const coletas = await getDashboardColetasPeriodo(periodo.dataInicio, periodo.dataFim);
            setTotalColetas(Number(coletas?.cards?.total_coletas || 0));
            const fromCards: DashboardMarketplaceItem[] = [
              { nome: "Shopee", qty: Number(coletas?.cards?.shopee || 0) },
              { nome: "Mercado Livre", qty: Number(coletas?.cards?.mercado_livre || 0) },
              { nome: "Avulso", qty: Number(coletas?.cards?.avulso || 0) },
            ];
            setMpColetas(coletas?.por_marketplace?.length ? coletas.por_marketplace : fromCards);
          } catch {
            setTotalColetas(0);
            setMpColetas([]);
          }
        } else {
          setTotalColetas(0);
          setMpColetas([]);
        }
      } catch (err) {
        setError(formatApiError(err, "Não foi possível carregar os indicadores."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mostrarColeta, mostrarEntrada, periodo.dataFim, periodo.dataInicio, role]
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  const onSelectPreset = (key: PeriodoPreset) => {
    if (key === "outro") {
      setShowDatePicker(true);
      return;
    }
    setPeriodo(buildPeriodo(key));
  };

  const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type === "dismissed") {
      if (Platform.OS === "ios") setShowDatePicker(false);
      return;
    }
    if (!selectedDate) return;
    const iso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    setPeriodo(buildPeriodo("outro", iso));
    if (Platform.OS === "ios") setShowDatePicker(false);
  };

  if (!isAdminRole(role)) {
    return (
      <View style={styles.container}>
        <ScreenHeaderBar
          title="Indicadores"
          onBack={() => navigation.goBack()}
          paddingTop={Math.max(12, insets.top)}
        />
        <OperacaoEmptyState message="Indicadores disponíveis apenas para admin." />
      </View>
    );
  }

  const servicos = ["Shopee", "Mercado Livre", "Avulso"] as const;
  const pickerValue = parseYmd(periodo.dataFim) ?? new Date();
  const hintPeriodo = periodo.dataInicio === periodo.dataFim ? "No dia" : "No período";

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Indicadores"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>Período</Text>
        <View style={styles.chipsRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, periodo.preset === p.key && styles.chipActive]}
              onPress={() => onSelectPreset(p.key)}
            >
              <Text style={[styles.chipText, periodo.preset === p.key && styles.chipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.periodoMeta}>{labelPeriodo(periodo)}</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <View style={styles.grid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Saídas</Text>
                <Text style={styles.kpiValue}>{totalSaidas}</Text>
                <Text style={styles.kpiHint}>{hintPeriodo}</Text>
              </View>
              {mostrarEntrada ? (
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Entradas</Text>
                  <Text style={styles.kpiValue}>{totalEntradas}</Text>
                  <Text style={styles.kpiHint}>{hintPeriodo}</Text>
                </View>
              ) : null}
              {mostrarEntrada ? (
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Ainda na base</Text>
                  <Text style={styles.kpiValue}>{aindaNaBase}</Text>
                  <Text style={styles.kpiHint}>Aguardando saída</Text>
                </View>
              ) : null}
              {mostrarColeta ? (
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Coletas</Text>
                  <Text style={styles.kpiValue}>{totalColetas}</Text>
                  <Text style={styles.kpiHint}>{hintPeriodo}</Text>
                </View>
              ) : null}
            </View>

            {mostrarEntrada && aindaNaBaseDetalhe.length > 0 ? (
              <View style={styles.detalheBox}>
                <Text style={styles.detalheTitle}>Na base por dia</Text>
                {aindaNaBaseDetalhe.slice(0, 5).map((d) => (
                  <Text key={d.date} style={styles.detalheLine}>
                    {formatDateLabel(d.date)}: {d.qty} pacote(s)
                  </Text>
                ))}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Por serviço</Text>
            {servicos.map((nome) => {
              const s = findMp(mpSaidas, nome);
              const e = findMp(mpEntradas, nome);
              const c = findMp(mpColetas, nome);
              const accent = MP_COLORS[nome] || colors.primary;
              return (
                <View key={nome} style={[styles.mpCard, { borderLeftColor: accent }]}>
                  <Text style={styles.mpTitle}>{nome.toUpperCase()}</Text>
                  {mostrarColeta ? (
                    <View style={styles.mpRow}>
                      <Text style={styles.mpLabel}>Coletas</Text>
                      <Text style={styles.mpValue}>{c?.qty ?? 0}</Text>
                    </View>
                  ) : null}
                  {mostrarEntrada ? (
                    <View style={styles.mpRow}>
                      <Text style={styles.mpLabel}>Entradas</Text>
                      <Text style={styles.mpValue}>{e?.qty ?? 0}</Text>
                    </View>
                  ) : null}
                  <View style={styles.mpRow}>
                    <Text style={styles.mpLabel}>Saídas</Text>
                    <Text style={styles.mpValue}>{s?.qty ?? 0}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {showDatePicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeDate}
          maximumDate={new Date()}
        />
      ) : null}
    </View>
  );
}
