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
  Platform,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import OperacaoEmptyState from "../components/OperacaoEmptyState";
import { useThemeColors } from "../../../theme/colors";
import type { StaffStackParamList } from "../../../navigation/staffStackTypes";
import { getAcompanhamentoSaidasDia } from "../acompanhamentoApi";
import { listMotoboysOperacao, type MotoboyItem } from "../saidasApi";
import { normalizeMotoboyList } from "../utils/motoboyListFormat";
import {
  buildPeriodo,
  formatDateLabel,
  labelPeriodo,
  parseYmd,
  type PeriodoConsulta,
  type PeriodoPreset,
} from "../utils/periodoConsulta";

type Props = NativeStackScreenProps<StaffStackParamList, "SaidasPorMotoboy">;

const PRESETS: { key: PeriodoPreset; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "quinzena", label: "Quinzena atual" },
  { key: "outro", label: "Outro dia" },
];

export default function SaidasPorMotoboyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [motoboys, setMotoboys] = useState<MotoboyItem[]>([]);
  const [motoboy, setMotoboy] = useState<MotoboyItem | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoConsulta>(() => buildPeriodo("hoje"));
  const [pickerMotoboyVisible, setPickerMotoboyVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [loadingMotoboys, setLoadingMotoboys] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAcompanhamentoSaidasDia>> | null>(
    null
  );

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
        selectBtn: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 14,
          marginBottom: 16,
        },
        selectText: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1, marginRight: 8 },
        selectPlaceholder: { color: colors.textSecondary, fontWeight: "500" },
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
        heroCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          padding: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: "center",
          marginBottom: 16,
        },
        heroTitle: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginBottom: 4 },
        heroName: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
        heroTotalLabel: {
          marginTop: 16,
          fontSize: 12,
          fontWeight: "700",
          color: colors.textSecondary,
          textTransform: "uppercase",
        },
        heroTotal: { fontSize: 42, fontWeight: "800", color: colors.primary, marginTop: 4 },
        serviceRow: { gap: 10 },
        serviceCard: {
          borderRadius: 12,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        serviceLabel: { fontSize: 15, fontWeight: "800" },
        serviceCount: { fontSize: 28, fontWeight: "800" },
        retryBtn: {
          marginTop: 12,
          alignSelf: "center",
          paddingVertical: 10,
          paddingHorizontal: 16,
        },
        retryText: { color: colors.primary, fontWeight: "700" },
        pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
        pickerSheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          paddingBottom: 28,
          maxHeight: "70%",
        },
        pickerTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 },
        pickerItem: {
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        pickerItemActive: { backgroundColor: colors.primarySoft },
        pickerItemText: { fontSize: 15, fontWeight: "600", color: colors.text, paddingHorizontal: 4 },
        pickerClose: { marginTop: 12, alignItems: "center", paddingVertical: 12 },
        pickerCloseText: { fontSize: 15, fontWeight: "700", color: colors.primary },
      }),
    [colors]
  );

  const loadMotoboys = useCallback(async () => {
    setLoadingMotoboys(true);
    try {
      const list = normalizeMotoboyList(await listMotoboysOperacao());
      setMotoboys(list);
      setMotoboy((prev) => {
        if (!prev) return null;
        return list.find((m) => m.id_motoboy === prev.id_motoboy) ?? prev;
      });
    } catch {
      setMotoboys([]);
    } finally {
      setLoadingMotoboys(false);
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (!motoboy) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getAcompanhamentoSaidasDia(motoboy.id_motoboy, {
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        modo: "saidas",
      });
      setDetail(res);
    } catch {
      setDetail(null);
      setError("Não foi possível carregar as quantidades do motoboy.");
    } finally {
      setLoading(false);
    }
  }, [motoboy, periodo.dataInicio, periodo.dataFim]);

  useFocusEffect(
    useCallback(() => {
      void loadMotoboys();
    }, [loadMotoboys])
  );

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
    }, [loadDetail])
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

  const servicos = [
    { label: "SHOPEE", value: detail?.sum_shopee ?? 0, bg: "#dc2626", fg: "#fff" },
    { label: "MERCADO LIVRE", value: detail?.sum_mercado ?? 0, bg: "#eab308", fg: "#1f2937" },
    { label: "AVULSO", value: detail?.sum_avulso ?? 0, bg: "#6b7280", fg: "#fff" },
  ];

  const pickerValue = parseYmd(periodo.dataFim) ?? new Date();

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Saídas por motoboy"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading || loadingMotoboys}
            onRefresh={() => {
              void loadMotoboys();
              void loadDetail();
            }}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>Motoboy</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setPickerMotoboyVisible(true)}
          accessibilityLabel="Selecionar motoboy"
        >
          <Text style={[styles.selectText, !motoboy && styles.selectPlaceholder]}>
            {motoboy?.nome ?? "Selecione o motoboy"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

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

        {!motoboy ? (
          <OperacaoEmptyState
            message="Selecione o motoboy para ver as quantidades por serviço."
            icon="person-outline"
          />
        ) : loading && !detail ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
        ) : error ? (
          <>
            <OperacaoEmptyState message={error} icon="cloud-offline-outline" />
            <TouchableOpacity style={styles.retryBtn} onPress={() => void loadDetail()}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>ENTREGADOR SELECIONADO</Text>
              <Text style={styles.heroName}>{detail?.motoboy_nome || motoboy.nome}</Text>
              <Text style={styles.heroTotalLabel}>Total de saídas</Text>
              <Text style={styles.heroTotal}>{detail?.pendentes_hoje ?? 0}</Text>
              {periodo.preset !== "hoje" ? (
                <Text style={[styles.periodoMeta, { marginBottom: 0, marginTop: 8 }]}>
                  Período: {formatDateLabel(periodo.dataInicio)}
                  {periodo.dataInicio !== periodo.dataFim
                    ? ` – ${formatDateLabel(periodo.dataFim)}`
                    : ""}
                </Text>
              ) : null}
            </View>

            <View style={styles.serviceRow}>
              {servicos.map((s) => (
                <View key={s.label} style={[styles.serviceCard, { backgroundColor: s.bg }]}>
                  <Text style={[styles.serviceLabel, { color: s.fg }]}>{s.label}</Text>
                  <Text style={[styles.serviceCount, { color: s.fg }]}>{s.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={pickerMotoboyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerMotoboyVisible(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerMotoboyVisible(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Escolher motoboy</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {motoboys.length === 0 ? (
                <Text style={[styles.selectPlaceholder, { paddingVertical: 16 }]}>
                  Nenhum motoboy disponível.
                </Text>
              ) : (
                motoboys.map((m) => {
                  const ativo = motoboy?.id_motoboy === m.id_motoboy;
                  return (
                    <TouchableOpacity
                      key={m.id_motoboy}
                      style={[styles.pickerItem, ativo && styles.pickerItemActive]}
                      onPress={() => {
                        setMotoboy(m);
                        setPickerMotoboyVisible(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{m.nome}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => setPickerMotoboyVisible(false)}
            >
              <Text style={styles.pickerCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
