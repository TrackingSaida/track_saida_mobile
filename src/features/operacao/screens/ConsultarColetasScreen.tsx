import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { formatApiError } from "../../../utils/formatApiError";
import { useAuthStore } from "../../../store/authStore";
import { ownerEntityLabel, ownerEntityLabelLower } from "../../../utils/ownerLabels";
import { isAdminRole } from "../../../utils/role";
import type { ColetasFluxoParamList } from "../../../navigation/staffStackTypes";
import {
  carregarConsultaColetasPorPeriodo,
  corrigirQuantidadesParticipante,
  type ParticipanteSituacaoColeta,
  type SituacaoBaseColeta,
} from "../coletasApi";
import ColetaSituacaoBadge from "../components/ColetaSituacaoBadge";
import ColetaServicoBadges from "../components/ColetaServicoBadges";
import {
  hojeOperacaoLocal,
  isColetaPendente,
  situacaoColetaBadgeColors,
  statusColetaNormalizado,
  type ColetaStatusFiltro,
} from "../utils/coletaSituacaoUi";
import {
  buildPeriodo,
  formatDateLabel,
  formatYmd,
  isPeriodoDiaUnico,
  labelPeriodo,
  parseYmd,
  type PeriodoConsulta,
  type PeriodoPreset,
} from "../utils/periodoConsulta";

type Filtro = "todos" | ColetaStatusFiltro;
type Nav = NativeStackNavigationProp<ColetasFluxoParamList, "ConsultarColetas">;

type CorrecaoCtx = {
  item: SituacaoBaseColeta;
  participante: ParticipanteSituacaoColeta;
  flex: string;
  shopee: string;
  avulso: string;
};

const PRESETS: { key: PeriodoPreset; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "quinzena", label: "Quinzena atual" },
  { key: "quinzena_anterior", label: "Quinzena anterior" },
  { key: "outro", label: "Outro dia" },
];

