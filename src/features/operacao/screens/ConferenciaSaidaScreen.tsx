import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import * as Haptics from "expo-haptics";
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
  getConferenciaTotaisAbas,
  listarConferencias,
  type ConferenciaAba,
  type ConferenciaDetalhe,
  type ConferenciaItem,
  type ConferenciaTotaisAbas,
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

const TAB_COUNTS_DEFAULT: ConferenciaTotaisAbas = {
  pendente: 0,
  reconferir: 0,
  conferida: 0,
};

function statusLabelUi(status: string): string {
  if (status === "reconferir") return "Reconferir";
  if (status === "conferida") return "Concluída";
  return "Pendente";
}

/** Cores por status da conferência (badge e chip ativo). */
function statusTone(status: string): { bg: string; fg: string; border: string } {
  if (status === "conferida") {
    return { bg: "rgba(25,135,84,0.16)", fg: "#198754", border: "rgba(25,135,84,0.45)" };
  }
  if (status === "reconferir") {
    return { bg: "rgba(194,65,12,0.14)", fg: "#c2410c", border: "rgba(194,65,12,0.4)" };
  }
  // pendente
  return { bg: "rgba(202,138,4,0.16)", fg: "#a16207", border: "rgba(202,138,4,0.45)" };
}

function labelNovosPacotes(qtd: number): string {
  if (qtd <= 0) return "Sem pacotes novos";
  return qtd === 1 ? "+1 pacote novo" : `+${qtd} novos pacotes`;
}

function labelNovosPorServico(d: ConferenciaDetalhe): string {
  const parts: string[] = [];
  const sh = d.novos_shopee ?? 0;
  const ml = d.novos_mercado ?? 0;
  const av = d.novos_avulso ?? 0;
  if (sh > 0) parts.push(`+${sh} Shopee`);
  if (ml > 0) parts.push(`+${ml} ML`);
  if (av > 0) parts.push(`+${av} Avulso${av === 1 ? "" : "s"}`);
  return parts.length ? `Entrou ${parts.join(" · ")}` : "Sem pacotes novos após a última conferência";
}

