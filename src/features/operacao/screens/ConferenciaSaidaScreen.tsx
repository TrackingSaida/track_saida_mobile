import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import OperacaoEmptyState from "../components/OperacaoEmptyState";
import { useThemeColors } from "../../../theme/colors";
import type { StaffStackParamList } from "../../../navigation/staffStackTypes";
import {
  buildPeriodo,
  formatDateLabel,
  labelPeriodo,
  parseYmd,
  type PeriodoConsulta,
  type PeriodoPreset,
} from "../utils/periodoConsulta";
import {
  conferirSaidaMotoboy,
  getConferenciaDetalhe,
  listarConferencias,
  type ConferenciaAba,
  type ConferenciaDetalhe,
  type ConferenciaItem,
} from "../conferenciaApi";
import { formatApiError } from "../../../utils/formatApiError";

type Props = NativeStackScreenProps<StaffStackParamList, "ConferenciaSaida">;

const PRESETS: { key: PeriodoPreset; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "quinzena", label: "Quinzena atual" },
  { key: "outro", label: "Outro dia" },
];

const ABAS: { key: ConferenciaAba; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "reconferir", label: "Reconferir" },
  { key: "conferida", label: "Concluídas" },
];

function statusLabelUi(status: string): string {
  if (status === "reconferir") return "Reconferir";
  if (status === "conferida") return "Concluída";
  return "Pendente";
}