function money(value: number | string | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function modoLabel(modo: SituacaoBaseColeta["modo"]): string {
  if (modo === "codigo") return "Leitura";
  if (modo === "coleta_manual") return "Manual";
  if (modo === "ambos") return "Leitura e manual";
  return "—";
}

function dataItemColeta(item: SituacaoBaseColeta, periodo: PeriodoConsulta): string {
  const raw = (item.data_operacao || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return isPeriodoDiaUnico(periodo) ? periodo.dataInicio : "";
}

function podeRegistrarHoje(item: SituacaoBaseColeta, periodo: PeriodoConsulta): boolean {
  if (!isColetaPendente(item.status)) return false;
  const data = dataItemColeta(item, periodo);
  return data === hojeOperacaoLocal();
}

export default function ConsultarColetasScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const entidadeLabel = ownerEntityLabel(currentUser);
  const entidadeLabelLower = ownerEntityLabelLower(currentUser);
  const podeCorrigirRole = isAdminRole(currentUser?.role);
  const [periodo, setPeriodo] = useState<PeriodoConsulta>(() => buildPeriodo("hoje"));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [itens, setItens] = useState<SituacaoBaseColeta[]>([]);
  const [resumo, setResumo] = useState({ pendentes: 0, em_coleta: 0, coletadas: 0 });
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [correcao, setCorrecao] = useState<CorrecaoCtx | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroCorrecao, setErroCorrecao] = useState("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 40, gap: 12 },
        fieldLabel: {
          fontSize: 12,
          fontWeight: "700",
          color: colors.textSecondary,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.backgroundCard,
        },
        chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
        chipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
        chipTextActive: { color: colors.primary },
        periodoLabel: { fontSize: 13, color: colors.textSecondary },
        resumo: { flexDirection: "row", gap: 8 },
        kpi: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, backgroundColor: colors.backgroundCard },
        kpiValue: { fontSize: 23, fontWeight: "900" },
        kpiLabel: { fontSize: 11, marginTop: 3, fontWeight: "700" },
        filtros: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
        filtro: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
        filtroAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
        filtroText: { color: colors.text, fontWeight: "700", fontSize: 12 },
        filtroTextAtivo: { color: colors.primaryContrast },
        card: { padding: 15, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard },
        cardPendente: { borderColor: "rgba(218,165,32,0.55)" },
        row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
        title: { color: colors.text, fontWeight: "800", fontSize: 16, flex: 1 },
        muted: { color: colors.textSecondary, fontSize: 12, marginTop: 7, lineHeight: 17 },
        atalho: { color: colors.primary, fontSize: 12, fontWeight: "700", marginTop: 10 },
        btnCorrigir: {
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        btnCorrigirText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
        center: { alignItems: "center", paddingVertical: 40 },
        error: { color: colors.danger, textAlign: "center" },
        modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
        modalCard: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: 18,
          gap: 10,
          maxHeight: "88%",
        },
        modalTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
        fieldLabelModal: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 4 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          fontSize: 16,
          fontWeight: "700",
        },
        preview: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
          backgroundColor: colors.background,
          gap: 4,
        },
        previewText: { color: colors.text, fontSize: 13, lineHeight: 18 },
        actions: { flexDirection: "row", gap: 10, marginTop: 6 },
        btnGhost: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
        },
        btnPrimary: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
        },
        btnGhostText: { color: colors.text, fontWeight: "700" },
        btnPrimaryText: { color: colors.primaryContrast, fontWeight: "800" },
      }),
    [colors]
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const payload = await carregarConsultaColetasPorPeriodo(periodo.dataInicio, periodo.dataFim);
      setItens(payload.itens || []);
      setResumo(payload.resumo || { pendentes: 0, em_coleta: 0, coletadas: 0 });
    } catch (error) {
      setErro(formatApiError(error, "Não foi possível consultar as coletas."));
    } finally {
      setLoading(false);
    }
  }, [periodo.dataFim, periodo.dataInicio]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const onSelectPreset = (key: PeriodoPreset) => {
    if (key === "outro") {
      setShowDatePicker(true);
      return;
    }
    setPeriodo(buildPeriodo(key));
    setFiltro("todos");
  };

  const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type === "dismissed") {
      if (Platform.OS === "ios") setShowDatePicker(false);
      return;
    }
    if (!selectedDate) return;
    setPeriodo(buildPeriodo("outro", formatYmd(selectedDate)));
    setFiltro("todos");
    if (Platform.OS === "ios") setShowDatePicker(false);
  };

  const multiDia = !isPeriodoDiaUnico(periodo);
  const visiveis = filtro === "todos" ? itens : itens.filter((item) => statusColetaNormalizado(item.status) === filtro);
  const totaisServico = useMemo(
    () =>
      itens.reduce(
        (acc, item) => ({
          shopee: acc.shopee + (item.shopee || 0),
          mercadoLivre: acc.mercadoLivre + (item.mercado_livre || 0),
          avulso: acc.avulso + (item.avulso || 0),
          total: acc.total + (item.total || 0),
        }),
        { shopee: 0, mercadoLivre: 0, avulso: 0, total: 0 }
      ),
    [itens]
  );

  const abrirLeitura = (item: SituacaoBaseColeta) => {
    if (!podeRegistrarHoje(item, periodo)) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("LeituraColetas", { baseId: item.base_id, baseNome: item.base });
  };

  const abrirCorrecao = (item: SituacaoBaseColeta, participante: ParticipanteSituacaoColeta) => {
    if (!podeCorrigirRole || !participante.pode_corrigir) return;
    if (dataItemColeta(item, periodo) !== hojeOperacaoLocal()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErroCorrecao("");
    setCorrecao({
      item,
      participante,
      flex: String(participante.mercado_livre ?? 0),
      shopee: String(participante.shopee ?? 0),
      avulso: String(participante.avulso ?? 0),
    });
  };

  const preview = useMemo(() => {
    if (!correcao) return null;
    const flex = Math.max(0, parseInt(correcao.flex || "0", 10) || 0);
    const shopee = Math.max(0, parseInt(correcao.shopee || "0", 10) || 0);
    const avulso = Math.max(0, parseInt(correcao.avulso || "0", 10) || 0);
    const antFlex = Number(correcao.participante.mercado_livre ?? 0);
    const antShopee = Number(correcao.participante.shopee ?? 0);
    const antAvulso = Number(correcao.participante.avulso ?? 0);
    const precos = correcao.item.precos || { shopee: "0", mercado_livre: "0", avulso: "0" };
    const valorNovo =
      flex * Number(precos.mercado_livre || 0) +
      shopee * Number(precos.shopee || 0) +
      avulso * Number(precos.avulso || 0);
    const valorAnterior = Number(
      correcao.participante.valor_total ??
        antFlex * Number(precos.mercado_livre || 0) +
          antShopee * Number(precos.shopee || 0) +
          antAvulso * Number(precos.avulso || 0)
    );
    return {
      flex,
      shopee,
      avulso,
      dFlex: flex - antFlex,
      dShopee: shopee - antShopee,
      dAvulso: avulso - antAvulso,
      valorAnterior,
      valorNovo,
    };
  }, [correcao]);

  const salvarCorrecao = async () => {
    if (!correcao || !preview) return;
    const idParticipante = correcao.participante.id_participante;
    const versao = correcao.participante.versao;
    if (!idParticipante || !versao) {
      setErroCorrecao("Dados do lançamento incompletos. Atualize a lista.");
      return;
    }
    setSalvando(true);
    setErroCorrecao("");
    try {
      await corrigirQuantidadesParticipante(idParticipante, {
        shopee: preview.shopee,
        mercado_livre: preview.flex,
        avulso: preview.avulso,
        versao,
        origem_cliente: "mobile",
      });
      setCorrecao(null);
      await carregar();
    } catch (error) {
      setErroCorrecao(formatApiError(error, "Não foi possível salvar a correção."));
    } finally {
      setSalvando(false);
    }
  };

  const kpis: Array<{ key: ColetaStatusFiltro; valor: number; label: string; status: SituacaoBaseColeta["status"] }> = [
    { key: "pendente", valor: resumo.pendentes, label: "Pendentes", status: "pendente" },
    { key: "em_coleta", valor: resumo.em_coleta, label: "Em coleta", status: "em_coleta" },
    { key: "coletado", valor: resumo.coletadas, label: "Coletadas", status: "coletado" },
  ];

  const pickerValue = parseYmd(periodo.dataFim) ?? new Date();

  return (
    <View style={styles.screen}>
      <ScreenHeaderBar title="Consultar coletas" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void carregar()} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>Período</Text>
        <View style={styles.chipsRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, periodo.preset === p.key && styles.chipActive]}
              onPress={() => onSelectPreset(p.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: periodo.preset === p.key }}
            >
              <Text style={[styles.chipText, periodo.preset === p.key && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.periodoLabel}>{labelPeriodo(periodo)}</Text>

        <View style={styles.resumo}>
          {kpis.map((kpi) => {
            const c = situacaoColetaBadgeColors(kpi.status);
            const ativo = filtro === kpi.key;
            return (
              <Pressable
                key={kpi.key}
                style={[styles.kpi, { borderColor: c.border, backgroundColor: c.bg }, ativo && { borderWidth: 2 }]}
                onPress={() => setFiltro((atual) => (atual === kpi.key ? "todos" : kpi.key))}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar ${kpi.label}`}
              >
                <Text style={[styles.kpiValue, { color: c.fg }]}>{kpi.valor}</Text>
                <Text style={[styles.kpiLabel, { color: c.fg }]}>{kpi.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <ColetaServicoBadges
          shopee={totaisServico.shopee}
          mercadoLivre={totaisServico.mercadoLivre}
          avulso={totaisServico.avulso}
          total={totaisServico.total}
        />
        <View style={styles.filtros}>
          {([["todos", "Todas"], ["pendente", "Pendentes"], ["em_coleta", "Em coleta"], ["coletado", "Coletadas"]] as const).map(
            ([valor, label]) => (
              <Pressable key={valor} style={[styles.filtro, filtro === valor && styles.filtroAtivo]} onPress={() => setFiltro(valor)}>
                <Text style={[styles.filtroText, filtro === valor && styles.filtroTextAtivo]}>{label}</Text>
              </Pressable>
            )
          )}
        </View>
        {loading && itens.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
        {erro ? <Text style={styles.error}>{erro}</Text> : null}
        {!loading && !erro && visiveis.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>
              Nenhum{entidadeLabel === "Seller" ? "" : "a"} {entidadeLabelLower} neste status.
            </Text>
          </View>
        ) : null}
        {visiveis.map((item) => {
          const dataOp = dataItemColeta(item, periodo);
          const mostrarData = Boolean(dataOp) && (multiDia || periodo.preset !== "hoje");
          const podeRegistrar = podeRegistrarHoje(item, periodo);
          const pendente = isColetaPendente(item.status);
          const corrigiveis = (item.participantes || []).filter(
            (p) => p.pode_corrigir && podeCorrigirRole && dataOp === hojeOperacaoLocal()
          );
          const cardKey = `${item.base_id}-${dataOp || item.id_execucao || "x"}`;

          const cabecalho = (
            <>
              <View style={styles.row}>
                <Text style={styles.title}>{item.base}</Text>
                <ColetaSituacaoBadge status={item.status} />
              </View>
              {mostrarData ? <Text style={styles.muted}>Data: {formatDateLabel(dataOp)}</Text> : null}
              <Text style={styles.muted}>
                {item.participantes.length
                  ? item.participantes.map((p) => `${p.username}${p.status === "em_coleta" ? " (em coleta)" : ""}`).join(" • ")
                  : "Ninguém iniciou esta coleta"}
              </Text>
              <View style={{ marginTop: 10 }}>
                <ColetaServicoBadges
                  shopee={item.shopee}
                  mercadoLivre={item.mercado_livre}
                  avulso={item.avulso}
                  total={item.total}
                />
              </View>
            </>
          );

          return (
            <View key={cardKey} style={[styles.card, podeRegistrar && styles.cardPendente]}>
              {podeRegistrar ? (
                <Pressable
                  onPress={() => abrirLeitura(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Registrar coleta de ${item.base}`}
                >
                  {cabecalho}
                  <Text style={styles.atalho}>Toque para registrar nesta {entidadeLabelLower}</Text>
                </Pressable>
              ) : (
                <>
                  {cabecalho}
                  {pendente && !podeRegistrar ? (
                    <Text style={styles.muted}>Registro disponível apenas para o dia de hoje.</Text>
                  ) : null}
                </>
              )}
              {corrigiveis.map((p) => (
                <Pressable
                  key={p.id_participante || p.user_id}
                  style={styles.btnCorrigir}
                  onPress={() => abrirCorrecao(item, p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Corrigir quantidades de ${p.username}`}
                >
                  <Text style={styles.btnCorrigirText}>Corrigir quantidades · {p.username}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {showDatePicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeDate}
        />
      ) : null}

      <Modal visible={Boolean(correcao)} animationType="slide" transparent onRequestClose={() => !salvando && setCorrecao(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Corrigir quantidades</Text>
            {correcao ? (
              <Text style={styles.muted}>
                {correcao.item.base} · {correcao.participante.username} · {modoLabel(correcao.item.modo)}
              </Text>
            ) : null}
            <View>
              <Text style={styles.fieldLabelModal}>Flex</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={correcao?.flex ?? ""}
                onChangeText={(v) => setCorrecao((c) => (c ? { ...c, flex: v.replace(/[^\d]/g, "") } : c))}
              />
            </View>
            <View>
              <Text style={styles.fieldLabelModal}>Shopee</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={correcao?.shopee ?? ""}
                onChangeText={(v) => setCorrecao((c) => (c ? { ...c, shopee: v.replace(/[^\d]/g, "") } : c))}
              />
            </View>
            <View>
              <Text style={styles.fieldLabelModal}>Avulso</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={correcao?.avulso ?? ""}
                onChangeText={(v) => setCorrecao((c) => (c ? { ...c, avulso: v.replace(/[^\d]/g, "") } : c))}
              />
            </View>
            {preview ? (
              <View style={styles.preview}>
                <Text style={styles.previewText}>
                  Flex: {correcao?.participante.mercado_livre ?? 0} → {preview.flex} ({preview.dFlex >= 0 ? "+" : ""}
                  {preview.dFlex})
                </Text>
                <Text style={styles.previewText}>
                  Shopee: {correcao?.participante.shopee ?? 0} → {preview.shopee} ({preview.dShopee >= 0 ? "+" : ""}
                  {preview.dShopee})
                </Text>
                <Text style={styles.previewText}>
                  Avulso: {correcao?.participante.avulso ?? 0} → {preview.avulso} ({preview.dAvulso >= 0 ? "+" : ""}
                  {preview.dAvulso})
                </Text>
                <Text style={[styles.previewText, { marginTop: 6, fontWeight: "700" }]}>
                  Valor: {money(preview.valorAnterior)} → {money(preview.valorNovo)}
                </Text>
              </View>
            ) : null}
            {erroCorrecao ? <Text style={styles.error}>{erroCorrecao}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.btnGhost} disabled={salvando} onPress={() => setCorrecao(null)}>
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} disabled={salvando} onPress={() => void salvarCorrecao()}>
                {salvando ? <ActivityIndicator color={colors.primaryContrast} /> : <Text style={styles.btnPrimaryText}>Confirmar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
