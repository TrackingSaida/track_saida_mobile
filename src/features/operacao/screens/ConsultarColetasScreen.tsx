import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { formatApiError } from "../../../utils/formatApiError";
import { useAuthStore } from "../../../store/authStore";
import { ownerEntityLabel, ownerEntityLabelLower } from "../../../utils/ownerLabels";
import { isAdminOperadorRole, isAdminRole, permiteManualColeta } from "../../../utils/role";
import type { ColetasFluxoParamList } from "../../../navigation/staffStackTypes";
import { listarBasesAtivas } from "../basesApi";
import {
  carregarConsultaColetasPorPeriodo,
  complementarExecucoesComSituacaoHoje,
  consultarSituacaoColetas,
  corrigirQuantidadesParticipante,
  lancarColetaManualOperacional,
  type ParticipanteSituacaoColeta,
  type SituacaoBaseColeta,
  type SituacaoColetasResponse,
} from "../coletasApi";
import ColetaSituacaoBadge from "../components/ColetaSituacaoBadge";
import ColetaServicoBadges from "../components/ColetaServicoBadges";
import OperacaoFilterButton from "../components/OperacaoFilterButton";
import { OperacaoPeriodoFilterSheet } from "../components/OperacaoFilterSheet";
import {
  hojeOperacaoLocal,
  isColetaPendente,
  situacaoColetaBadgeColors,
  statusColetaNormalizado,
  type ColetaStatusFiltro,
} from "../utils/coletaSituacaoUi";
import { completarPendentesPeriodo, contarResumoColetas } from "../utils/pendentesPeriodoColeta";
import { formatDateLabel, formatYmd, isPeriodoDiaUnico } from "../utils/periodoConsulta";
import {
  buildColetaPeriodo,
  COLETA_PERIODO_PRESETS,
  labelColetaPeriodo,
  periodoPersonalizado,
  type ColetaPeriodo,
  type ColetaPeriodoPreset,
} from "../utils/periodoColetas";

type Filtro = "todos" | ColetaStatusFiltro | "a_coletar";
type ResumoAColetar = NonNullable<SituacaoColetasResponse["resumo"]["a_coletar"]>;

const LOGO_CANAL = {
  "Mercado Livre": require("../../../../assets/canais/mercado-livre.png"),
  Shopee: require("../../../../assets/canais/shopee.png"),
} as const;

function totalAColetar(item: SituacaoBaseColeta): number {
  return Number(item.a_coletar?.total || 0);
}

function resumoStatusDias(dias: SituacaoBaseColeta[]): string {
  const counts = { coletado: 0, em_coleta: 0, pendente: 0, sem_volume: 0 };
  dias.forEach((dia) => {
    counts[statusColetaNormalizado(dia.status)] += 1;
  });
  const rotulo: Record<keyof typeof counts, [string, string]> = {
    coletado: ["coletada", "coletadas"],
    em_coleta: ["em coleta", "em coleta"],
    pendente: ["pendente", "pendentes"],
    sem_volume: ["sem volume", "sem volume"],
  };
  return (["coletado", "em_coleta", "pendente", "sem_volume"] as const)
    .filter((key) => counts[key] > 0)
    .map((key) => `${counts[key]} ${counts[key] === 1 ? rotulo[key][0] : rotulo[key][1]}`)
    .join(" · ");
}

function fraseAColetar(item: SituacaoBaseColeta): string {
  const total = totalAColetar(item);
  if (!total) return "";
  if (item.status === "coletado") {
    return total === 1 ? "1 novo pedido após a coleta" : `${total} novos pedidos após a coleta`;
  }
  return total === 1 ? "1 pedido a coletar" : `${total} pedidos a coletar`;
}
type Nav = NativeStackNavigationProp<ColetasFluxoParamList, "ConsultarColetas">;

type CorrecaoCtx = {
  item: SituacaoBaseColeta;
  participante: ParticipanteSituacaoColeta;
  flex: string;
  shopee: string;
  avulso: string;
};

type ManualCtx = {
  item: SituacaoBaseColeta;
  flex: string;
  shopee: string;
  avulso: string;
};

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