export default function ConferenciaSaidaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [periodo, setPeriodo] = useState<PeriodoConsulta>(() => buildPeriodo("hoje"));
  const [aba, setAba] = useState<ConferenciaAba>("pendente");
  const [filtroNome, setFiltroNome] = useState("");
  const [items, setItems] = useState<ConferenciaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [detail, setDetail] = useState<ConferenciaDetalhe | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [conferindo, setConferindo] = useState(false);

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
        chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
        chip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.backgroundCard,
        },
        chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
        chipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
        chipTextActive: { color: colors.primary },
        periodoLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
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
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 10,
        },
        cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
        cardMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
        badge: {
          alignSelf: "flex-start",
          marginTop: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: colors.primarySoft,
        },
        badgeText: { fontSize: 11, fontWeight: "700", color: colors.primary },
        modalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        },
        modalSheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
          paddingBottom: Math.max(20, insets.bottom + 12),
        },
        modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
        modalSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 14 },
        totRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
        totBox: {
          flex: 1,
          backgroundColor: colors.backgroundCard,
          borderRadius: 10,
          padding: 10,
          alignItems: "center",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        totNum: { fontSize: 20, fontWeight: "800", color: colors.primary },
        totLbl: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
        btnConferir: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
        },
        btnConferirText: { color: colors.primaryContrast, fontWeight: "800", fontSize: 16 },
        btnClose: { alignItems: "center", marginTop: 12, padding: 8 },
        btnCloseText: { color: colors.textSecondary, fontWeight: "600" },
      }),
    [colors, insets.bottom]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listarConferencias({
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        aba,
      });
      setItems(list);
    } catch (e) {
      setItems([]);
      setError(formatApiError(e, "Não foi possível carregar conferências."));
    } finally {
      setLoading(false);
    }
  }, [aba, periodo.dataFim, periodo.dataInicio]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = filtroNome.trim().toLocaleLowerCase("pt-BR");
    if (!q) return items;
    return items.filter((it) => (it.motoboy_nome || "").toLocaleLowerCase("pt-BR").includes(q));
  }, [filtroNome, items]);

  const openDetail = async (it: ConferenciaItem) => {
    setDetailLoading(true);
    try {
      const d = await getConferenciaDetalhe(it.motoboy_id, it.data_ref);
      setDetail(d);
    } catch (e) {
      Alert.alert("Erro", formatApiError(e, "Não foi possível abrir o detalhe."));
    } finally {
      setDetailLoading(false);
    }
  };

  const onConferir = async () => {
    if (!detail || detail.status === "conferida") return;
    setConferindo(true);
    try {
      const d = await conferirSaidaMotoboy(detail.motoboy_id, detail.data_ref);
      setDetail(d);
      Alert.alert("Conferência", "Saída conferida com sucesso.");
      void load();
    } catch (e) {
      Alert.alert("Erro", formatApiError(e, "Não foi possível conferir."));
    } finally {
      setConferindo(false);
    }
  };

  const onPreset = (key: PeriodoPreset) => {
    if (key === "outro") {
      setShowDatePicker(true);
      return;
    }
    setPeriodo(buildPeriodo(key));
  };

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (!date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    setPeriodo(buildPeriodo("outro", `${y}-${m}-${d}`));
    if (Platform.OS === "ios") setShowDatePicker(false);
  };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Conferência de saída" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>Período</Text>
        <View style={styles.chipsRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, periodo.preset === p.key && styles.chipActive]}
              onPress={() => onPreset(p.key)}
            >
              <Text style={[styles.chipText, periodo.preset === p.key && styles.chipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.periodoLabel}>
          {labelPeriodo(periodo)} ({formatDateLabel(periodo.dataInicio)}
          {periodo.dataInicio !== periodo.dataFim ? ` – ${formatDateLabel(periodo.dataFim)}` : ""})
        </Text>

        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.chipsRow}>
          {ABAS.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={[styles.chip, aba === a.key && styles.chipActive]}
              onPress={() => setAba(a.key)}
            >
              <Text style={[styles.chipText, aba === a.key && styles.chipTextActive]}>{a.label}</Text>
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

        {error ? (
          <OperacaoEmptyState message={error} icon="cloud-offline-outline" />
        ) : loading && items.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : filtered.length === 0 ? (
          <OperacaoEmptyState message="Não há registros nesta aba para o período." />
        ) : (
          filtered.map((it) => (
            <TouchableOpacity key={`${it.id}-${it.data_ref}`} style={styles.card} onPress={() => void openDetail(it)}>
              <Text style={styles.cardTitle}>{it.motoboy_nome}</Text>
              <Text style={styles.cardMeta}>
                {formatDateLabel(it.data_ref)}
                {it.qtd_no_momento != null ? ` · ${it.qtd_no_momento} pacotes` : ""}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{statusLabelUi(it.status)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {showDatePicker ? (
        <DateTimePicker
          value={parseYmd(periodo.dataInicio) || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
        />
      ) : null}

      <Modal visible={!!detail || detailLoading} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {detailLoading || !detail ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.modalTitle}>{detail.motoboy_nome}</Text>
                <Text style={styles.modalSub}>
                  {formatDateLabel(detail.data_ref)} · {statusLabelUi(detail.status)}
                </Text>
                <View style={styles.totRow}>
                  <View style={styles.totBox}>
                    <Text style={styles.totNum}>{detail.total}</Text>
                    <Text style={styles.totLbl}>Total</Text>
                  </View>
                  <View style={styles.totBox}>
                    <Text style={styles.totNum}>{detail.sum_shopee}</Text>
                    <Text style={styles.totLbl}>Shopee</Text>
                  </View>
                  <View style={styles.totBox}>
                    <Text style={styles.totNum}>{detail.sum_mercado}</Text>
                    <Text style={styles.totLbl}>ML</Text>
                  </View>
                  <View style={styles.totBox}>
                    <Text style={styles.totNum}>{detail.sum_avulso}</Text>
                    <Text style={styles.totLbl}>Avulso</Text>
                  </View>
                </View>
                {detail.status !== "conferida" ? (
                  <TouchableOpacity
                    style={styles.btnConferir}
                    disabled={conferindo}
                    onPress={() => void onConferir()}
                  >
                    {conferindo ? (
                      <ActivityIndicator color={colors.primaryContrast} />
                    ) : (
                      <Text style={styles.btnConferirText}>
                        {detail.status === "reconferir" ? "Reconferir saída" : "Conferir saída"}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.btnClose} onPress={() => setDetail(null)}>
                  <Text style={styles.btnCloseText}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
