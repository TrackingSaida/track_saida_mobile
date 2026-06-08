import React, { useCallback, useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import { fetchFinalizadasFiltradas, getEntregas, getTodayISO } from "../api";
import {
  FINALIZADAS_FILTROS_PADRAO,
  FINALIZAR_LOTE_MAX_IDS,
  type EntregasListInitialTab,
  type FinalizadasFiltros,
} from "../types";
import type { EntregaListItem, FinalizarLoteBloqueadoOut } from "../types";
import BatchSelectionBar, { BATCH_SELECTION_LIST_PADDING } from "../components/BatchSelectionBar";
import BatchAusenteConfirmModal from "../components/BatchAusenteConfirmModal";
import BatchFinalizeResultModal from "../components/BatchFinalizeResultModal";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { geocodeDelivery, isValidGeocodeCoords, resolveGeocodeDefaults, type GeocodeResult } from "../utils/geocode";
import {
  buildPendingMapGroups,
  countPendingMapStats,
  resolveDeliveryCoords,
  spreadOverlappingStopCoords,
  type GroupedStop,
  type PendingMapGroupPoint,
} from "../utils/routeUtils";
import { clusterMapPoints } from "../utils/mapClusterUtils";
import MapLocateButton from "../../../components/MapLocateButton";
import PendingMapMarker, { PendingMapClusterMarker } from "../components/PendingMapMarker";
import PendingMapGroupSheet, { confirmCreateRouteFromGroup } from "../components/PendingMapGroupSheet";
import RouteEditAddressSheet from "../components/RouteEditAddressSheet";
import type { AddressFormValues } from "../components/AddressForm";
import { formatApiError } from "../../../utils/formatApiError";
import { SERVICO_ORDER, servicoTipo, type ServicoTipo } from "../utils/servico";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { useThemeStore } from "../../../store/themeStore";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import { ScanFrameOverlay } from "../../operacao/components/ScanFrameOverlay";
import { getIdsInActiveRoute } from "../utils/routeActiveSync";
import { runPostFinalizeFeedback } from "../utils/finalizeEntregaFeedback";
import {
  getDestinationLabel,
  openNavigationToStop,
  resolveNavigationTarget,
} from "../utils/externalNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "EntregasList">;

type Tab = "pendente" | "finalizadas" | "ausentes";

const TAB_LABELS: Record<Tab, string> = {
  pendente: "Pendentes",
  finalizadas: "Finalizadas",
  ausentes: "Ausentes",
};

const TAB_ORDER: Tab[] = ["pendente", "ausentes", "finalizadas"];
const SERVICO_COLORS: Record<string, string> = {
  Shopee: "#ee4d2d",
  Flex: "#ffe066",
  Avulso: "#6366f1",
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const LOCATE_ZOOM_DELTA = 0.008;
const MAP_LOCATE_BOTTOM_INSET = 72;
const GEOCODE_BATCH_SIZE = 8;

const defaultExpanded: Record<string, boolean> = { Shopee: false, Flex: false, Avulso: false };

const DEFAULT_REGION = { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.05, longitudeDelta: 0.05 };
type ServiceSection = { section: ServicoTipo; data: EntregaListItem[] };

export default function EntregasListScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.theme);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          padding: 16,
          backgroundColor: colors.backgroundCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        backText: { fontSize: 16, color: colors.primary, marginBottom: 8 },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        tabs: {
          flexDirection: "row",
          backgroundColor: colors.backgroundCard,
          paddingHorizontal: 8,
          paddingVertical: 8,
        },
        tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
        tabActive: { backgroundColor: colors.primary },
        tabText: { fontSize: 14, color: colors.textSecondary },
        tabTextActive: { color: colors.primaryContrast, fontWeight: "600" },
        btnSugerirRota: {
          marginHorizontal: 16,
          marginBottom: 8,
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: colors.success,
          alignItems: "center",
        },
        btnSugerirRotaText: { color: colors.primaryContrast, fontSize: 15, fontWeight: "600" },
        activeRouteBanner: {
          marginHorizontal: 16,
          marginTop: 8,
          padding: 12,
          borderRadius: 10,
          backgroundColor: hexToRgba(colors.primary, 0.1),
          borderWidth: 1,
          borderColor: hexToRgba(colors.primary, 0.25),
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        activeRouteBannerText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: "600" },
        activeRouteBannerBtn: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: colors.primary,
        },
        activeRouteBannerBtnText: { color: colors.primaryContrast, fontSize: 13, fontWeight: "700" },
        toggleRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
        filterRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 4, gap: 8 },
        searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
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
          width: 42,
          height: 42,
          borderRadius: 10,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        searchResultsWrap: {
          marginHorizontal: 16,
          marginTop: 8,
          maxHeight: 170,
          borderWidth: 1,
          borderColor: colors.separator,
          borderRadius: 10,
          backgroundColor: colors.backgroundCard,
        },
        searchResultItem: {
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        searchResultCodigo: { fontSize: 14, fontWeight: "700", color: colors.text },
        searchResultCliente: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        imageViewerOverlay: { flex: 1, backgroundColor: "#000" },
        cameraOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.25)",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        },
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
          bottom: 14,
          zIndex: 2,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: "rgba(0,0,0,0.4)",
        },
        scannerFooterText: { color: "#fff", fontSize: 13, textAlign: "center" as const },
        modalOverlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          padding: 24,
        },
        modalBox: { backgroundColor: colors.backgroundCard, borderRadius: 12, padding: 24 },
        modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: colors.text },
        modalMessage: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
        navegarBtn: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
          marginBottom: 10,
        },
        navegarBtnText: { color: colors.primaryContrast, fontWeight: "600", fontSize: 16 },
        modalBtnCancel: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
        modalBtnCancelText: { color: colors.textSecondary, fontSize: 16 },
        toggleBtn: {
          flex: 1,
          paddingVertical: 10,
          alignItems: "center",
          borderRadius: 8,
          backgroundColor: colors.backgroundCard,
        },
        toggleBtnActive: { backgroundColor: colors.primary },
        toggleText: { fontSize: 14, color: colors.textSecondary },
        toggleTextActive: { color: colors.primaryContrast, fontWeight: "600" },
        loader: { marginTop: 48 },
        listWrap: { flex: 1 },
        batchLoadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 5,
          gap: 12,
        },
        batchLoadingText: {
          fontSize: 15,
          fontWeight: "600",
          color: colors.text,
        },
        listContent: { padding: 16 },
        mapWrap: { flex: 1, minHeight: Dimensions.get("window").height * 0.5 },
        map: { width: "100%", height: "100%", minHeight: 400 },
        bottomSheetOverlay: { flex: 1, backgroundColor: colors.overlay },
        bottomSheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 24,
          paddingTop: 16,
        },
        listSheet: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "70%",
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 24,
          paddingTop: 16,
        },
        listSheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4, color: colors.text },
        listSheetSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
        listSheetList: { maxHeight: 320 },
        listSheetItem: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          paddingHorizontal: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        listSheetItemDisabled: { opacity: 0.85 },
        listSheetItemLeft: { flex: 1 },
        listSheetItemCodigo: { fontSize: 16, fontWeight: "600", marginBottom: 2, color: colors.text },
        listSheetItemCliente: { fontSize: 14, color: colors.textSecondary },
        badgePendente: { backgroundColor: colors.primary },
        badgeEntregue: { backgroundColor: colors.success },
        badgeAusente: { backgroundColor: colors.textSecondary },
        bottomSheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4, color: colors.text },
        bottomSheetCliente: { fontSize: 16, color: colors.text, marginBottom: 8 },
        bottomSheetEndereco: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
        bottomSheetActions: { flexDirection: "row", gap: 12, marginBottom: 12 },
        bottomSheetBtnEntregue: {
          flex: 1,
          backgroundColor: colors.success,
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
        },
        bottomSheetBtnAusente: {
          flex: 1,
          backgroundColor: colors.danger,
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
        },
        btnDisabled: { opacity: 0.7 },
        bottomSheetBtnText: { color: colors.primaryContrast, fontWeight: "600", fontSize: 14 },
        bottomSheetFechar: { alignItems: "center", paddingVertical: 8 },
        bottomSheetFecharText: { color: colors.primary, fontSize: 16 },
        cardsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
        servicoCard: {
          flex: 1,
          backgroundColor: colors.backgroundCard,
          padding: 12,
          borderRadius: 10,
          borderTopWidth: 4,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        cardTotal: {
          flex: 1,
          backgroundColor: colors.backgroundCard,
          padding: 12,
          borderRadius: 10,
          borderTopWidth: 4,
          borderTopColor: colors.textSecondary,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        servicoCardLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
        servicoCardValue: { fontSize: 20, fontWeight: "700", color: colors.text },
        mapStatsRow: {
          flexDirection: "row",
          paddingHorizontal: 16,
          gap: 8,
          marginBottom: 4,
        },
        mapStatCard: {
          flex: 1,
          backgroundColor: colors.backgroundCard,
          padding: 12,
          borderRadius: 10,
          borderTopWidth: 3,
          borderTopColor: colors.primary,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        mapStatLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
        mapStatValue: { fontSize: 18, fontWeight: "700", color: colors.text },
        sectionHeaderWrap: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          marginBottom: 6,
          paddingVertical: 10,
          paddingHorizontal: 10,
          borderWidth: 1,
          borderRadius: 10,
        },
        sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
        sectionChevron: { fontSize: 15, color: colors.textSecondary, fontWeight: "700" },
        sectionHeader: { fontSize: 14, fontWeight: "600", color: colors.text },
        sectionCount: { fontSize: 16, color: colors.text, fontWeight: "700" },
        sectionServiceBadge: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
          borderWidth: 2,
        },
        sectionServiceBadgeText: { fontSize: 15, fontWeight: "700" },
        sectionCountBadge: {
          minWidth: 38,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.backgroundCard,
          borderWidth: 2,
        },
        badgesRow: { flexDirection: "row", gap: 6, alignItems: "center" },
        servicoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
        servicoBadgeText: { fontSize: 11, fontWeight: "600" },
        item: {
          backgroundColor: colors.backgroundCard,
          padding: 16,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: "transparent",
          marginBottom: 12,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
        itemCodigo: { fontSize: 16, fontWeight: "600", color: colors.text },
        badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
        badgeText: { fontSize: 12, color: "#fff", fontWeight: "600" },
        tentativaBadge: { fontSize: 11, color: colors.textSecondary, marginLeft: 4 },
        itemCliente: { fontSize: 14, color: colors.text },
        itemRow2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
        itemBairro: { fontSize: 13, color: colors.textSecondary },
        enderecoOk: { fontSize: 12, color: colors.success, fontWeight: "500" },
        enderecoFalta: { fontSize: 12, color: colors.danger },
        markerWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 2,
          borderColor: colors.backgroundCard,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.25,
          shadowRadius: 2,
          elevation: 3,
        },
        markerEntregue: { backgroundColor: colors.success },
        markerAusente: { backgroundColor: colors.textSecondary },
        markerIconText: { fontSize: 20, color: colors.primaryContrast, fontWeight: "700" },
        markerInicialText: { fontSize: 14, fontWeight: "700", color: colors.text },
        markerCountBadge: {
          position: "absolute",
          top: -4,
          right: -4,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.text,
          justifyContent: "center",
          alignItems: "center",
        },
        markerCountText: { fontSize: 10, fontWeight: "700", color: colors.text },
        bottomSheetGrupoInfo: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
        bottomSheetBtnVerDetalhes: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
          marginBottom: 12,
        },
        selectionBtn: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.separator,
          backgroundColor: colors.backgroundCard,
        },
        selectionBtnActive: {
          borderColor: colors.primary,
          backgroundColor: colors.inputBackground,
        },
        selectionBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
        sectionSelectRow: {
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 12,
          paddingHorizontal: 10,
          paddingBottom: 6,
        },
        sectionSelectLink: { fontSize: 12, color: colors.primary, fontWeight: "600" },
        itemSelected: { borderWidth: 2, borderColor: colors.primary },
        checkbox: {
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: colors.separator,
          marginRight: 10,
          alignItems: "center",
          justifyContent: "center",
        },
        checkboxChecked: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
        itemRowWithCheck: { flexDirection: "row", alignItems: "flex-start" },
      }),
    [colors]
  );
  const [tab, setTab] = useState<Tab>(() => route.params?.initialTab ?? "pendente");
  const [finalizadasFiltros, setFinalizadasFiltros] = useState<FinalizadasFiltros>(
    FINALIZADAS_FILTROS_PADRAO
  );
  const [list, setList] = useState<EntregaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedServico, setExpandedServico] = useState<Record<string, boolean>>(defaultExpanded);

  const {
    pendingDeliveries,
    mapMode,
    setMapMode,
    loadDeliveries,
    suggestedOrder,
    loading: storeLoading,
    routeStarted,
    activeRouteId,
    routeOrder,
    setRouteDeliveries,
    clearActiveRouteState,
    optimizeRoute,
    saveAddress,
    currentLocation,
    setCurrentLocation,
    finalizePendingBatch,
    ensureActiveRouteLoaded,
    reconcileActiveRoute,
  } = useDeliveryStore();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchAusenteModal, setShowBatchAusenteModal] = useState(false);
  const [batchResultVisible, setBatchResultVisible] = useState(false);
  const [batchFinalizadosCount, setBatchFinalizadosCount] = useState(0);
  const [batchBloqueados, setBatchBloqueados] = useState<FinalizarLoteBloqueadoOut[]>([]);
  const [showNavegarModal, setShowNavegarModal] = useState(false);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<number, { latitude: number; longitude: number }>>({});
  const [selectedPendingGroup, setSelectedPendingGroup] = useState<GroupedStop | null>(null);
  const [editDelivery, setEditDelivery] = useState<EntregaListItem | null>(null);
  const [locating, setLocating] = useState(false);
  const [markersReady, setMarkersReady] = useState(false);
  const mapRegionInitializedRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const scanLockedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const geocodedIdsRef = useRef<Set<number>>(new Set());
  const geocodedCoordsRef = useRef(geocodedCoords);
  geocodedCoordsRef.current = geocodedCoords;
  const mapRef = useRef<MapView>(null);
  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const setSomenteHojePendentes = useMotoboyPrefsStore((s) => s.setSomenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const [totalPendentesCount, setTotalPendentesCount] = useState(0);

  const listForTab = (tab === "pendente" ? pendingDeliveries : list) ?? [];
  const showPrepararRotaBtn =
    roteirizacaoHabilitada &&
    tab === "pendente" &&
    (listForTab.length > 0 || totalPendentesCount > 0 || routeStarted);
  const loadingForTab = tab === "pendente" ? storeLoading : loading;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const shouldFilterToday = somenteHojePendentes && (tab === "finalizadas" || tab === "ausentes");
      const params = shouldFilterToday ? { dia: "hoje" as const, data: getTodayISO() } : undefined;
      const data =
        tab === "finalizadas"
          ? await fetchFinalizadasFiltradas(params, finalizadasFiltros)
          : await getEntregas(tab, params);
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [tab, somenteHojePendentes, finalizadasFiltros]);

  const toggleFinalizadasFiltro = useCallback((key: keyof FinalizadasFiltros) => {
    setFinalizadasFiltros((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.entregue && !next.cancelado) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    const initialTab = route.params?.initialTab as EntregasListInitialTab | undefined;
    if (!initialTab) return;
    setTab(initialTab);
    navigation.setParams({ initialTab: undefined });
  }, [route.params?.initialTab, navigation]);

  useEffect(() => {
    if (!route.params?.todosPendentes) return;
    void setSomenteHojePendentes(false);
    navigation.setParams({ todosPendentes: undefined });
  }, [route.params?.todosPendentes, navigation, setSomenteHojePendentes]);

  useEffect(() => {
    if (route.params?.initialMapMode !== "map") return;
    setTab("pendente");
    setMapMode("map");
    navigation.setParams({ initialMapMode: undefined });
  }, [route.params?.initialMapMode, navigation, setMapMode]);

  useFocusEffect(
    useCallback(() => {
      if (tab === "pendente" && roteirizacaoHabilitada) {
        void ensureActiveRouteLoaded();
      }
    }, [tab, roteirizacaoHabilitada, ensureActiveRouteLoaded])
  );

  useFocusEffect(
    useCallback(() => {
      if (tab === "pendente") {
        loadDeliveries({ onlyToday: somenteHojePendentes });
        if (roteirizacaoHabilitada) {
          getEntregas("pendente")
            .then((all) => setTotalPendentesCount(all.length))
            .catch(() => setTotalPendentesCount(0));
        } else {
          setTotalPendentesCount(0);
        }
      } else {
        void load();
      }
    }, [tab, loadDeliveries, load, somenteHojePendentes, roteirizacaoHabilitada])
  );

  useEffect(() => {
    if (tab === "finalizadas") void load();
  }, [tab, finalizadasFiltros, load]);

  const badgeColor = (exibicao: string) => {
    if (exibicao === "Pendente") return colors.warning;
    if (exibicao === "Entregue") return colors.success;
    if (exibicao === "Ausente") return colors.danger;
    return colors.textSecondary;
  };

  const orderedPendentes = useMemo(() => {
    const source = listForTab ?? [];
    if (tab !== "pendente" || !suggestedOrder || suggestedOrder.length === 0) return source;
    const orderMap = new Map(suggestedOrder.map((id, i) => [id, i]));
    return [...source].sort((a, b) => (orderMap.get(a.id_saida) ?? 999) - (orderMap.get(b.id_saida) ?? 999));
  }, [tab, listForTab, suggestedOrder]);

  const pendentesFiltrados = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orderedPendentes;
    return orderedPendentes.filter((item) => String(item.codigo ?? "").toLowerCase().includes(q));
  }, [orderedPendentes, searchQuery]);

  const listWithSections = useMemo<ServiceSection[]>(() => {
    const source = tab === "pendente" ? pendentesFiltrados : listForTab;
    return SERVICO_ORDER.map((section) => ({
      section,
      data: source.filter((item) => servicoTipo(item.servico) === section),
    })).filter((group) => group.data.length > 0);
  }, [tab, pendentesFiltrados, listForTab]);

  const totalByService = useMemo<Record<ServicoTipo, number>>(
    () => {
      const source = tab === "pendente" ? orderedPendentes : listForTab;
      return SERVICO_ORDER.reduce(
        (acc, section) => {
          acc[section] = source.filter((item) => servicoTipo(item.servico) === section).length;
          return acc;
        },
        { Shopee: 0, Flex: 0, Avulso: 0 }
      );
    },
    [tab, orderedPendentes, listForTab]
  );

  const totalGeral = useMemo(
    () => totalByService.Shopee + totalByService.Flex + totalByService.Avulso,
    [totalByService]
  );

  const todayIso = useMemo(() => getTodayISO(), []);

  const pendingMapStats = useMemo(
    () => countPendingMapStats(orderedPendentes),
    [orderedPendentes]
  );

  const persistedMapGroups = useMemo(
    () => buildPendingMapGroups(orderedPendentes, {}, todayIso),
    [orderedPendentes, todayIso]
  );

  const pendingMapGroups = useMemo(
    () => buildPendingMapGroups(orderedPendentes, geocodedCoords, todayIso),
    [orderedPendentes, geocodedCoords, todayIso]
  );

  type PendingMapPointDisplay = PendingMapGroupPoint & {
    displayLatitude: number;
    displayLongitude: number;
  };

  const pendingMapPointsWithDisplay = useMemo((): PendingMapPointDisplay[] => {
    const spread = spreadOverlappingStopCoords(
      pendingMapGroups.map((p) => ({
        paradaIndex: p.mapIndex,
        latitude: p.latitude,
        longitude: p.longitude,
      }))
    );
    const coordByIndex = new Map(
      spread.map((s) => [s.paradaIndex, { latitude: s.latitude, longitude: s.longitude }])
    );
    return pendingMapGroups.map((p) => {
      const display = coordByIndex.get(p.mapIndex) ?? { latitude: p.latitude, longitude: p.longitude };
      return {
        ...p,
        displayLatitude: display.latitude,
        displayLongitude: display.longitude,
      };
    });
  }, [pendingMapGroups]);

  const pendingMapDisplayItems = useMemo(
    () =>
      clusterMapPoints(
        pendingMapPointsWithDisplay.map((p) => ({
          ...p,
          latitude: p.displayLatitude,
          longitude: p.displayLongitude,
        })),
        { routeMode: false }
      ),
    [pendingMapPointsWithDisplay]
  );

  const pendingMapPointsSig = useMemo(
    () =>
      pendingMapPointsWithDisplay
        .map((p) => `${p.group.stopKey}:${p.displayLatitude.toFixed(5)},${p.displayLongitude.toFixed(5)}`)
        .join("|"),
    [pendingMapPointsWithDisplay]
  );

  const getServiceRowStyle = useCallback(
    (servico?: string | null) => {
      const tipo = servicoTipo(servico);
      const color = SERVICO_COLORS[tipo] || colors.placeholder;
      const bgAlpha = themeMode === "dark" ? 0.22 : 0.12;
      return {
        backgroundColor: hexToRgba(color, bgAlpha),
        borderLeftColor: color,
      };
    },
    [colors.placeholder, themeMode]
  );
  const getServiceHeaderBadgeStyle = useCallback(
    (servico?: string | null) => {
      const tipo = servicoTipo(servico);
      const color = SERVICO_COLORS[tipo] || colors.placeholder;
      const bgAlpha = themeMode === "dark" ? 0.28 : 0.16;
      return {
        backgroundColor: hexToRgba(color, bgAlpha),
        borderColor: color,
      };
    },
    [colors.placeholder, themeMode]
  );
  const getServiceHeaderRowStyle = useCallback(
    (servico?: string | null) => {
      const tipo = servicoTipo(servico);
      const color = SERVICO_COLORS[tipo] || colors.placeholder;
      const bgAlpha = themeMode === "dark" ? 0.2 : 0.08;
      return {
        backgroundColor: hexToRgba(color, bgAlpha),
        borderColor: color,
      };
    },
    [colors.placeholder, themeMode]
  );
  const badgeTextColor = themeMode === "dark" ? "#ffffff" : "#111111";

  useEffect(() => {
    const ids = new Set((pendingDeliveries ?? []).map((d) => d.id_saida));
    for (const id of geocodedIdsRef.current) {
      if (!ids.has(id)) geocodedIdsRef.current.delete(id);
    }
  }, [pendingDeliveries]);

  useEffect(() => {
    if (tab !== "pendente") return;
    const toGeocode = (pendingDeliveries ?? []).filter(
      (d) =>
        (d.possui_endereco || (d.endereco_formatado ?? "").trim() || (d.endereco ?? "").trim()) &&
        (d.latitude == null || d.longitude == null) &&
        !geocodedCoordsRef.current[d.id_saida] &&
        !geocodedIdsRef.current.has(d.id_saida)
    );
    if (toGeocode.length === 0) return;
    const batchIds = new Set(toGeocode.map((d) => d.id_saida));
    let cancelled = false;
    (async () => {
      let pendingBatch: Record<number, { latitude: number; longitude: number }> = {};
      const flushBatch = () => {
        if (Object.keys(pendingBatch).length === 0) return;
        const snapshot = pendingBatch;
        pendingBatch = {};
        setGeocodedCoords((prev) => ({ ...prev, ...snapshot }));
      };
      for (const d of toGeocode) {
        if (cancelled) break;
        const coords = await geocodeDelivery(
          d,
          resolveGeocodeDefaults(d, cidadePadrao, estadoPadrao)
        );
        if (cancelled) break;
        geocodedIdsRef.current.add(d.id_saida);
        if (!coords) continue;
        pendingBatch[d.id_saida] = coords;
        if (Object.keys(pendingBatch).length >= GEOCODE_BATCH_SIZE) {
          flushBatch();
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (!cancelled) flushBatch();
    })();
    return () => {
      cancelled = true;
      for (const id of batchIds) {
        if (!geocodedCoordsRef.current[id]) {
          geocodedIdsRef.current.delete(id);
        }
      }
    };
  }, [tab, pendingDeliveries, cidadePadrao, estadoPadrao]);

  const firstDestForNav = useMemo(() => orderedPendentes[0] ?? null, [orderedPendentes]);

  const firstDestNavTarget = useMemo(
    () => (firstDestForNav ? resolveNavigationTarget(firstDestForNav) : null),
    [firstDestForNav]
  );

  const abrirAcoesOuBloquear = useCallback(
    (item: EntregaListItem) => {
      const statusNorm = String(item.status || item.exibicao || "").trim().toLowerCase();
      if (statusNorm.includes("entreg") || statusNorm.includes("cancel")) {
        Alert.alert("Bloqueado", `Pedido ${item.codigo ?? ""} está com status final (${item.exibicao || item.status}).`);
        return;
      }
      navigation.navigate("EntregaDetail", { idSaida: item.id_saida });
    },
    [navigation]
  );

  const processarBuscaOuScan = useCallback(
    (raw: string) => {
      const parsed = parseCodigoQrRaw(raw || "");
      const codigo = String(parsed.codigo || raw || "").trim().toLowerCase();
      if (!codigo) {
        Alert.alert("Atenção", "Informe um código válido.");
        return;
      }
      const item = (pendingDeliveries ?? []).find((d) => String(d.codigo ?? "").trim().toLowerCase() === codigo);
      if (!item) {
        Alert.alert("Não encontrado", "Código não está nos pendentes carregados ou já está finalizado/cancelado.");
        return;
      }
      abrirAcoesOuBloquear(item);
      setSearchQuery("");
    },
    [pendingDeliveries, abrirAcoesOuBloquear]
  );

  const handleSelectBuscaDigitada = useCallback(
    (item: EntregaListItem) => {
      abrirAcoesOuBloquear(item);
    },
    [abrirAcoesOuBloquear]
  );

  const handleBarcodeScanned = useCallback(
    async (event: BarcodeScanningResult) => {
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
    setScannerVisible(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const openGoogleMaps = useCallback(async () => {
    if (!firstDestForNav) {
      Alert.alert("Aviso", "Nenhuma entrega para navegação.");
      return;
    }
    await openNavigationToStop(firstDestForNav, "google", { geocodedCoords });
    setShowNavegarModal(false);
  }, [firstDestForNav, geocodedCoords]);

  const openWaze = useCallback(async () => {
    if (!firstDestForNav) {
      Alert.alert("Aviso", "Nenhuma entrega para navegação.");
      return;
    }
    await openNavigationToStop(firstDestForNav, "waze", { geocodedCoords });
    setShowNavegarModal(false);
  }, [firstDestForNav, geocodedCoords]);

  const openNavegador = useCallback(async () => {
    if (!firstDestForNav) {
      Alert.alert("Aviso", "Nenhuma entrega para navegação.");
      return;
    }
    await openNavigationToStop(firstDestForNav, "google", { geocodedCoords });
    setShowNavegarModal(false);
  }, [firstDestForNav, geocodedCoords]);
  const mapInitialRegion = useMemo(() => {
    const points =
      pendingMapGroups.length > 0 ? pendingMapGroups : persistedMapGroups;
    if (points.length === 0) {
      if (currentLocation) {
        return {
          ...currentLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
      }
      return DEFAULT_REGION;
    }
    const lats = points.map((g) => g.latitude);
    const lons = points.map((g) => g.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.6 || 0.08),
      longitudeDelta: Math.max(0.02, (maxLon - minLon) * 1.6 || 0.08),
    };
  }, [pendingMapGroups, persistedMapGroups, currentLocation]);

  const mapFitSigRef = useRef("");

  useEffect(() => {
    if (mapMode !== "map" || tab !== "pendente") {
      mapRegionInitializedRef.current = false;
      mapFitSigRef.current = "";
      return;
    }
    const fitPoints =
      pendingMapGroups.length > 0 ? pendingMapGroups : persistedMapGroups;
    if (fitPoints.length === 0) return;
    const sig = fitPoints.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`).join("|");
    if (mapFitSigRef.current === sig) return;
    const hadPreviousFit = mapFitSigRef.current !== "";
    mapFitSigRef.current = sig;
    mapRegionInitializedRef.current = true;
    const coords = fitPoints.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
    const fit = () => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 48, bottom: 140, left: 48 },
        animated: hadPreviousFit,
      });
    };
    requestAnimationFrame(fit);
  }, [mapMode, tab, pendingMapGroups, persistedMapGroups]);

  useEffect(() => {
    if (mapMode !== "map" || tab !== "pendente") return;
    if (pendingMapPointsWithDisplay.length === 0) return;
    setMarkersReady(false);
    const t = setTimeout(
      () => setMarkersReady(true),
      Platform.OS === "android" ? 500 : 1500
    );
    return () => clearTimeout(t);
  }, [mapMode, tab, pendingMapPointsSig, pendingMapPointsWithDisplay.length]);

  const centerOnCoords = useCallback((latitude: number, longitude: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: LOCATE_ZOOM_DELTA,
        longitudeDelta: LOCATE_ZOOM_DELTA,
      },
      400
    );
  }, []);

  const handleLocateMe = useCallback(async () => {
    if (locating) return;
    if (currentLocation) {
      centerOnCoords(currentLocation.latitude, currentLocation.longitude);
      return;
    }
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Localização",
          "Permita o acesso à localização para centralizar o mapa na sua posição."
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude, heading } = pos.coords;
      setCurrentLocation({
        latitude,
        longitude,
        heading: typeof heading === "number" && !Number.isNaN(heading) ? heading : undefined,
      });
      centerOnCoords(latitude, longitude);
    } catch {
      Alert.alert("Localização", "Não foi possível obter sua posição atual.");
    } finally {
      setLocating(false);
    }
  }, [locating, currentLocation, centerOnCoords, setCurrentLocation]);

  const handleCriarRotaFromGroup = useCallback(
    (group: GroupedStop) => {
      void confirmCreateRouteFromGroup(
        () => {
          void (async () => {
            const withCoords = group.deliveries.filter((d) => resolveDeliveryCoords(d, geocodedCoords));
            if (withCoords.length === 0) {
              Alert.alert("Atenção", "Nenhum pedido deste endereço possui coordenadas.");
              return;
            }
            try {
              if (useDeliveryStore.getState().activeRouteId == null) {
                clearActiveRouteState();
              }
              setRouteDeliveries(withCoords);
              if (withCoords.length >= 2) {
                await optimizeRoute();
              }
              setSelectedPendingGroup(null);
              navigation.navigate("RouteBuilder");
            } catch (e) {
              Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao criar rota.");
            }
          })();
        },
        {
          getActiveRouteId: () => useDeliveryStore.getState().activeRouteId,
          reconcileActiveRoute,
          onContinueRoute: () => navigation.navigate("RouteBuilder"),
        }
      );
    },
    [
      clearActiveRouteState,
      geocodedCoords,
      navigation,
      setRouteDeliveries,
      optimizeRoute,
      reconcileActiveRoute,
    ]
  );

  const handleSavePendingAddress = useCallback(
    async (values: AddressFormValues, coords?: GeocodeResult | null) => {
      if (!editDelivery) return;
      try {
        const body = {
          ...values,
          origem: "manual" as const,
          ...(isValidGeocodeCoords(coords?.latitude, coords?.longitude)
            ? { latitude: coords!.latitude, longitude: coords!.longitude }
            : {}),
        };
        const updated = await saveAddress(editDelivery.id_saida, body);
        if (updated.latitude != null && updated.longitude != null) {
          setGeocodedCoords((prev) => ({
            ...prev,
            [updated.id_saida]: { latitude: updated.latitude!, longitude: updated.longitude! },
          }));
        }
        setEditDelivery(null);
      } catch (e) {
        Alert.alert("Erro ao salvar", formatApiError(e, "Não foi possível salvar o endereço."));
      }
    },
    [editDelivery, saveAddress]
  );

  const handleClusterPress = useCallback(
    (points: PendingMapPointDisplay[]) => {
      if (points.length === 0) return;
      const lats = points.map((p) => p.displayLatitude);
      const lons = points.map((p) => p.displayLongitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      mapRef.current?.animateToRegion(
        {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max(0.005, (maxLat - minLat) * 2 || 0.02),
          longitudeDelta: Math.max(0.005, (maxLon - minLon) * 2 || 0.02),
        },
        400
      );
    },
    []
  );


  const toggleServico = (s: string) => {
    setExpandedServico((prev) => ({ ...prev, [s]: !prev[s] }));
  };

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  useEffect(() => {
    if (tab !== "pendente" || mapMode === "map") {
      clearSelection();
    }
  }, [tab, mapMode, clearSelection]);

  const toggleSelectedId = useCallback((idSaida: number) => {
    if (batchLoading) return;
    setSelectedIds((prev) => {
      if (prev.has(idSaida)) {
        const next = new Set(prev);
        next.delete(idSaida);
        return next;
      }
      if (prev.size >= FINALIZAR_LOTE_MAX_IDS) {
        Alert.alert(
          "Limite de seleção",
          `É possível selecionar no máximo ${FINALIZAR_LOTE_MAX_IDS} pedidos por lote.`
        );
        return prev;
      }
      const next = new Set(prev);
      next.add(idSaida);
      return next;
    });
  }, [batchLoading]);

  const enterSelectionWithItem = useCallback((item: EntregaListItem) => {
    if (batchLoading) return;
    setSelectionMode(true);
    setSelectedIds(new Set([item.id_saida]));
  }, [batchLoading]);

  const selectAllInSection = useCallback((items: EntregaListItem[]) => {
    if (batchLoading) return;
    setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      let skipped = 0;
      for (const item of items) {
        if (next.has(item.id_saida)) continue;
        if (next.size >= FINALIZAR_LOTE_MAX_IDS) {
          skipped += 1;
          continue;
        }
        next.add(item.id_saida);
      }
      if (skipped > 0) {
        Alert.alert(
          "Limite de seleção",
          `Só é possível selecionar até ${FINALIZAR_LOTE_MAX_IDS} pedidos por lote. ${skipped} pedido${skipped !== 1 ? "s" : ""} não ${skipped !== 1 ? "foram" : "foi"} incluído${skipped !== 1 ? "s" : ""}.`
        );
      }
      return next;
    });
  }, [batchLoading]);

  const clearSectionSelection = useCallback((items: EntregaListItem[]) => {
    if (batchLoading) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of items) next.delete(item.id_saida);
      return next;
    });
  }, [batchLoading]);

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const assertBatchNotInActiveRoute = useCallback((): boolean => {
    if (!activeRouteId || routeOrder.length === 0) return true;
    const inRoute = getIdsInActiveRoute(routeOrder, selectedIdsArray);
    if (inRoute.length === 0) return true;
    Alert.alert(
      "Rota ativa",
      "Esses pedidos fazem parte da rota ativa. Finalize pela rota ou individualmente — finalização em lote não está disponível para pedidos da rota."
    );
    return false;
  }, [activeRouteId, routeOrder, selectedIdsArray]);

  const handleBatchEntregue = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!assertBatchNotInActiveRoute()) return;
    if (count > FINALIZAR_LOTE_MAX_IDS) {
      Alert.alert(
        "Limite de seleção",
        `Reduza a seleção para no máximo ${FINALIZAR_LOTE_MAX_IDS} pedidos antes de finalizar em lote.`
      );
      return;
    }
    Alert.alert(
      "Confirmar entrega em lote?",
      `Você está marcando ${count} pedido${count !== 1 ? "s" : ""} como entregue${count !== 1 ? "s" : ""}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => {
            void (async () => {
              setBatchLoading(true);
              try {
                const resp = await finalizePendingBatch({
                  ids: selectedIdsArray,
                  acao: "entregue",
                });
                setBatchFinalizadosCount(resp.finalizados.length);
                setBatchBloqueados(resp.bloqueados);
                setBatchResultVisible(true);
                if (resp.routeJustCompleted && resp.rotaIdForResumo) {
                  runPostFinalizeFeedback({
                    tipo: "entregue",
                    routeJustCompleted: true,
                    rotaIdForResumo: resp.rotaIdForResumo,
                  });
                }
                const finalizedSet = new Set(resp.finalizados.map((f) => f.id_saida));
                const remaining = selectedIdsArray.filter((id) => !finalizedSet.has(id));
                setSelectedIds(new Set(remaining));
                if (remaining.length === 0) setSelectionMode(false);
              } catch (e) {
                Alert.alert("Erro", formatApiError(e, "Não foi possível finalizar em lote."));
              } finally {
                setBatchLoading(false);
              }
            })();
          },
        },
      ]
    );
  }, [selectedIds.size, selectedIdsArray, finalizePendingBatch, assertBatchNotInActiveRoute]);

  const handleBatchAusenteConfirm = useCallback(
    async (data: { motivoId: number; observacao?: string }) => {
      if (!assertBatchNotInActiveRoute()) return;
      if (selectedIds.size > FINALIZAR_LOTE_MAX_IDS) {
        Alert.alert(
          "Limite de seleção",
          `Reduza a seleção para no máximo ${FINALIZAR_LOTE_MAX_IDS} pedidos antes de finalizar em lote.`
        );
        return;
      }
      setShowBatchAusenteModal(false);
      setBatchLoading(true);
      try {
        const resp = await finalizePendingBatch({
          ids: selectedIdsArray,
          acao: "ausente",
          motivo_id: data.motivoId,
          observacao: data.observacao,
        });
        setBatchFinalizadosCount(resp.finalizados.length);
        setBatchBloqueados(resp.bloqueados);
        setBatchResultVisible(true);
        if (resp.routeJustCompleted && resp.rotaIdForResumo) {
          runPostFinalizeFeedback({
            tipo: "ausente",
            routeJustCompleted: true,
            rotaIdForResumo: resp.rotaIdForResumo,
          });
        }
        const finalizedSet = new Set(resp.finalizados.map((f) => f.id_saida));
        const remaining = selectedIdsArray.filter((id) => !finalizedSet.has(id));
        setSelectedIds(new Set(remaining));
        if (remaining.length === 0) setSelectionMode(false);
      } catch (e) {
        Alert.alert("Erro", formatApiError(e, "Não foi possível finalizar em lote."));
      } finally {
        setBatchLoading(false);
      }
    },
    [selectedIdsArray, finalizePendingBatch, assertBatchNotInActiveRoute]
  );

  const handleVerBloqueados = useCallback(() => {
    setBatchResultVisible(false);
    setSelectionMode(true);
    setSelectedIds(new Set(batchBloqueados.map((b) => b.id_saida)));
  }, [batchBloqueados]);

  const handleToggleSomenteHoje = useCallback(
    async (value: boolean) => {
      await setSomenteHojePendentes(value);
    },
    [setSomenteHojePendentes]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(16, insets.top) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Entregas</Text>
      </View>

      <View style={styles.tabs}>
        {TAB_ORDER.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {TAB_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showPrepararRotaBtn && (
        <TouchableOpacity
          style={styles.btnSugerirRota}
          onPress={() => navigation.navigate("PrepareDeliveries")}
        >
          <Text style={styles.btnSugerirRotaText}>🧭 Preparar Rota</Text>
        </TouchableOpacity>
      )}

      {tab === "pendente" && roteirizacaoHabilitada && activeRouteId != null && (
        <View style={styles.activeRouteBanner}>
          <Text style={styles.activeRouteBannerText}>Existe uma rota ativa em andamento</Text>
          <TouchableOpacity
            style={styles.activeRouteBannerBtn}
            onPress={() => navigation.navigate("RouteBuilder")}
          >
            <Text style={styles.activeRouteBannerBtnText}>Voltar para rota</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === "pendente" && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar/escanear código"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => processarBuscaOuScan(searchQuery)}
          />
          <TouchableOpacity style={styles.searchIconBtn} onPress={() => void openScanner()}>
            <Ionicons name="scan-outline" size={22} color={colors.primaryContrast} />
          </TouchableOpacity>
        </View>
      )}
      {tab === "pendente" && searchQuery.trim().length > 0 && (
        <View style={styles.searchResultsWrap}>
          <FlatList
            data={pendentesFiltrados.slice(0, 12)}
            keyExtractor={(item) => `search-${item.id_saida}`}
            ListEmptyComponent={
              <View style={styles.searchResultItem}>
                <Text style={styles.searchResultCliente}>Nenhum pendente encontrado com esse trecho.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.searchResultItem} onPress={() => handleSelectBuscaDigitada(item)}>
                <Text style={styles.searchResultCodigo}>{item.codigo ?? "—"}</Text>
                <Text style={styles.searchResultCliente}>{item.cliente ?? "Sem cliente"}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {tab === "pendente" && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, somenteHojePendentes && styles.toggleBtnActive]}
            onPress={() => void handleToggleSomenteHoje(true)}
          >
            <Text style={[styles.toggleText, somenteHojePendentes && styles.toggleTextActive]}>
              Somente hoje
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !somenteHojePendentes && styles.toggleBtnActive]}
            onPress={() => void handleToggleSomenteHoje(false)}
          >
            <Text style={[styles.toggleText, !somenteHojePendentes && styles.toggleTextActive]}>
              Todos pendentes
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === "finalizadas" && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, finalizadasFiltros.entregue && styles.toggleBtnActive]}
            onPress={() => toggleFinalizadasFiltro("entregue")}
          >
            <Text style={[styles.toggleText, finalizadasFiltros.entregue && styles.toggleTextActive]}>
              Entregues
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, finalizadasFiltros.cancelado && styles.toggleBtnActive]}
            onPress={() => toggleFinalizadasFiltro("cancelado")}
          >
            <Text style={[styles.toggleText, finalizadasFiltros.cancelado && styles.toggleTextActive]}>
              Cancelados
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {(tab === "finalizadas" || tab === "ausentes") && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, somenteHojePendentes && styles.toggleBtnActive]}
            onPress={() => void handleToggleSomenteHoje(true)}
          >
            <Text style={[styles.toggleText, somenteHojePendentes && styles.toggleTextActive]}>
              Somente hoje
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !somenteHojePendentes && styles.toggleBtnActive]}
            onPress={() => void handleToggleSomenteHoje(false)}
          >
            <Text style={[styles.toggleText, !somenteHojePendentes && styles.toggleTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === "pendente" && (
        <View style={[styles.toggleRow, { alignItems: "center" }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, mapMode === "list" && styles.toggleBtnActive]}
            onPress={() => setMapMode("list")}
          >
            <Text style={[styles.toggleText, mapMode === "list" && styles.toggleTextActive]}>Lista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mapMode === "map" && styles.toggleBtnActive]}
            onPress={() => setMapMode("map")}
          >
            <Text style={[styles.toggleText, mapMode === "map" && styles.toggleTextActive]}>Mapa</Text>
          </TouchableOpacity>
          {mapMode === "list" && (
            <TouchableOpacity
              style={[styles.selectionBtn, selectionMode && styles.selectionBtnActive, batchLoading && { opacity: 0.5 }]}
              onPress={() => !batchLoading && (selectionMode ? clearSelection() : setSelectionMode(true))}
              disabled={batchLoading}
            >
              <Text style={styles.selectionBtnText}>{selectionMode ? "Cancelar" : "Selecionar"}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!loadingForTab && tab === "pendente" && mapMode === "map" ? (
        <View style={styles.mapStatsRow}>
          <View style={styles.mapStatCard}>
            <Text style={styles.mapStatLabel}>Pendentes</Text>
            <Text style={styles.mapStatValue}>{pendingMapStats.total}</Text>
          </View>
          <View style={styles.mapStatCard}>
            <Text style={styles.mapStatLabel}>No mapa</Text>
            <Text style={styles.mapStatValue}>{pendingMapStats.noMapa}</Text>
          </View>
          <View style={styles.mapStatCard}>
            <Text style={styles.mapStatLabel}>Sem localização</Text>
            <Text style={styles.mapStatValue}>{pendingMapStats.semLocalizacao}</Text>
          </View>
        </View>
      ) : !loadingForTab ? (
        <View style={styles.cardsRow}>
          <View style={styles.cardTotal}>
            <Text style={styles.servicoCardLabel}>{TAB_LABELS[tab]}</Text>
            <Text style={styles.servicoCardValue}>{totalGeral}</Text>
          </View>
        </View>
      ) : null}

      {loadingForTab ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : tab === "pendente" && mapMode === "map" ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapInitialRegion}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {pendingMapDisplayItems.map((item, idx) => {
              if (item.type === "cluster") {
                const clusterKey = item.points
                  .map((p) => p.group.stopKey)
                  .sort()
                  .join("-");
                return (
                  <Marker
                    key={`pending-cluster-${clusterKey}`}
                    coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                    onPress={() => handleClusterPress(item.points)}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={!markersReady}
                  >
                    <PendingMapClusterMarker count={item.count} />
                  </Marker>
                );
              }
              const point = item.point;
              return (
                <Marker
                  key={`pending-${point.group.stopKey}`}
                  coordinate={{ latitude: point.displayLatitude, longitude: point.displayLongitude }}
                  onPress={() => setSelectedPendingGroup(point.group)}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={!markersReady}
                >
                  <PendingMapMarker packageCount={point.packageCount} hasLate={point.hasLate} />
                </Marker>
              );
            })}
          </MapView>

          <MapLocateButton
            bottomInset={MAP_LOCATE_BOTTOM_INSET + insets.bottom}
            onPress={handleLocateMe}
            loading={locating}
            disabled={locating}
          />

          <PendingMapGroupSheet
            visible={!!selectedPendingGroup}
            group={selectedPendingGroup}
            bottomInset={insets.bottom}
            onClose={() => setSelectedPendingGroup(null)}
            onCriarRota={handleCriarRotaFromGroup}
            onEditarEndereco={(group) => setEditDelivery(group.representativeDelivery)}
            onVerPedido={(idSaida) => navigation.navigate("EntregaDetail", { idSaida })}
          />

          <RouteEditAddressSheet
            visible={!!editDelivery}
            delivery={editDelivery}
            onSave={handleSavePendingAddress}
            onClose={() => setEditDelivery(null)}
          />

          <Modal visible={showNavegarModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Navegar com</Text>
                <Text style={styles.modalMessage}>
                  Abrir primeiro destino da rota sugerida em:
                </Text>
                {firstDestNavTarget && (
                  <Text style={[styles.modalMessage, { fontWeight: "600", marginBottom: 8 }]}>
                    {getDestinationLabel(firstDestNavTarget)}
                  </Text>
                )}
                <TouchableOpacity style={styles.navegarBtn} onPress={openGoogleMaps}>
                  <Text style={styles.navegarBtnText}>Google Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navegarBtn} onPress={openWaze}>
                  <Text style={styles.navegarBtnText}>Waze</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navegarBtn} onPress={openNavegador}>
                  <Text style={styles.navegarBtnText}>Navegador</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowNavegarModal(false)}>
                  <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            data={listWithSections}
            keyExtractor={(sec, idx) => sec.section ? sec.section : `list-${idx}`}
            contentContainerStyle={[
              styles.listContent,
              tab === "pendente" && selectionMode
                ? { paddingBottom: BATCH_SELECTION_LIST_PADDING }
                : { paddingBottom: 24 },
            ]}
            renderItem={({ item: section }) => {
            const isExpanded = !section.section || expandedServico[section.section] !== false;
            const sectionAllSelected =
              section.data.length > 0 && section.data.every((d) => selectedIds.has(d.id_saida));
            return (
              <View>
                {section.section ? (
                  <TouchableOpacity
                    style={[styles.sectionHeaderWrap, getServiceHeaderRowStyle(section.section)]}
                    onPress={() => toggleServico(section.section)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <Text style={styles.sectionChevron}>{isExpanded ? "▼" : "▶"}</Text>
                      <View style={[styles.sectionServiceBadge, getServiceHeaderBadgeStyle(section.section)]}>
                        <Text
                          style={[
                            styles.sectionServiceBadgeText,
                            { color: badgeTextColor },
                          ]}
                        >
                          {section.section}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.sectionCountBadge, getServiceHeaderBadgeStyle(section.section)]}>
                      <Text style={[styles.sectionCount, { color: badgeTextColor }]}>{section.data.length}</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
                {tab === "pendente" && selectionMode && isExpanded && section.section && section.data.length > 0 && (
                  <View style={styles.sectionSelectRow}>
                    <TouchableOpacity onPress={() => selectAllInSection(section.data)}>
                      <Text style={styles.sectionSelectLink}>
                        {sectionAllSelected ? "Selecionados" : "Selecionar todos visíveis"}
                      </Text>
                    </TouchableOpacity>
                    {section.data.some((d) => selectedIds.has(d.id_saida)) && (
                      <TouchableOpacity onPress={() => clearSectionSelection(section.data)}>
                        <Text style={styles.sectionSelectLink}>Limpar seção</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {isExpanded &&
                  section.data.map((item) => {
                    const isSelected = selectedIds.has(item.id_saida);
                    return (
                      <TouchableOpacity
                        key={item.id_saida}
                        style={[
                          styles.item,
                          getServiceRowStyle(section.section),
                          isSelected && styles.itemSelected,
                        ]}
                        onPress={() => {
                          if (tab === "pendente" && selectionMode) {
                            toggleSelectedId(item.id_saida);
                            return;
                          }
                          navigation.navigate("EntregaDetail", { idSaida: item.id_saida });
                        }}
                        onLongPress={() => {
                          if (tab === "pendente") enterSelectionWithItem(item);
                        }}
                        delayLongPress={400}
                      >
                        <View style={styles.itemRowWithCheck}>
                          {tab === "pendente" && selectionMode && (
                            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                              {isSelected && (
                                <Ionicons name="checkmark" size={14} color={colors.primaryContrast} />
                              )}
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <View style={styles.itemRow}>
                              <Text style={styles.itemCodigo}>{item.codigo || "—"}</Text>
                              <View style={styles.badgesRow}>
                                <View style={[styles.servicoBadge, { backgroundColor: SERVICO_COLORS[servicoTipo(item.servico)] || colors.placeholder }]}>
                                  <Text style={[styles.servicoBadgeText, { color: badgeTextColor }]}>{servicoTipo(item.servico)}</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: badgeColor(item.exibicao) }]}>
                                  <Text style={styles.badgeText}>{item.exibicao}</Text>
                                </View>
                                {(item.tentativa ?? 1) >= 2 && (
                                  <Text style={styles.tentativaBadge}>{item.tentativa}ª tentativa</Text>
                                )}
                              </View>
                            </View>
                            <Text style={styles.itemCliente} numberOfLines={1}>
                              {item.cliente || "—"}
                            </Text>
                            <View style={styles.itemRow2}>
                              <Text style={styles.itemBairro}>{item.bairro || "—"}</Text>
                              {item.possui_endereco ? (
                                <Text style={styles.enderecoOk}>✓ Endereço</Text>
                              ) : (
                                <Text style={styles.enderecoFalta}>Sem endereço</Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            );
          }}
          />
          {tab === "pendente" && batchLoading && (
            <View style={styles.batchLoadingOverlay} pointerEvents="auto">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.batchLoadingText}>Finalizando pedidos...</Text>
            </View>
          )}
          {tab === "pendente" && (
            <BatchSelectionBar
              count={selectedIds.size}
              maxCount={FINALIZAR_LOTE_MAX_IDS}
              loading={batchLoading}
              onMarcarEntregue={handleBatchEntregue}
              onMarcarAusente={() => setShowBatchAusenteModal(true)}
              onCancelar={clearSelection}
            />
          )}
        </View>
      )}

      <BatchAusenteConfirmModal
        visible={showBatchAusenteModal}
        count={selectedIds.size}
        onClose={() => setShowBatchAusenteModal(false)}
        onConfirm={(data) => void handleBatchAusenteConfirm(data)}
      />

      <BatchFinalizeResultModal
        visible={batchResultVisible}
        finalizadosCount={batchFinalizadosCount}
        bloqueados={batchBloqueados}
        bottomInset={insets.bottom}
        onClose={() => setBatchResultVisible(false)}
        onVerBloqueados={handleVerBloqueados}
      />

      <Modal visible={scannerVisible} transparent={false} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.imageViewerOverlay}>
          <View style={[styles.scannerHeader, { paddingTop: Math.max(14, insets.top), paddingBottom: 10 }]}>
            <TouchableOpacity onPress={() => setScannerVisible(false)}>
              <Text style={styles.scannerClose}>← Fechar</Text>
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Escanear pedido pendente</Text>
            <Text style={styles.scannerSubtitle}>Aponte para o QR Code da etiqueta</Text>
          </View>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanLockedRef.current ? undefined : handleBarcodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <ScanFrameOverlay wrapStyle={{}} />
          </View>
          <View style={[styles.scannerFooter, { bottom: Math.max(14, insets.bottom) }]}>
            <Text style={styles.scannerFooterText}>Escaneie um código pendente para abrir a entrega</Text>
          </View>
        </View>
      </Modal>

    </View>
  );
}