function dataItemColeta(item: SituacaoBaseColeta, periodo: ColetaPeriodo): string {
  const raw = (item.data_operacao || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return isPeriodoDiaUnico(periodo) ? periodo.dataInicio : "";
}

function podeRegistrarHoje(item: SituacaoBaseColeta, periodo: ColetaPeriodo): boolean {
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
  const [periodo, setPeriodo] = useState<ColetaPeriodo>(() => buildColetaPeriodo("hoje"));
  const [draftPeriodo, setDraftPeriodo] = useState<ColetaPeriodo>(() => buildColetaPeriodo("hoje"));
  const [baseId, setBaseId] = useState<number | null>(null);
  const [draftBaseId, setDraftBaseId] = useState<number | null>(null);
  const [bordaData, setBordaData] = useState<"inicio" | "fim">("inicio");
  const [expandidas, setExpandidas] = useState<number[]>([]);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [itens, setItens] = useState<SituacaoBaseColeta[]>([]);
  const [resumo, setResumo] = useState({ pendentes: 0, em_coleta: 0, sem_volume: 0, coletadas: 0 });
  const [resumoAColetar, setResumoAColetar] = useState<ResumoAColetar | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [correcao, setCorrecao] = useState<CorrecaoCtx | null>(null);
  const [manual, setManual] = useState<ManualCtx | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroCorrecao, setErroCorrecao] = useState("");
  const [erroManual, setErroManual] = useState("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 40, gap: 12 },
        periodoLabel: { fontSize: 13, color: colors.textSecondary },
        resumo: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        kpi: {
          flexGrow: 1,
          flexBasis: "47%",
          minWidth: 140,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          backgroundColor: colors.backgroundCard,
        },
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
        title: { color: colors.text, fontWeight: "800", fontSize: 16, flexShrink: 1 },
        titleWrap: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
        contas: { flexDirection: "row", gap: 4 },
        contaLogo: { width: 18, height: 18, borderRadius: 4 },
        aColetarBanner: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#fcd34d",
          backgroundColor: "rgba(254,243,199,0.55)",
        },
        aColetarBannerAtivo: { borderWidth: 2, borderColor: "#d97706" },
        aColetarValor: { fontSize: 28, fontWeight: "900", color: "#b45309" },
        aColetarTitulo: { fontSize: 13, fontWeight: "800", color: "#92400e" },
        aColetarSub: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 3 },
        aColetarSubText: { fontSize: 12, color: "#92400e" },
        aColetarCanal: { flexDirection: "row", alignItems: "center", gap: 4 },
        aColetarLinha: { color: "#b45309", fontSize: 13, fontWeight: "700", marginTop: 7 },
        cardComPendencia: { borderColor: "#fcd34d", backgroundColor: "rgba(254,243,199,0.25)" },
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
        bordaBtn: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        bordaBtnAtiva: { borderColor: colors.primary },
        baseLista: { maxHeight: 180 },
        diaBloco: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
      }),
    [colors]
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const payload = await carregarConsultaColetasPorPeriodo(periodo.dataInicio, periodo.dataFim);
      const multi = periodo.dataInicio !== periodo.dataFim;
      const dia = hojeOperacaoLocal();
      let itensCarregados = payload.itens || [];
      if (multi && periodo.dataInicio <= dia && dia <= periodo.dataFim) {
        try {
          const situacaoHoje = await consultarSituacaoColetas(dia);
          itensCarregados = complementarExecucoesComSituacaoHoje(itensCarregados, situacaoHoje, dia);
        } catch {
          // O período continua visível; corrigir fica indisponível neste carregamento.
        }
      }
      if (multi && isAdminOperadorRole(currentUser?.role)) {
        const bases = await listarBasesAtivas();
        itensCarregados = completarPendentesPeriodo(
          itensCarregados,
          bases,
          periodo.dataInicio,
          periodo.dataFim,
          dia
        );
      }
      setItens(itensCarregados);
      setBaseId((atual) =>
        atual != null && itensCarregados.some((item) => item.base_id === atual) ? atual : null
      );
      const contagem = multi ? contarResumoColetas(itensCarregados) : null;
      setResumo({
        pendentes: contagem?.pendentes ?? payload.resumo?.pendentes ?? 0,
        em_coleta: contagem?.em_coleta ?? payload.resumo?.em_coleta ?? 0,
        sem_volume: contagem?.sem_volume ?? payload.resumo?.sem_volume ?? 0,
        coletadas: contagem?.coletadas ?? payload.resumo?.coletadas ?? 0,
      });
      const aColetar = multi ? null : (payload.resumo?.a_coletar ?? null);
      setResumoAColetar(aColetar);
      if (!aColetar) setFiltro((atual) => (atual === "a_coletar" ? "todos" : atual));
    } catch (error) {
      setErro(formatApiError(error, "Não foi possível consultar as coletas."));
    } finally {
      setLoading(false);
    }
  }, [currentUser?.role, periodo.dataFim, periodo.dataInicio]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const onSelectDraftPreset = (key: string) => {
    if (key === "personalizado") {
      setDraftPeriodo((atual) => ({ ...atual, preset: "personalizado" }));
      setBordaData("inicio");
      setShowDatePicker(true);
      return;
    }
    setShowDatePicker(false);
    setDraftPeriodo(buildColetaPeriodo(key as Exclude<ColetaPeriodoPreset, "personalizado">));
  };

  const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type === "dismissed") {
      if (Platform.OS === "ios") setShowDatePicker(false);
      return;
    }
    if (!selectedDate) return;
    const iso = formatYmd(selectedDate);
    setDraftPeriodo((atual) =>
      periodoPersonalizado(
        bordaData === "inicio" ? iso : atual.dataInicio,
        bordaData === "fim" ? iso : atual.dataFim
      )
    );
    if (Platform.OS === "ios") setShowDatePicker(false);
  };

  const aplicarPeriodo = () => {
    let inicio = draftPeriodo.dataInicio;
    let fim = draftPeriodo.dataFim;
    if (fim < inicio) [inicio, fim] = [fim, inicio];
    const proximo = { ...draftPeriodo, dataInicio: inicio, dataFim: fim };
    const mudou =
      proximo.preset !== periodo.preset ||
      proximo.dataInicio !== periodo.dataInicio ||
      proximo.dataFim !== periodo.dataFim ||
      draftBaseId !== baseId;
    setPeriodo(proximo);
    setBaseId(draftBaseId);
    setExpandidas([]);
    if (mudou) setFiltro("todos");
    setFilterSheetVisible(false);
    setShowDatePicker(false);
  };

  const multiDia = !isPeriodoDiaUnico(periodo);
  const visiveis = itens.filter((item) => {
    if (baseId != null && item.base_id !== baseId) return false;
    if (filtro === "todos") return true;
    if (filtro === "a_coletar") return totalAColetar(item) > 0;
    return statusColetaNormalizado(item.status) === filtro;
  });
  const grupos = useMemo(() => {
    if (!multiDia) return [];
    const mapa = new Map<number, { base_id: number; base: string; dias: SituacaoBaseColeta[] }>();
    visiveis.forEach((item) => {
      const atual = mapa.get(item.base_id);
      if (atual) atual.dias.push(item);
      else mapa.set(item.base_id, { base_id: item.base_id, base: item.base, dias: [item] });
    });
    return [...mapa.values()]
      .map((grupo) => ({
        ...grupo,
        dias: [...grupo.dias].sort((a, b) => String(b.data_operacao || "").localeCompare(String(a.data_operacao || ""))),
      }))
      .sort((a, b) => a.base.localeCompare(b.base, "pt-BR"));
  }, [multiDia, visiveis]);
  const basesFiltro = useMemo(() => {
    const vistas = new Map<number, string>();
    itens.forEach((item) => {
      if (!vistas.has(item.base_id)) vistas.set(item.base_id, item.base);
    });
    return [...vistas.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [itens]);
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

  const podeAtalhoManual = (item: SituacaoBaseColeta) => {
    if (!permiteManualColeta(currentUser) || !isColetaPendente(item.status) || item.id_execucao) return false;
    const data = dataItemColeta(item, periodo);
    const hoje = hojeOperacaoLocal();
    if (!data || data >= hoje) return false;
    return isAdminOperadorRole(currentUser?.role);
  };

  const abrirManual = (item: SituacaoBaseColeta) => {
    if (!podeAtalhoManual(item)) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErroManual("");
    setManual({ item, flex: "", shopee: "", avulso: "" });
  };

  const salvarManual = async () => {
    if (!manual) return;
    const flex = manual.flex.trim() === "" ? 0 : Number(manual.flex);
    const shopee = manual.shopee.trim() === "" ? 0 : Number(manual.shopee);
    const avulso = manual.avulso.trim() === "" ? 0 : Number(manual.avulso);
    if (![flex, shopee, avulso].every((n) => Number.isInteger(n) && n >= 0)) {
      setErroManual("Use apenas números inteiros a partir de zero.");
      return;
    }
    if (flex + shopee + avulso <= 0) {
      setErroManual("Informe a quantidade de Flex, Shopee ou Avulso.");
      return;
    }
    const data = dataItemColeta(manual.item, periodo);
    setSalvando(true);
    setErroManual("");
    try {
      await lancarColetaManualOperacional({
        base_id: manual.item.base_id,
        data_operacao: data,
        shopee,
        mercado_livre: flex,
        avulso,
        sem_volume: false,
        acrescentar: false,
        origem_cliente: "mobile",
      });
      setManual(null);
      await carregar();
    } catch (error) {
      setErroManual(formatApiError(error, "Não foi possível registrar a coleta."));
    } finally {
      setSalvando(false);
    }
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
    { key: "sem_volume", valor: resumo.sem_volume ?? 0, label: "Sem volume", status: "sem_volume" },
    { key: "coletado", valor: resumo.coletadas, label: "Coletadas", status: "coletado" },
  ];

  return (
    <View style={styles.screen}>
      <ScreenHeaderBar
        title="Consultar coletas"
        onBack={() => navigation.goBack()}
        rightElement={
          <OperacaoFilterButton
            activeCount={(periodo.preset !== "hoje" ? 1 : 0) + (baseId != null ? 1 : 0)}
            onPress={() => {
              setDraftPeriodo(periodo);
              setDraftBaseId(baseId);
              setFilterSheetVisible(true);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void carregar()} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.periodoLabel}>{labelColetaPeriodo(periodo)}</Text>

        {resumoAColetar ? (
          <Pressable
            style={[styles.aColetarBanner, filtro === "a_coletar" && styles.aColetarBannerAtivo]}
                onPress={() => {
                  setExpandidas([]);
                  setFiltro((atual) => (atual === "a_coletar" ? "todos" : "a_coletar"));
                }}
            accessibilityRole="button"
            accessibilityLabel={`${resumoAColetar.total} pedidos a coletar nos sellers. Toque para filtrar`}
          >
            <Text style={styles.aColetarValor}>{resumoAColetar.total}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aColetarTitulo}>A coletar nos sellers</Text>
              <View style={styles.aColetarSub}>
                {resumoAColetar.mercado_livre ? (
                  <View style={styles.aColetarCanal}>
                    <Image source={LOGO_CANAL["Mercado Livre"]} style={styles.contaLogo} />
                    <Text style={styles.aColetarSubText}>{resumoAColetar.mercado_livre}</Text>
                  </View>
                ) : null}
                {resumoAColetar.shopee ? (
                  <View style={styles.aColetarCanal}>
                    <Image source={LOGO_CANAL.Shopee} style={styles.contaLogo} />
                    <Text style={styles.aColetarSubText}>{resumoAColetar.shopee}</Text>
                  </View>
                ) : null}
                <Text style={styles.aColetarSubText}>
                  {resumoAColetar.sellers
                    ? `em ${resumoAColetar.sellers} ${resumoAColetar.sellers === 1 ? "seller" : "sellers"}`
                    : "nenhum pedido aguardando coleta"}
                </Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.resumo}>
          {kpis.map((kpi) => {
            const c = situacaoColetaBadgeColors(kpi.status);
            const ativo = filtro === kpi.key;
            return (
              <Pressable
                key={kpi.key}
                style={[styles.kpi, { borderColor: c.border, backgroundColor: c.bg }, ativo && { borderWidth: 2 }]}
                onPress={() => {
                  setExpandidas([]);
                  setFiltro((atual) => (atual === kpi.key ? "todos" : kpi.key));
                }}
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
          {          (
            [
              ["todos", "Todas"],
              ...(resumoAColetar ? ([["a_coletar", "A coletar"]] as const) : []),
              ["pendente", "Pendentes"],
              ["em_coleta", "Em coleta"],
              ["sem_volume", "Sem volume"],
              ["coletado", "Coletadas"],
            ] as ReadonlyArray<readonly [Filtro, string]>
          ).map(([valor, label]) => (
              <Pressable
                key={valor}
                style={[styles.filtro, filtro === valor && styles.filtroAtivo]}
                onPress={() => {
                  setExpandidas([]);
                  setFiltro(valor);
                }}
              >
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
        {multiDia
          ? grupos.map((grupo) => {
              const aberto = expandidas.includes(grupo.base_id);
              const statusUnico = new Set(grupo.dias.map((dia) => statusColetaNormalizado(dia.status))).size === 1;
              const soma = grupo.dias.reduce(
                (acc, dia) => ({
                  shopee: acc.shopee + (dia.shopee || 0),
                  mercadoLivre: acc.mercadoLivre + (dia.mercado_livre || 0),
                  avulso: acc.avulso + (dia.avulso || 0),
                  total: acc.total + (dia.total || 0),
                }),
                { shopee: 0, mercadoLivre: 0, avulso: 0, total: 0 }
              );
              return (
                <View key={grupo.base_id} style={styles.card}>
                  <Pressable
                    onPress={() =>
                      setExpandidas((atual) =>
                        atual.includes(grupo.base_id) ? atual.filter((id) => id !== grupo.base_id) : [...atual, grupo.base_id]
                      )
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded: aberto }}
                    accessibilityLabel={`Ver dias de ${grupo.base}`}
                  >
                    <View style={styles.row}>
                      <View style={styles.titleWrap}>
                        <Ionicons name={aberto ? "chevron-down" : "chevron-forward"} size={18} color={colors.textSecondary} />
                        <Text style={styles.title}>{grupo.base}</Text>
                      </View>
                      {statusUnico ? <ColetaSituacaoBadge status={grupo.dias[0].status} /> : null}
                    </View>
                    {statusUnico ? null : <Text style={styles.muted}>{resumoStatusDias(grupo.dias)}</Text>}
                    <View style={{ marginTop: 10 }}>
                      <ColetaServicoBadges
                        shopee={soma.shopee}
                        mercadoLivre={soma.mercadoLivre}
                        avulso={soma.avulso}
                        total={soma.total}
                      />
                    </View>
                  </Pressable>
                  {aberto
                    ? grupo.dias.map((item) => {
                        const dataOp = dataItemColeta(item, periodo);
                        const corrigiveis = (item.participantes || []).filter(
                          (p) => p.pode_corrigir && podeCorrigirRole && dataOp === hojeOperacaoLocal()
                        );
                        return (
                          <View key={`${item.base_id}-${dataOp || item.id_execucao || "x"}`} style={styles.diaBloco}>
                            <View style={styles.row}>
                              <Text style={styles.title}>{dataOp ? formatDateLabel(dataOp) : "Dia"}</Text>
                              <ColetaSituacaoBadge status={item.status} />
                            </View>
                            {item.status === "sem_volume" ? (
                              <Text style={styles.muted}>Confirmado: não houve coleta neste dia</Text>
                            ) : null}
                            <Text style={styles.muted}>
                              {item.participantes.length
                                ? item.participantes
                                    .map((p) => {
                                      if (p.status === "em_coleta") return `${p.username} (em coleta)`;
                                      if (p.sem_volume) return `${p.username} (sem volume)`;
                                      return p.username;
                                    })
                                    .join(" • ")
                                : "Ninguém iniciou esta coleta"}
                            </Text>
                            <Text style={styles.muted}>{modoLabel(item.modo)}</Text>
                            <View style={{ marginTop: 10 }}>
                              <ColetaServicoBadges
                                shopee={item.shopee}
                                mercadoLivre={item.mercado_livre}
                                avulso={item.avulso}
                                total={item.total}
                              />
                            </View>
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
                            {dataOp === hojeOperacaoLocal() && isColetaPendente(item.status) && !item.id_execucao ? (
                              <Pressable
                                style={styles.btnCorrigir}
                                onPress={() => abrirLeitura(item)}
                                accessibilityRole="button"
                                accessibilityLabel={`Registrar coleta de ${grupo.base} em ${formatDateLabel(dataOp)}`}
                              >
                                <Text style={styles.btnCorrigirText}>Registrar coleta</Text>
                              </Pressable>
                            ) : null}
                            {podeAtalhoManual(item) ? (
                              <Pressable
                                style={styles.btnCorrigir}
                                onPress={() => abrirManual(item)}
                                accessibilityRole="button"
                                accessibilityLabel={`Registrar coleta de ${grupo.base} em ${formatDateLabel(dataOp)}`}
                              >
                                <Text style={styles.btnCorrigirText}>Registrar coleta</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        );
                      })
                    : null}
                </View>
              );
            })
          : null}
        {!multiDia && visiveis.map((item) => {
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
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{item.base}</Text>
                  {item.contas?.length ? (
                    <View style={styles.contas}>
                      {item.contas
                        .filter((c) => LOGO_CANAL[c.canal])
                        .map((c) => (
                          <Image
                            key={`${c.canal}-${c.conta ?? ""}`}
                            source={LOGO_CANAL[c.canal]}
                            style={styles.contaLogo}
                            accessibilityLabel={`Conta ${c.canal} conectada${c.conta ? `: ${c.conta}` : ""}`}
                          />
                        ))}
                    </View>
                  ) : null}
                </View>
                <ColetaSituacaoBadge status={item.status} />
              </View>
              {fraseAColetar(item) ? <Text style={styles.aColetarLinha}>{fraseAColetar(item)}</Text> : null}
              {mostrarData ? <Text style={styles.muted}>Data: {formatDateLabel(dataOp)}</Text> : null}
              {item.status === "sem_volume" ? (
                <Text style={styles.muted}>Confirmado: não houve coleta neste dia</Text>
              ) : null}
              <Text style={styles.muted}>
                {item.participantes.length
                  ? item.participantes
                      .map((p) => {
                        if (p.status === "em_coleta") return `${p.username} (em coleta)`;
                        if (p.sem_volume) return `${p.username} (sem volume)`;
                        return p.username;
                      })
                      .join(" • ")
                  : item.status === "sem_volume"
                    ? "Marcado como sem volume"
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
            <View
              key={cardKey}
              style={[styles.card, podeRegistrar && styles.cardPendente, totalAColetar(item) > 0 && styles.cardComPendencia]}
            >
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
                    podeAtalhoManual(item) ? (
                      <Pressable
                        style={styles.btnCorrigir}
                        onPress={() => abrirManual(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Registrar coleta de ${item.base} em ${formatDateLabel(dataOp)}`}
                      >
                        <Text style={styles.btnCorrigirText}>Registrar coleta</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.muted}>Registro disponível apenas para o dia de hoje.</Text>
                    )
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

      <OperacaoPeriodoFilterSheet
        visible={filterSheetVisible}
        draft={draftPeriodo}
        presets={COLETA_PERIODO_PRESETS}
        showDatePicker={showDatePicker}
        pickerDate={bordaData === "fim" ? draftPeriodo.dataFim : draftPeriodo.dataInicio}
        allowFuture
        extra={
          <View>
            <Text style={styles.fieldLabelModal}>Início e fim</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <Pressable
                style={[styles.bordaBtn, bordaData === "inicio" && showDatePicker && styles.bordaBtnAtiva]}
                onPress={() => {
                  setBordaData("inicio");
                  setShowDatePicker(true);
                  setDraftPeriodo((atual) => ({ ...atual, preset: "personalizado" }));
                }}
                accessibilityRole="button"
                accessibilityLabel="Escolher data inicial"
              >
                <Text style={styles.fieldLabelModal}>Início</Text>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{formatDateLabel(draftPeriodo.dataInicio)}</Text>
              </Pressable>
              <Pressable
                style={[styles.bordaBtn, bordaData === "fim" && showDatePicker && styles.bordaBtnAtiva]}
                onPress={() => {
                  setBordaData("fim");
                  setShowDatePicker(true);
                  setDraftPeriodo((atual) => ({ ...atual, preset: "personalizado" }));
                }}
                accessibilityRole="button"
                accessibilityLabel="Escolher data final"
              >
                <Text style={styles.fieldLabelModal}>Fim</Text>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{formatDateLabel(draftPeriodo.dataFim)}</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabelModal}>Base</Text>
            <ScrollView style={styles.baseLista} nestedScrollEnabled>
              <View style={styles.filtros}>
                <Pressable
                  style={[styles.filtro, draftBaseId == null && styles.filtroAtivo]}
                  onPress={() => setDraftBaseId(null)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draftBaseId == null }}
                >
                  <Text style={[styles.filtroText, draftBaseId == null && styles.filtroTextAtivo]}>Todas</Text>
                </Pressable>
                {basesFiltro.map((base) => (
                  <Pressable
                    key={base.id}
                    style={[styles.filtro, draftBaseId === base.id && styles.filtroAtivo]}
                    onPress={() => setDraftBaseId(base.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draftBaseId === base.id }}
                  >
                    <Text style={[styles.filtroText, draftBaseId === base.id && styles.filtroTextAtivo]}>{base.nome}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        }
        onClose={() => {
          setFilterSheetVisible(false);
          setShowDatePicker(false);
        }}
        onClear={() => {
          setDraftPeriodo(buildColetaPeriodo("hoje"));
          setDraftBaseId(null);
          setShowDatePicker(false);
        }}
        onApply={aplicarPeriodo}
        onSelectPreset={() => undefined}
        onSelectPresetKey={onSelectDraftPreset}
        onDateChange={onChangeDate}
      />

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

      <Modal visible={Boolean(manual)} animationType="slide" transparent onRequestClose={() => !salvando && setManual(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar coleta</Text>
            {manual ? (
              <Text style={styles.muted}>
                {manual.item.base} · {formatDateLabel(dataItemColeta(manual.item, periodo))}
              </Text>
            ) : null}
            <Text style={styles.muted}>A coleta manual fica neste dia e nesta base.</Text>
            <View>
              <Text style={styles.fieldLabelModal}>Flex</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={manual?.flex ?? ""}
                onChangeText={(v) => setManual((c) => (c ? { ...c, flex: v.replace(/[^\d]/g, "") } : c))}
                accessibilityLabel="Quantidade Flex"
              />
            </View>
            <View>
              <Text style={styles.fieldLabelModal}>Shopee</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={manual?.shopee ?? ""}
                onChangeText={(v) => setManual((c) => (c ? { ...c, shopee: v.replace(/[^\d]/g, "") } : c))}
                accessibilityLabel="Quantidade Shopee"
              />
            </View>
            <View>
              <Text style={styles.fieldLabelModal}>Avulso</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={manual?.avulso ?? ""}
                onChangeText={(v) => setManual((c) => (c ? { ...c, avulso: v.replace(/[^\d]/g, "") } : c))}
                accessibilityLabel="Quantidade Avulso"
              />
            </View>
            {erroManual ? <Text style={styles.error}>{erroManual}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.btnGhost} disabled={salvando} onPress={() => setManual(null)}>
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} disabled={salvando} onPress={() => void salvarManual()}>
                {salvando ? <ActivityIndicator color={colors.primaryContrast} /> : <Text style={styles.btnPrimaryText}>Registrar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