export default function ConferenciaSaidaScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [periodo, setPeriodo] = useState<PeriodoConsulta>(() => buildPeriodo("hoje"));
  const initialAba = route.params?.initialAba;
  const highlightMotoboyId = route.params?.motoboyId;
  const [aba, setAba] = useState<ConferenciaAba>(
    initialAba === "reconferir" || initialAba === "conferida" || initialAba === "pendente"
      ? initialAba
      : "pendente"
  );
  const [filtroNome, setFiltroNome] = useState("");
  const [items, setItems] = useState<ConferenciaItem[]>([]);
  const [tabCounts, setTabCounts] = useState<ConferenciaTotaisAbas>(TAB_COUNTS_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [detail, setDetail] = useState<ConferenciaDetalhe | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const sucessoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sucessoTimerRef.current) clearTimeout(sucessoTimerRef.current);
    };
  }, []);

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
        cardNovos: {
          marginTop: 8,
          fontSize: 13,
          fontWeight: "800",
          color: "#c2410c",
        },
        badge: {
          alignSelf: "flex-start",
          marginTop: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          borderWidth: 1,
        },
        badgeText: { fontSize: 11, fontWeight: "700" },
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
          maxHeight: "88%",
        },
        modalScroll: { flexGrow: 0 },
        modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
        modalSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 14 },
        novosBox: {
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(194,65,12,0.35)",
          backgroundColor: "rgba(254,215,170,0.35)",
          padding: 12,
          marginBottom: 14,
        },
        novosTitle: { fontSize: 14, fontWeight: "800", color: "#9a3412", marginBottom: 4 },
        novosSub: { fontSize: 13, fontWeight: "600", color: "#9a3412", marginBottom: 10 },
        novosListTitle: {
          fontSize: 12,
          fontWeight: "700",
          color: colors.textSecondary,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.3,
        },
        pacoteRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 7,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "rgba(154,52,18,0.2)",
        },
        pacoteCodigo: { fontSize: 14, fontWeight: "700", color: colors.text, flex: 1, marginRight: 8 },
        pacoteServico: { fontSize: 12, fontWeight: "700", color: "#9a3412" },
        totRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
        totBox: {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 6,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 78,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.22,
          shadowRadius: 4,
          elevation: 3,
        },
        totNum: { fontSize: 28, fontWeight: "900", letterSpacing: 0.2 },
        totLbl: {
          fontSize: 11,
          fontWeight: "800",
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: 0.3,
        },
        btnConferir: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
        },
        btnConferirText: { color: colors.primaryContrast, fontWeight: "800", fontSize: 16 },
        btnClose: { alignItems: "center", marginTop: 12, padding: 8 },
        btnCloseText: { color: colors.textSecondary, fontWeight: "600" },
        sucessoBanner: {
          marginBottom: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(25,135,84,0.45)",
          backgroundColor: "rgba(25,135,84,0.16)",
          paddingVertical: 12,
          paddingHorizontal: 14,
        },
        sucessoBannerText: {
          color: "#198754",
          fontSize: 15,
          fontWeight: "800",
          textAlign: "center",
        },
      }),
    [colors, insets.bottom]
  );

  const loadTabCounts = useCallback(async () => {
    try {
      const totais = await getConferenciaTotaisAbas({
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
      });
      setTabCounts(totais);
    } catch {
      // Mantém contagens anteriores; a lista da aba ativa já tem tratamento de erro.
    }
  }, [periodo.dataFim, periodo.dataInicio]);

  const loadList = useCallback(async () => {
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

  const load = useCallback(async () => {
    await Promise.all([loadList(), loadTabCounts()]);
  }, [loadList, loadTabCounts]);

  useFocusEffect(
    useCallback(() => {
      void loadList();
    }, [loadList])
  );

  useFocusEffect(
    useCallback(() => {
      void loadTabCounts();
    }, [loadTabCounts])
  );

  const filtered = useMemo(() => {
    let list = items;
    if (highlightMotoboyId != null) {
      const highlighted = list.filter((it) => it.motoboy_id === highlightMotoboyId);
      if (highlighted.length) list = highlighted;
    }
    const q = filtroNome.trim().toLocaleLowerCase("pt-BR");
    if (!q) return list;
    return list.filter((it) => (it.motoboy_nome || "").toLocaleLowerCase("pt-BR").includes(q));
  }, [filtroNome, items, highlightMotoboyId]);

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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSucessoMsg(
        detail.status === "reconferir"
          ? "Saída reconferida com sucesso."
          : "Saída conferida com sucesso."
      );
      void load();
      if (sucessoTimerRef.current) clearTimeout(sucessoTimerRef.current);
      sucessoTimerRef.current = setTimeout(() => {
        setSucessoMsg(null);
        setDetail(null);
      }, 1400);
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
          {ABAS.map((a) => {
            const tone = statusTone(a.key);
            const active = aba === a.key;
            return (
              <TouchableOpacity
                key={a.key}
                style={[
                  styles.chip,
                  active && {
                    backgroundColor: tone.bg,
                    borderColor: tone.border,
                  },
                ]}
                onPress={() => setAba(a.key)}
              >
                <Text style={[styles.chipText, active && { color: tone.fg }]}>
                  {`${a.label} (${tabCounts[a.key] ?? 0})`}
                </Text>
              </TouchableOpacity>
            );
          })}
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
          filtered.map((it) => {
            const tone = statusTone(it.status);
            return (
              <TouchableOpacity
                key={`${it.id}-${it.data_ref}`}
                style={styles.card}
                onPress={() => void openDetail(it)}
              >
                <Text style={styles.cardTitle}>{it.motoboy_nome}</Text>
                <Text style={styles.cardMeta}>
                  {formatDateLabel(it.data_ref)}
                  {it.qtd_no_momento != null ? ` · ${it.qtd_no_momento} pacotes` : ""}
                </Text>
                {it.status === "reconferir" && typeof it.novos_qtd === "number" ? (
                  <Text style={styles.cardNovos}>{labelNovosPacotes(it.novos_qtd)}</Text>
                ) : null}
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: tone.bg, borderColor: tone.border },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: tone.fg }]}>
                    {statusLabelUi(it.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
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
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={{ paddingBottom: 4 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <Text style={styles.modalTitle}>{detail.motoboy_nome}</Text>
                <Text style={styles.modalSub}>{formatDateLabel(detail.data_ref)}</Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: statusTone(detail.status).bg,
                      borderColor: statusTone(detail.status).border,
                      marginTop: 0,
                      marginBottom: 14,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: statusTone(detail.status).fg },
                    ]}
                  >
                    {statusLabelUi(detail.status)}
                  </Text>
                </View>
                {sucessoMsg ? (
                  <View style={styles.sucessoBanner}>
                    <Text style={styles.sucessoBannerText}>{sucessoMsg}</Text>
                  </View>
                ) : null}
                <View style={styles.totRow}>
                  {(
                    [
                      { label: "Total", value: detail.total, bg: colors.primary, fg: colors.primaryContrast },
                      { label: "Shopee", value: detail.sum_shopee, bg: "#dc2626", fg: "#fff" },
                      { label: "ML", value: detail.sum_mercado, bg: "#eab308", fg: "#1f2937" },
                      { label: "Avulso", value: detail.sum_avulso, bg: "#6b7280", fg: "#fff" },
                    ] as const
                  ).map((s) => (
                    <View key={s.label} style={[styles.totBox, { backgroundColor: s.bg }]}>
                      <Text style={[styles.totNum, { color: s.fg }]}>{s.value}</Text>
                      <Text style={[styles.totLbl, { color: s.fg }]}>{s.label}</Text>
                    </View>
                  ))}
                </View>
                {detail.status === "reconferir" ? (
                  <View style={styles.novosBox}>
                    <Text style={styles.novosTitle}>
                      {labelNovosPacotes(detail.novos_qtd ?? 0)}
                    </Text>
                    <Text style={styles.novosSub}>{labelNovosPorServico(detail)}</Text>
                    {(detail.novos_pacotes?.length ?? 0) > 0 ? (
                      <>
                        <Text style={styles.novosListTitle}>Códigos novos</Text>
                        {detail.novos_pacotes!.map((p) => (
                          <View key={`${p.codigo}-${p.servico}`} style={styles.pacoteRow}>
                            <Text style={styles.pacoteCodigo} numberOfLines={1}>
                              {p.codigo}
                            </Text>
                            <Text style={styles.pacoteServico}>{p.servico}</Text>
                          </View>
                        ))}
                      </>
                    ) : null}
                  </View>
                ) : null}
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
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
