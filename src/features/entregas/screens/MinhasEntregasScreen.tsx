import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import EntregaCodigoHeader from "../components/EntregaCodigoHeader";
import { useScannerTorch } from "../hooks/useScannerTorch";
import ScannerTorchButton from "../components/ScannerTorchButton";
import { getExtratoFinanceiro, getTodayISO } from "../api";
import type { ExtratoFinanceiro, ExtratoPedidoItem, ExtratoStatusFiltro } from "../types";
import { formatCurrencyBRL } from "../utils/currency";
import {
  filterExtratoByServicos,
  normalizeExtratoServico,
  type ServicoExtrato,
} from "../utils/extratoFilter";
import {
  findExtratoItemByScan,
  flattenExtratoItens,
  getDiaValorDisplay,
  searchExtratoByCodigo,
} from "../utils/extratoSearch";
import { formatarDiaParaExibicao, getQuinzenaAtualIntervalo } from "../utils/quinzena";
import type { MaisStackParamList } from "../../../screens/MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "MinhasEntregas">;

const SERVICOS: ServicoExtrato[] = ["Shopee", "Flex", "Avulso"];

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateBR(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return "--/--/----";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${parsed.getFullYear()}`;
}

function formatRealStatus(status: string, fallback: string): string {
  const raw = String(status || "").trim();
  if (!raw) return fallback;
  const normalized = raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
  if (!normalized) return fallback;
  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function MinhasEntregasScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const compactHeader = windowWidth < 360;
  const colors = useThemeColors();
  const quinzena = useMemo(() => getQuinzenaAtualIntervalo(), []);
  const scanLockedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { justifyContent: "center", alignItems: "center" },
        headerFilterButton: {
          minHeight: 36,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        headerFilterButtonText: { fontSize: 13, fontWeight: "700", color: colors.text },
        content: { paddingHorizontal: 16 },
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
        searchRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
        },
        searchInput: {
          flex: 1,
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
        },
        searchIconBtn: {
          minWidth: 110,
          height: 42,
          borderRadius: 10,
          backgroundColor: colors.primary,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        searchIconBtnText: {
          color: colors.primaryContrast,
          fontSize: 14,
          fontWeight: "700",
        },
        searchResultsWrap: {
          marginHorizontal: 16,
          marginBottom: 8,
          maxHeight: 170,
          borderWidth: 1,
          borderColor: colors.separator,
          borderRadius: 10,
          backgroundColor: colors.backgroundCard,
        },
        searchResultItem: {
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        searchResultCodigo: { fontSize: 14, fontWeight: "700", color: colors.text },
        searchResultCliente: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        listContent: { paddingHorizontal: 16, paddingBottom: 42 },
        dayCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 12,
          marginBottom: 8,
        },
        dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        dayTitle: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1, marginRight: 8 },
        dayBadgesRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
        dayTotalBadge: {
          borderRadius: 999,
          backgroundColor: colors.primary,
          paddingVertical: 4,
          paddingHorizontal: 10,
        },
        dayValorBadge: {
          borderRadius: 999,
          backgroundColor: colors.success,
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
        dateField: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.separator,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          backgroundColor: colors.background,
        },
        dateFieldLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
        dateFieldValue: { color: colors.text, fontSize: 16, fontWeight: "600" },
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
          justifyContent: "flex-start",
        },
        modalSheet: {
          backgroundColor: colors.background,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          paddingHorizontal: 16,
          paddingTop: 10,
          marginHorizontal: 12,
        },
        modalHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        },
        modalTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
        closeBtn: { padding: 6 },
        scannerHeader: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          paddingHorizontal: 16,
          backgroundColor: "rgba(0,0,0,0.35)",
        },
        scannerClose: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
        scannerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
        scannerSubtitle: { color: "#d5e6ff", fontSize: 13, marginTop: 2, marginBottom: 10 },
        scannerFooter: {
          position: "absolute",
          left: 16,
          right: 16,
          zIndex: 2,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: "rgba(0,0,0,0.4)",
        },
        scannerFooterText: { color: "#fff", fontSize: 13, textAlign: "center" as const },
      }),
    [colors]
  );
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState(quinzena.inicio);
  const [dataFim, setDataFim] = useState(quinzena.fim);
  const [statusFiltro, setStatusFiltro] = useState<ExtratoStatusFiltro>("grupo_entregue");
  const [extrato, setExtrato] = useState<ExtratoFinanceiro | null>(null);
  const [showFiltros, setShowFiltros] = useState(false);
  const [pickerCampoAtivo, setPickerCampoAtivo] = useState<"inicio" | "fim" | null>(null);
  const [pickerData, setPickerData] = useState<Date>(parseIsoDate(quinzena.inicio) ?? new Date());
  const [expandedByDay, setExpandedByDay] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const torch = useScannerTorch(scannerVisible && !!cameraPermission?.granted);
  const [servicosFiltroAtivos, setServicosFiltroAtivos] = useState<Set<ServicoExtrato>>(new Set());
  const [servicosFiltroDraft, setServicosFiltroDraft] = useState<Set<ServicoExtrato>>(new Set());

  const extratoFiltrado = useMemo(
    () => (extrato ? filterExtratoByServicos(extrato, servicosFiltroAtivos) : null),
    [extrato, servicosFiltroAtivos]
  );

  const itensFlat = useMemo(() => flattenExtratoItens(extratoFiltrado), [extratoFiltrado]);

  const searchResults = useMemo(
    () => searchExtratoByCodigo(itensFlat, searchQuery),
    [itensFlat, searchQuery]
  );

  const extratoDataById = useMemo(() => {
    const map = new Map<number, string>();
    extratoFiltrado?.dias.forEach((dia) => {
      dia.itens.forEach((it) => map.set(it.id_saida, dia.data));
    });
    return map;
  }, [extratoFiltrado]);

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

  useEffect(() => {
    if (!route.params?.presetPeriodoHoje) return;
    const hoje = getTodayISO();
    setDataInicio(hoje);
    setDataFim(hoje);
    void load({ dataInicio: hoje, dataFim: hoje, statusFiltro: "grupo_entregue" });
    navigation.setParams({ presetPeriodoHoje: undefined });
  }, [route.params?.presetPeriodoHoje, load, navigation]);

  const abrirPicker = useCallback((campo: "inicio" | "fim") => {
    const valorAtual = campo === "inicio" ? dataInicio : dataFim;
    setPickerData(parseIsoDate(valorAtual) ?? new Date());
    setPickerCampoAtivo(campo);
  }, [dataFim, dataInicio]);

  const onChangeData = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === "dismissed") {
      if (Platform.OS === "android") {
        setPickerCampoAtivo(null);
      }
      return;
    }
    if (!selectedDate || !pickerCampoAtivo) return;
    const iso = toIsoDate(selectedDate);
    if (pickerCampoAtivo === "inicio") {
      setDataInicio(iso);
    } else {
      setDataFim(iso);
    }
    setPickerData(selectedDate);
    if (Platform.OS === "android") {
      setPickerCampoAtivo(null);
    }
  }, [pickerCampoAtivo]);

  const abrirFiltros = useCallback(() => {
    setServicosFiltroDraft(new Set(servicosFiltroAtivos));
    setShowFiltros(true);
  }, [servicosFiltroAtivos]);

  const toggleServicoDraft = useCallback((servico: ServicoExtrato) => {
    setServicosFiltroDraft((prev) => {
      const next = new Set(prev);
      if (next.has(servico)) next.delete(servico);
      else next.add(servico);
      return next;
    });
  }, []);

  const handleAplicar = useCallback(() => {
    const inicio = parseIsoDate(dataInicio);
    const fim = parseIsoDate(dataFim);
    if (!inicio || !fim) {
      Alert.alert("Data inválida", "Selecione uma data inicial e final válidas.");
      return;
    }
    if (inicio.getTime() > fim.getTime()) {
      Alert.alert("Período inválido", "A data inicial não pode ser maior que a data final.");
      return;
    }
    setPickerCampoAtivo(null);
    setServicosFiltroAtivos(new Set(servicosFiltroDraft));
    setShowFiltros(false);
    void load();
  }, [dataFim, dataInicio, load, servicosFiltroDraft]);

  const toggleDia = useCallback((dia: string) => {
    setExpandedByDay((prev) => ({ ...prev, [dia]: !prev[dia] }));
  }, []);

  const abrirDetalhe = useCallback(
    (item: ExtratoPedidoItem) => {
      navigation.navigate("EntregaDetail", { idSaida: item.id_saida });
      setSearchQuery("");
    },
    [navigation]
  );

  const processarBuscaOuScan = useCallback(
    (raw: string) => {
      const found = findExtratoItemByScan(itensFlat, raw);
      if (!found) {
        Alert.alert("Não encontrado", "Nenhum pedido no período corresponde a este código.");
        return;
      }
      abrirDetalhe(found);
    },
    [abrirDetalhe, itensFlat]
  );

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult) => {
      if (scanLockedRef.current) return;
      const data = String(event.data ?? "").trim();
      if (!data) return;
      scanLockedRef.current = true;
      setScannerVisible(false);
      processarBuscaOuScan(data);
      setTimeout(() => {
        scanLockedRef.current = false;
      }, 500);
    },
    [processarBuscaOuScan]
  );

  const openScanner = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert("Permissão", "Permita acesso à câmera para escanear.");
        return;
      }
    }
    scanLockedRef.current = false;
    setScannerVisible(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const serviceBadgeStyle = useCallback(
    (servico: ServicoExtrato) => {
      if (servico === "Shopee") return { bg: "rgba(238,77,45,0.16)", fg: "#ee4d2d" };
      if (servico === "Flex") return { bg: "rgba(255,224,102,0.28)", fg: "#6a5a00" };
      return { bg: "rgba(99,102,241,0.16)", fg: "#6366f1" };
    },
    []
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Minhas Entregas"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
        rightElement={
          <TouchableOpacity
            style={styles.headerFilterButton}
            onPress={abrirFiltros}
            accessibilityLabel="Filtros"
          >
            <Ionicons name="filter-outline" size={16} color={colors.text} />
            {!compactHeader ? <Text style={styles.headerFilterButtonText}>Filtro</Text> : null}
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.topBarRow}>
            <View style={styles.topCard}>
              <Text style={styles.topLabel}>Valor total</Text>
              <Text style={styles.topValue}>
                {formatCurrencyBRL(extratoFiltrado?.valor_a_receber ?? "0")}
              </Text>
            </View>
            <View style={styles.topCard}>
              <Text style={styles.topLabel}>Total de pedidos</Text>
              <Text style={styles.topValue}>{extratoFiltrado?.total_pacotes_filtrados ?? 0}</Text>
            </View>
          </View>
          <Text style={styles.topPeriod}>
            Período: {extratoFiltrado?.periodo_inicio ?? dataInicio} até{" "}
            {extratoFiltrado?.periodo_fim ?? dataFim}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar código"
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (searchResults.length === 1) abrirDetalhe(searchResults[0]);
            else if (searchQuery.trim()) processarBuscaOuScan(searchQuery);
          }}
        />
        <TouchableOpacity style={styles.searchIconBtn} onPress={() => void openScanner()}>
          <Ionicons name="scan-outline" size={22} color={colors.primaryContrast} />
          <Text style={styles.searchIconBtnText}>Escanear</Text>
        </TouchableOpacity>
      </View>

      {searchQuery.trim().length > 0 ? (
        <View style={styles.searchResultsWrap}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => `search-${item.id_saida}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.searchResultItem}>
                <Text style={styles.searchResultCliente}>
                  Nenhum pedido encontrado com esse trecho.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.searchResultItem} onPress={() => abrirDetalhe(item)}>
                <EntregaCodigoHeader
                  codigo={item.codigo}
                  servico={item.servico}
                  exibicao={formatRealStatus(item.status, item.exibicao)}
                  data={extratoDataById.get(item.id_saida)}
                  compact
                />
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      <FlatList
        data={extratoFiltrado?.dias ?? []}
        keyExtractor={(item) => item.data}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Sem dados no período selecionado.</Text>}
        renderItem={({ item }) => {
          const expanded = !!expandedByDay[item.data];
          const byServico = { Shopee: 0, Flex: 0, Avulso: 0 };
          item.itens.forEach((it) => {
            const t = normalizeExtratoServico(it.servico);
            byServico[t] += 1;
          });

          return (
            <View style={styles.dayCard}>
              <TouchableOpacity style={styles.dayHeader} onPress={() => toggleDia(item.data)} activeOpacity={0.8}>
                <Text style={styles.dayTitle}>{formatarDiaParaExibicao(item.data)}</Text>
                <View style={styles.dayBadgesRow}>
                  <View style={styles.dayValorBadge}>
                    <Text style={styles.dayTotalText}>
                      {formatCurrencyBRL(getDiaValorDisplay(item))}
                    </Text>
                  </View>
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
                {SERVICOS.map((serv) => {
                  if (byServico[serv] === 0) return null;
                  const c = serviceBadgeStyle(serv);
                  return (
                    <View key={`${item.data}-${serv}`} style={[styles.serviceBadge, { backgroundColor: c.bg }]}>
                      <Text style={[styles.serviceBadgeText, { color: c.fg }]}>
                        {serv}: {byServico[serv]}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {expanded ? (
                <View style={styles.itensWrap}>
                  {item.itens.map((it) => {
                    const statusReal = formatRealStatus(it.status, it.exibicao);
                    return (
                      <TouchableOpacity
                        key={`${item.data}-${it.id_saida}`}
                        style={styles.itemRow}
                        activeOpacity={0.7}
                        onPress={() => abrirDetalhe(it)}
                      >
                        <EntregaCodigoHeader
                          codigo={it.codigo}
                          servico={it.servico}
                          exibicao={statusReal}
                          data={item.data}
                          compact
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <Modal visible={scannerVisible} transparent={false} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={[styles.scannerHeader, { paddingTop: Math.max(14, insets.top), paddingBottom: 10 }]}>
            <TouchableOpacity onPress={() => setScannerVisible(false)}>
              <Text style={styles.scannerClose}>← Fechar</Text>
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Escanear pedido</Text>
            <Text style={styles.scannerSubtitle}>Aponte para o QR Code da etiqueta</Text>
          </View>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            enableTorch={torch.enableTorch}
            onCameraReady={torch.onCameraReady}
            onBarcodeScanned={scanLockedRef.current ? undefined : handleBarcodeScanned}
          />
          <ScannerTorchButton
            mode={torch.mode}
            onPress={torch.cycleMode}
            style={{ top: insets.top + 72, right: 16 }}
          />
          <View style={[styles.scannerFooter, { bottom: Math.max(14, insets.bottom) }]}>
            <Text style={styles.scannerFooterText}>Busca pedidos do período carregado</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={showFiltros} transparent animationType="slide" onRequestClose={() => setShowFiltros(false)}>
        <Pressable style={[styles.modalOverlay, { paddingTop: Math.max(10, insets.top + 6) }]} onPress={() => setShowFiltros(false)}>
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
              <Text style={styles.filterLabel}>Período</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity style={styles.dateField} activeOpacity={0.8} onPress={() => abrirPicker("inicio")}>
                  <Text style={styles.dateFieldLabel}>Data inicial</Text>
                  <Text style={styles.dateFieldValue}>{formatDateBR(dataInicio)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateField} activeOpacity={0.8} onPress={() => abrirPicker("fim")}>
                  <Text style={styles.dateFieldLabel}>Data final</Text>
                  <Text style={styles.dateFieldValue}>{formatDateBR(dataFim)}</Text>
                </TouchableOpacity>
              </View>
              {pickerCampoAtivo ? (
                <View style={{ marginBottom: 10 }}>
                  <DateTimePicker
                    value={pickerData}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onChangeData}
                  />
                  {Platform.OS === "ios" ? (
                    <TouchableOpacity
                      style={[styles.chip, { marginTop: 6, borderWidth: 1, borderColor: colors.border }]}
                      onPress={() => setPickerCampoAtivo(null)}
                    >
                      <Text style={styles.chipText}>Concluir data</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
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
              <View style={[styles.actionsRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.chip, statusFiltro === "cancelados" && styles.chipActive]}
                  onPress={() => setStatusFiltro("cancelados")}
                >
                  <Text style={[styles.chipText, statusFiltro === "cancelados" && styles.chipTextActive]}>
                    Cancelados
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.filterLabel, { marginTop: 12 }]}>Serviço</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Nenhum selecionado = todos. Selecione um ou mais para filtrar.
              </Text>
              <View style={styles.actionsRow}>
                {SERVICOS.map((serv) => (
                  <TouchableOpacity
                    key={serv}
                    style={[styles.chip, servicosFiltroDraft.has(serv) && styles.chipActive]}
                    onPress={() => toggleServicoDraft(serv)}
                  >
                    <Text style={[styles.chipText, servicosFiltroDraft.has(serv) && styles.chipTextActive]}>
                      {serv}
                    </Text>
                  </TouchableOpacity>
                ))}
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
