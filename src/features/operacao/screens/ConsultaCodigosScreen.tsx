import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../theme/colors";
import { useAuthStore } from "../../../store/authStore";
import { effectivePodeLerSaida } from "../../../utils/role";
import {
  listSaidas,
  type ListSaidasParams,
  type SaidaListItem,
  getSaidaDetail,
  getSaidaHistorico,
  type SaidaDetail,
  type SaidaHistoricoItem,
} from "../saidasApi";

function parseYmd(s: string): Date | null {
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export default function ConsultaCodigosScreen() {
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [codigo, setCodigo] = useState("");
  const [entregador, setEntregador] = useState("");
  const [status, setStatus] = useState<string>("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [somenteG, setSomenteG] = useState(false);

  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [helpVisible, setHelpVisible] = useState(false);
  const [iosDateOpen, setIosDateOpen] = useState(false);
  const [iosWhich, setIosWhich] = useState<"de" | "ate">("de");
  const [iosDraft, setIosDraft] = useState(() => new Date());

  const [results, setResults] = useState<SaidaListItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<SaidaDetail | null>(null);
  const [selectedHistorico, setSelectedHistorico] = useState<SaidaHistoricoItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 24, paddingBottom: 48 },
        description: { fontSize: 15, color: colors.textSecondary, marginBottom: 16 },
        badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
        badge: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: colors.backgroundCard,
        },
        badgeText: { fontSize: 13, color: colors.textSecondary },
        infoCard: {
          marginTop: 8,
          padding: 16,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
        },
        infoText: { fontSize: 14, color: colors.textSecondary },
        label: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
        input: {
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 16,
          color: colors.text,
          marginBottom: 12,
        },
        row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
        btnPrimary: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 10,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        },
        btnSecondary: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: colors.backgroundCard,
          alignItems: "center",
          justifyContent: "center",
        },
        btnTextPrimary: { color: colors.primaryContrast, fontSize: 15, fontWeight: "600" },
        btnTextSecondary: { color: colors.text, fontSize: 15, fontWeight: "500" },
        resultsHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
          marginBottom: 8,
        },
        resultsHeaderText: { fontSize: 14, color: colors.textSecondary },
        card: {
          borderRadius: 12,
          padding: 14,
          backgroundColor: colors.backgroundCard,
          marginBottom: 10,
        },
        cardRowTop: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        },
        cardCodigo: { fontSize: 16, fontWeight: "700", color: colors.text },
        cardStatusBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
        },
        cardStatusText: { fontSize: 12, fontWeight: "600" },
        statusEntregue: { backgroundColor: "rgba(25,135,84,0.15)" },
        statusEntregueText: { color: "#198754" },
        statusAusente: { backgroundColor: "rgba(255,193,7,0.15)" },
        statusAusenteText: { color: "#856404" },
        statusPadrao: { backgroundColor: "rgba(13,110,253,0.10)" },
        statusPadraoText: { color: "#0d6efd" },
        cardMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
        metaPill: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: colors.chipBackground,
        },
        metaPillText: { fontSize: 12, color: colors.textSecondary },
        loadMoreBtn: { marginTop: 8, alignItems: "center" },
        loadMoreText: { fontSize: 14, color: colors.primary, fontWeight: "500" },
        emptyText: {
          marginTop: 12,
          fontSize: 14,
          color: colors.textSecondary,
        },
        togglePillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
        togglePill: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.backgroundCard,
        },
        togglePillActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primarySoft,
        },
        togglePillText: { fontSize: 13, color: colors.textSecondary },
        togglePillTextActive: { color: colors.primary },
        detailModalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        },
        detailCard: {
          width: "100%",
          maxHeight: "80%",
          borderRadius: 14,
          padding: 18,
          backgroundColor: colors.backgroundCard,
        },
        detailTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
        detailSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
        detailSectionTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 8, marginBottom: 4 },
        detailLine: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
        timelineItem: { marginBottom: 8 },
        timelineTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
        timelineDate: { fontSize: 13, color: colors.textSecondary },
        detailFooterRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
        detailCloseBtn: { paddingHorizontal: 14, paddingVertical: 8 },
        detailCloseText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
        loadingOverlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.12)",
        },
        helpBtn: {
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginBottom: 12,
        },
        helpBtnText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
        filterSectionHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        },
        filterSectionTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
        dateField: {
          justifyContent: "center",
          minHeight: 44,
        },
        iosDateOverlay: {
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.45)",
        },
        iosDateSheet: {
          padding: 16,
          paddingBottom: 28,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          backgroundColor: colors.backgroundCard,
        },
        helpModalCard: {
          width: "100%",
          maxHeight: "80%",
          borderRadius: 14,
          padding: 18,
          backgroundColor: colors.backgroundCard,
        },
      }),
    [colors]
  );

  const role = currentUser?.role;
  const podeLerSaida = effectivePodeLerSaida(currentUser);
  const tipoOwner = (currentUser?.tipo_owner as string | undefined) ?? "subbase";
  const ignorarColeta = Boolean(currentUser?.ignorar_coleta);
  const modoOperacao = (currentUser?.modo_operacao as string | undefined) ?? "codigo";

  const buildParams = useCallback(
    (override?: Partial<ListSaidasParams>): ListSaidasParams => {
      const baseParams: ListSaidasParams = {
        codigo: codigo.trim() || undefined,
        entregador: entregador.trim() || undefined,
        status: status || undefined,
        de: de.trim() || undefined,
        ate: ate.trim() || undefined,
        somente_g: somenteG || undefined,
        limit: 50,
        offset,
        sort: "recentes",
      };
      return { ...baseParams, ...override };
    },
    [codigo, entregador, status, de, ate, somenteG, offset]
  );

  const openDatePicker = useCallback(
    (which: "de" | "ate") => {
      const currentStr = which === "de" ? de : ate;
      const base = parseYmd(currentStr) ?? new Date();

      if (Platform.OS === "web") {
        return;
      }

      if (Platform.OS === "android") {
        DateTimePickerAndroid.open({
          value: base,
          mode: "date",
          onChange: (event, selectedDate) => {
            if (event.type !== "set" || !selectedDate) return;
            const ymd = formatYmd(selectedDate);
            if (which === "de") setDe(ymd);
            else setAte(ymd);
          },
        });
        return;
      }

      setIosWhich(which);
      setIosDraft(base);
      setIosDateOpen(true);
    },
    [de, ate]
  );

  const confirmIosDate = useCallback(() => {
    const ymd = formatYmd(iosDraft);
    if (iosWhich === "de") setDe(ymd);
    else setAte(ymd);
    setIosDateOpen(false);
  }, [iosDraft, iosWhich]);

  const handleBuscar = useCallback(async () => {
    if (!podeLerSaida) {
      Alert.alert("Sem permissão", "Seu usuário não possui permissão para consultar saídas.");
      return;
    }
    setLoading(true);
    setOffset(0);
    try {
      const params = buildParams({ offset: 0 });
      const res = await listSaidas(params);
      setResults(res.rows ?? []);
      setTotal(res.total ?? null);
      setHasMore(res.hasMore);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Erro", "Falha ao buscar registros de saída.");
    } finally {
      setLoading(false);
    }
  }, [buildParams, podeLerSaida]);

  const handleCarregarMais = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const nextOffset = offset + 50;
    setLoadingMore(true);
    try {
      const params = buildParams({ offset: nextOffset });
      const res = await listSaidas(params);
      setResults((prev) => [...prev, ...(res.rows ?? [])]);
      setTotal(res.total ?? null);
      setHasMore(res.hasMore);
      setOffset(nextOffset);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar mais registros.");
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, hasMore, loadingMore, offset]);

  const handleAbrirDetalhe = useCallback(
    async (item: SaidaListItem) => {
      const id = item.id ?? item.codigo;
      if (!id) return;
      setDetailVisible(true);
      setDetailLoading(true);
      try {
        const [detail, historico] = await Promise.all([getSaidaDetail(id), getSaidaHistorico(id)]);
        setSelectedDetail(detail);
        setSelectedHistorico(historico);
      } catch (err) {
        Alert.alert("Erro", "Falha ao carregar detalhes do registro.");
        setSelectedDetail(null);
        setSelectedHistorico([]);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const handleFecharDetalhe = useCallback(() => {
    setDetailVisible(false);
    setSelectedDetail(null);
    setSelectedHistorico([]);
  }, []);

  const formatStatusLabel = (s?: string | null): { label: string; style: any; textStyle: any } => {
    const raw = (s || "").toLowerCase();
    if (!raw) {
      return { label: "Sem status", style: styles.statusPadrao, textStyle: styles.statusPadraoText };
    }
    if (raw === "entregue") {
      return { label: "Entregue", style: styles.statusEntregue, textStyle: styles.statusEntregueText };
    }
    if (raw === "ausente") {
      return { label: "Ausente", style: styles.statusAusente, textStyle: styles.statusAusenteText };
    }
    return {
      label: s ?? "Status",
      style: styles.statusPadrao,
      textStyle: styles.statusPadraoText,
    };
  };

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: 12 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.description}>
            Busque saídas por código, entregador, status ou período.
          </Text>

          <TouchableOpacity
            style={styles.helpBtn}
            onPress={() => setHelpVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.helpBtnText}>Ajuda e diagnóstico</Text>
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <TouchableOpacity
              style={styles.filterSectionHeader}
              onPress={() => setFiltersExpanded((e) => !e)}
              activeOpacity={0.7}
            >
              <Text style={styles.filterSectionTitle}>Filtros</Text>
              <Ionicons
                name={filtersExpanded ? "chevron-up" : "chevron-down"}
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {filtersExpanded ? (
              <>
                <Text style={[styles.infoText, { marginBottom: 12 }]}>
                  Combine os campos e toque em Buscar.
                </Text>

                <Text style={styles.label}>Código</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: BR..., código marketplace ou interno"
                  placeholderTextColor={colors.placeholder}
                  value={codigo}
                  onChangeText={setCodigo}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />

                <Text style={styles.label}>Entregador / Motoboy</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nome do entregador (texto livre)"
                  placeholderTextColor={colors.placeholder}
                  value={entregador}
                  onChangeText={setEntregador}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Status</Text>
                <View style={styles.togglePillRow}>
                  {[
                    { key: "", label: "Todos" },
                    { key: "Saiu para entrega", label: "Saiu para entrega" },
                    { key: "Entregue", label: "Entregue" },
                    { key: "Ausente", label: "Ausente" },
                  ].map((opt) => {
                    const active = status === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key || "all"}
                        style={[styles.togglePill, active && styles.togglePillActive]}
                        onPress={() => setStatus(opt.key)}
                      >
                        <Text
                          style={[
                            styles.togglePillText,
                            active && styles.togglePillTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {Platform.OS === "web" ? (
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>De (data)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="AAAA-MM-DD"
                        placeholderTextColor={colors.placeholder}
                        value={de}
                        onChangeText={setDe}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Até (data)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="AAAA-MM-DD"
                        placeholderTextColor={colors.placeholder}
                        value={ate}
                        onChangeText={setAte}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>De (data)</Text>
                      <TouchableOpacity
                        style={[styles.input, styles.dateField]}
                        onPress={() => openDatePicker("de")}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            color: de ? colors.text : colors.placeholder,
                          }}
                        >
                          {de || "AAAA-MM-DD"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Até (data)</Text>
                      <TouchableOpacity
                        style={[styles.input, styles.dateField]}
                        onPress={() => openDatePicker("ate")}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            color: ate ? colors.text : colors.placeholder,
                          }}
                        >
                          {ate || "AAAA-MM-DD"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.togglePill, somenteG && styles.togglePillActive]}
                    onPress={() => setSomenteG((v) => !v)}
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        somenteG && styles.togglePillTextActive,
                      ]}
                    >
                      Somente pacotes G (Grandes)
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={handleBuscar}
                  disabled={loading || !podeLerSaida}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.primaryContrast} size="small" />
                  ) : (
                    <Text style={styles.btnTextPrimary}>Buscar</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsHeaderText}>
            Resultados{total != null ? ` (${total})` : ""}
          </Text>
          {results.length > 0 && (
            <Text style={styles.resultsHeaderText}>{results.length} exibido(s)</Text>
          )}
        </View>

        {results.length === 0 && !loading ? (
          <Text style={styles.emptyText}>
            Nenhum registro carregado. Ajuste os filtros acima e toque em &quot;Buscar&quot;.
          </Text>
        ) : null}

        {results.map((r) => {
          const st = formatStatusLabel(r.status as string | undefined);
          return (
            <TouchableOpacity
              key={String(r.id ?? r.codigo ?? Math.random())}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => handleAbrirDetalhe(r)}
            >
              <View style={styles.cardRowTop}>
                <Text style={styles.cardCodigo}>{r.codigo || "—"}</Text>
                <View style={[styles.cardStatusBadge, st.style]}>
                  <Text style={[styles.cardStatusText, st.textStyle]}>{st.label}</Text>
                </View>
              </View>
              <View style={styles.cardMetaRow}>
                {r.entregador ? (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>Entregador: {r.entregador}</Text>
                  </View>
                ) : null}
                {r.servico ? (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>Serviço: {r.servico}</Text>
                  </View>
                ) : null}
                {r.base ? (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>Base: {r.base}</Text>
                  </View>
                ) : null}
                {r.is_grande ? (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>Pacote G</Text>
                  </View>
                ) : null}
                {r.tsFmt ? (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{r.tsFmt}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        {hasMore ? (
          <View style={styles.loadMoreBtn}>
            <TouchableOpacity onPress={handleCarregarMais} disabled={loadingMore}>
              {loadingMore ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.loadMoreText}>Carregar mais</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {Platform.OS === "ios" ? (
        <Modal visible={iosDateOpen} transparent animationType="slide" onRequestClose={() => setIosDateOpen(false)}>
          <View style={styles.iosDateOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setIosDateOpen(false)} />
            <View style={styles.iosDateSheet}>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="spinner"
                onChange={(_, d) => {
                  if (d) setIosDraft(d);
                }}
              />
              <TouchableOpacity style={styles.btnPrimary} onPress={confirmIosDate}>
                <Text style={styles.btnTextPrimary}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      <Modal visible={helpVisible} transparent animationType="fade" onRequestClose={() => setHelpVisible(false)}>
        <View style={styles.detailModalOverlay}>
          <View style={styles.helpModalCard}>
            <Text style={styles.detailTitle}>Diagnóstico</Text>
            <Text style={[styles.detailLine, { marginBottom: 12 }]}>
              Informações úteis para suporte. Os dados vêm da mesma API do painel web.
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Role: {role ?? "desconhecida"}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  Permissão leitura saídas: {podeLerSaida ? "Ativa" : "Desativada"}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Owner: {tipoOwner}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Modo: {modoOperacao}</Text>
              </View>
              {ignorarColeta ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Coletas desativadas para este owner</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.detailFooterRow}>
              <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setHelpVisible(false)}>
                <Text style={styles.detailCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={handleFecharDetalhe}>
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailCard}>
            {detailLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 16 }}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.detailLine, { marginTop: 8 }]}>Carregando detalhes…</Text>
              </View>
            ) : (
              <ScrollView>
                <Text style={styles.detailTitle}>
                  {selectedDetail?.codigo || "Detalhe da saída"}
                </Text>
                <Text style={styles.detailSubtitle}>
                  Status: {selectedDetail?.status || "—"} • Entregador: {selectedDetail?.entregador || "—"}
                </Text>

                <Text style={styles.detailSectionTitle}>Informações principais</Text>
                <Text style={styles.detailLine}>Serviço: {selectedDetail?.servico || "—"}</Text>
                <Text style={styles.detailLine}>Base: {selectedDetail?.base || "—"}</Text>
                <Text style={styles.detailLine}>
                  Usuário registro: {selectedDetail?.username || "—"}
                </Text>
                <Text style={styles.detailLine}>
                  Entrega: {selectedDetail?.data_hora_entrega || "—"}
                </Text>

                <Text style={styles.detailSectionTitle}>Histórico</Text>
                {selectedHistorico.length === 0 ? (
                  <Text style={styles.detailLine}>Nenhum evento registrado.</Text>
                ) : (
                  selectedHistorico.map((h) => {
                    const key = String(h.id ?? `${h.evento}-${h.timestamp}`);
                    const titleParts: string[] = [];
                    if (h.evento) titleParts.push(h.evento);
                    if (h.status_anterior || h.status_novo) {
                      titleParts.push(
                        `(${h.status_anterior ?? "—"} → ${h.status_novo ?? "—"})`
                      );
                    }
                    const title = titleParts.join(" ");
                    const dateLineParts: string[] = [];
                    if (h.timestamp) dateLineParts.push(h.timestamp);
                    if (h.usuario_nome) dateLineParts.push(`por ${h.usuario_nome}`);
                    const dateLine = dateLineParts.join(" — ");
                    return (
                      <View key={key} style={styles.timelineItem}>
                        <Text style={styles.timelineTitle}>{title || "Evento"}</Text>
                        {dateLine ? <Text style={styles.timelineDate}>{dateLine}</Text> : null}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
            <View style={styles.detailFooterRow}>
              <TouchableOpacity style={styles.detailCloseBtn} onPress={handleFecharDetalhe}>
                <Text style={styles.detailCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

