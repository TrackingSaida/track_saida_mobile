import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import AppText from "../../../components/ui/AppText";
import OperacaoEmptyState from "../components/OperacaoEmptyState";
import FilterChip from "../components/FilterChip";
import KpiCard from "../components/KpiCard";
import ServiceCard from "../components/ServiceCard";
import BaseByDayCard from "../components/BaseByDayCard";
import { useThemeColors } from "../../../theme/colors";
import { radius, space } from "../../../theme/spacing";
import { serviceSemanticKey } from "../../../theme/semantic";
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
  labelPeriodo,
  parseYmd,
  type PeriodoConsulta,
  type PeriodoPreset,
} from "../utils/periodoConsulta";

type Props = NativeStackScreenProps<StaffStackParamList, "IndicadoresOperacao">;

const PRESETS: { key: PeriodoPreset; label: string; icon?: "calendar-outline" }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "quinzena", label: "Quinzena atual" },
  { key: "quinzena_anterior", label: "Quinzena anterior" },
  { key: "outro", label: "Outro dia", icon: "calendar-outline" },
];

const SERVICE_ICONS = {
  Shopee: "bag-handle-outline",
  "Mercado Livre": "storefront-outline",
  Avulso: "cube-outline",
} as const;

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
  const [mpNaBase, setMpNaBase] = useState<DashboardMarketplaceItem[]>([]);
  const [mpCancelados, setMpCancelados] = useState<DashboardMarketplaceItem[]>([]);
  const [mpColetas, setMpColetas] = useState<DashboardMarketplaceItem[]>([]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: space.md, paddingBottom: 40 },
        fieldLabel: {
          fontSize: 12,
          fontWeight: "700",
          color: colors.textSecondary,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
        periodoMeta: { fontSize: 13, color: colors.textSecondary, marginBottom: space.md },
        grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
        sectionTitle: {
          fontSize: 15,
          fontWeight: "800",
          color: colors.text,
          marginTop: space.lg,
          marginBottom: 10,
        },
        center: { paddingVertical: 40, alignItems: "center" },
        errorText: { color: colors.danger, textAlign: "center", marginTop: 12 },
        errorBox: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.md,
          padding: space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
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
          setMpNaBase(saidas.entrada.ainda_na_base_por_marketplace || []);
          setMpCancelados(saidas.entrada.cancelados_apos_entrada_por_marketplace || []);
        } else {
          setTotalEntradas(0);
          setAindaNaBase(0);
          setAindaNaBaseDetalhe([]);
          setMpEntradas([]);
          setMpNaBase([]);
          setMpCancelados([]);
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

  const abrirConsultaNaBase = (de: string, ate: string) => {
    const tabNav = navigation.getParent() as
      | { navigate: (name: string, params?: Record<string, unknown>) => void }
      | undefined;
    tabNav?.navigate("Inicio", {
      screen: "ConsultaCodigos",
      params: { status: "NA_BASE", de, ate },
    });
  };

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
        <AppText style={styles.fieldLabel}>Período</AppText>
        <View style={styles.chipsRow}>
          {PRESETS.map((p) => (
            <FilterChip
              key={p.key}
              label={p.label}
              selected={periodo.preset === p.key}
              onPress={() => onSelectPreset(p.key)}
              icon={p.icon}
            />
          ))}
        </View>
        <AppText style={styles.periodoMeta}>{labelPeriodo(periodo)}</AppText>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <AppText style={styles.errorText}>{error}</AppText>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              <KpiCard
                title="Saídas"
                value={totalSaidas}
                subtitle={hintPeriodo}
                icon="arrow-up-circle-outline"
                semantic="primary"
                variant="filledSoft"
              />
              {mostrarEntrada ? (
                <KpiCard
                  title="Entradas"
                  value={totalEntradas}
                  subtitle={hintPeriodo}
                  icon="download-outline"
                  semantic="success"
                  variant="filledSoft"
                />
              ) : null}
              {mostrarEntrada ? (
                <KpiCard
                  title="Ainda na base"
                  value={aindaNaBase}
                  subtitle="Aguardando saída"
                  icon="cube-outline"
                  semantic="route"
                  variant="filledSoft"
                  onPress={
                    aindaNaBase > 0
                      ? () => abrirConsultaNaBase(periodo.dataInicio, periodo.dataFim)
                      : undefined
                  }
                />
              ) : null}
              {mostrarColeta ? (
                <KpiCard
                  title="Coletas"
                  value={totalColetas}
                  subtitle={hintPeriodo}
                  icon="bag-handle-outline"
                  semantic="collection"
                  variant="filledSoft"
                />
              ) : null}
            </View>

            {mostrarEntrada && aindaNaBaseDetalhe.length > 0 ? (
              <BaseByDayCard
                items={aindaNaBaseDetalhe}
                onPressDay={(date) => abrirConsultaNaBase(date, date)}
              />
            ) : null}

            <AppText style={styles.sectionTitle}>Por serviço</AppText>
            {servicos.map((nome) => {
              const s = findMp(mpSaidas, nome);
              const e = findMp(mpEntradas, nome);
              const c = findMp(mpColetas, nome);
              const n = findMp(mpNaBase, nome);
              const canc = findMp(mpCancelados, nome);
              const metrics = [
                ...(mostrarColeta ? [{ label: "Coletas", value: c?.qty ?? 0 }] : []),
                ...(mostrarEntrada ? [{ label: "Entradas", value: e?.qty ?? 0 }] : []),
                { label: "Saídas", value: s?.qty ?? 0 },
                ...(mostrarEntrada ? [{ label: "Na base", value: n?.qty ?? 0 }] : []),
                ...(mostrarEntrada ? [{ label: "Cancelados", value: canc?.qty ?? 0 }] : []),
              ];
              return (
                <ServiceCard
                  key={nome}
                  name={nome}
                  icon={SERVICE_ICONS[nome]}
                  semantic={serviceSemanticKey(nome)}
                  metrics={metrics}
                  saidas={s?.qty ?? 0}
                  entradas={e?.qty ?? 0}
                  showTaxa={mostrarEntrada}
                />
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
