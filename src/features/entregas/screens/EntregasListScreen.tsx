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
  useWindowDimensions,
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
import { inferCoordPrecision, isValidGeocodeCoords, type GeocodeResult } from "../utils/geocode";
import { extractAddressFields } from "../utils/addressBuild";
import {
  resolveDeliveryDestination,
  needsStoredCoordsValidation,
  validateStoredCoordsAgainstAddress,
  type GeocodedMetaMap,
  type LegacyValidationCache,
} from "../utils/deliveryDestination";
import { geocodeAddressStrict } from "../utils/geocodeStrict";
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
import type { AddressFormValues, AddressOrigem } from "../components/AddressForm";
import { formatApiError } from "../../../utils/formatApiError";
import { runOptimizeRouteWithFeedback } from "../utils/optimizeRouteFeedback";
import { SERVICO_COLORS, SERVICO_ORDER, servicoTipo, serviceCountForTab, serviceCountLabelForTab, type ServicoTipo } from "../utils/servico";
import EntregaCodigoHeader from "../components/EntregaCodigoHeader";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { useThemeStore } from "../../../store/themeStore";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { resolvePendingDeliveryByScan } from "../utils/resolvePendingDeliveryByScan";
import { ScanFrameOverlay } from "../../operacao/components/ScanFrameOverlay";
import { useScannerTorch } from "../hooks/useScannerTorch";
import ScannerTorchButton from "../components/ScannerTorchButton";
import { getIdsInActiveRoute } from "../utils/routeActiveSync";
import { runPostFinalizeFeedback } from "../utils/finalizeEntregaFeedback";
import {
  getDestinationLabel,
  openNavigationToStop,
  resolveNavigationTarget,
} from "../utils/externalNavigation";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import AppBrandTitleLogo from "../../../components/AppBrandTitleLogo";

type Props = NativeStackScreenProps<RootStackParamList, "EntregasList">;

type Tab = "pendente" | "finalizadas" | "ausentes";

const TAB_LABELS: Record<Tab, string> = {
  pendente: "Pendentes",
  finalizadas: "Finalizadas",
  ausentes: "Ausentes",
};

const TAB_ORDER: Tab[] = ["pendente", "ausentes", "finalizadas"];

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseDateSafe(value?: string | null): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function formatTimeAgoFrom(timestampMs: number, nowMs: number): string {
  const diffMinutes = Math.max(0, Math.floor((nowMs - timestampMs) / 60000));
  if (diffMinutes < 1) return "há menos de 1 minuto";
  if (diffMinutes < 60) return `há ${diffMinutes} minuto${diffMinutes !== 1 ? "s" : ""}`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `há ${hours} hora${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days !== 1 ? "s" : ""}`;
}

const LOCATE_ZOOM_DELTA = 0.008;
const MAP_LOCATE_BOTTOM_INSET = 72;
const GEOCODE_BATCH_SIZE = 8;

const defaultExpanded: Record<string, boolean> = { Shopee: false, Flex: false, Avulso: false };

const DEFAULT_REGION = { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.05, longitudeDelta: 0.05 };
type ServiceSection = { section: ServicoTipo; data: EntregaListItem[] };
type ViewMode = "list" | "map";

const SERVICE_ICONS: Record<ServicoTipo, keyof typeof Ionicons.glyphMap> = {
  Shopee: "bag-handle-outline",
  Flex: "swap-horizontal-outline",
  Avulso: "cube-outline",
};

const TAB_DEFAULT_COUNTS: Record<Tab, number> = {
  pendente: 0,
  ausentes: 0,
  finalizadas: 0,
};

export default function EntregasListScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const compactHeader = windowWidth < 360;
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.theme);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
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
          position: "relative",
        },
        headerFilterButtonText: { fontSize: 13, fontWeight: "700", color: colors.text },
        headerFilterDotBadge: {
          position: "absolute",
          top: 6,
          right: 6,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        },
        tabs: {
          flexDirection: "row",
          backgroundColor: colors.backgroundCard,
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 6,
        },
        tab: {
          flex: 1,
          minHeight: 40,
          paddingVertical: 8,
          paddingHorizontal: 4,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.background,
        },
        tabActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600", textAlign: "center" },
        tabTextActive: { color: colors.primaryContrast, fontWeight: "700" },
        btnSugerirRota: {
          marginHorizontal: 16,
          marginBottom: 6,
          marginTop: 8,
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
        refreshErrorBanner: {
          marginHorizontal: 16,
          marginTop: 8,
          padding: 10,
          borderRadius: 8,
          backgroundColor: hexToRgba(colors.warning, 0.12),
          borderWidth: 1,
          borderColor: hexToRgba(colors.warning, 0.35),
        },
        refreshErrorText: { fontSize: 13, color: colors.text, lineHeight: 18 },
        searchRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 8,
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
        listContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
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
        lastDeliveryCard: {
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: hexToRgba(colors.success, 0.45),
          backgroundColor: hexToRgba(colors.success, 0.1),
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        lastDeliveryIcon: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hexToRgba(colors.success, 0.2),
        },
        lastDeliveryBody: { flex: 1, minWidth: 0 },
        lastDeliveryTitle: { fontSize: 14, fontWeight: "800", color: colors.success },
        lastDeliveryCode: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 1 },
        lastDeliveryMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        serviceStatsRow: {
          flexDirection: "row",
          alignItems: "center",
          marginTop: 8,
        },
        serviceStatsText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
        serviceTotalBadgeLarge: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 10,
          borderWidth: 1,
          flexShrink: 0,
        },
        serviceTotalBadgeTextLarge: { fontSize: 18, fontWeight: "800" },
        sectionSimpleCountBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          borderWidth: 1,
          minWidth: 32,
          alignItems: "center",
        },
        sectionSimpleCountText: { fontSize: 14, fontWeight: "800" },
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
          marginTop: 12,
          marginBottom: 6,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderRadius: 12,
        },
        sectionHeaderTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
        sectionServiceIconWrap: {
          width: 34,
          height: 34,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
        },
        sectionChevron: { fontSize: 15, color: colors.textSecondary, fontWeight: "700", marginLeft: 8 },
        sectionServiceBadge: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
          borderWidth: 2,
        },
        sectionServiceBadgeText: { fontSize: 15, fontWeight: "700" },
        badgesRow: { flexDirection: "row", gap: 6, alignItems: "center" },
        servicoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
        servicoBadgeText: { fontSize: 11, fontWeight: "600" },
        item: {
          backgroundColor: colors.backgroundCard,
          padding: 14,
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
        itemCodigo: { fontSize: 17, fontWeight: "700", color: colors.text },
        badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
        badgeText: { fontSize: 12, color: "#fff", fontWeight: "600" },
        tentativaBadge: { fontSize: 11, color: colors.textSecondary, marginLeft: 4 },
        itemCliente: { fontSize: 14, color: colors.text, fontWeight: "500" },
        itemRow2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
        itemBairro: { fontSize: 13, color: colors.textSecondary, flex: 1, paddingRight: 8 },
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
        filterModalOverlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        filterModalSheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: Math.max(18, insets.bottom),
          borderTopWidth: 1,
          borderTopColor: colors.separator,
        },
        filterModalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 },
        filterSectionTitle: { fontSize: 13, color: colors.textSecondary, fontWeight: "700", marginBottom: 6 },
        filterChoiceRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
        filterChoiceBtn: {
          flex: 1,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.background,
          paddingVertical: 10,
          alignItems: "center",
        },
        filterChoiceBtnActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
        filterChoiceText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
        filterChoiceTextActive: { color: colors.primaryContrast, fontWeight: "700" },
        filterActionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
        filterActionBtn: {
          flex: 1,
          borderRadius: 10,
          paddingVertical: 11,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.separator,
          backgroundColor: colors.background,
        },
        filterActionPrimary: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
        filterActionText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
        filterActionTextPrimary: { color: colors.primaryContrast },
      }),
    [colors, insets.bottom]
  );
  const [tab, setTab] = useState<Tab>(() => route.params?.initialTab ?? "pendente");
  const [finalizadasFiltros, setFinalizadasFiltros] = useState<FinalizadasFiltros>(
    FINALIZADAS_FILTROS_PADRAO
  );
  const [list, setList] = useState<EntregaListItem[]>([]);
  const [ausentesCache, setAusentesCache] = useState<EntregaListItem[]>([]);
  const [finalizadasCache, setFinalizadasCache] = useState<EntregaListItem[]>([]);
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
    pendingRefreshError,
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
  const [geocodedMeta, setGeocodedMeta] = useState<GeocodedMetaMap>({});
  const [legacyValidationCache, setLegacyValidationCache] = useState<LegacyValidationCache>({});
  const legacyValidationCacheRef = useRef(legacyValidationCache);
  legacyValidationCacheRef.current = legacyValidationCache;
  const [selectedPendingGroup, setSelectedPendingGroup] = useState<GroupedStop | null>(null);
  const [editDelivery, setEditDelivery] = useState<EntregaListItem | null>(null);
  const [locating, setLocating] = useState(false);
  const [markersReady, setMarkersReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRegionInitializedRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterDraftSomenteHoje, setFilterDraftSomenteHoje] = useState(true);
  const [filterDraftViewMode, setFilterDraftViewMode] = useState<ViewMode>("list");
  const [filterDraftFinalizadas, setFilterDraftFinalizadas] = useState<FinalizadasFiltros>(
    FINALIZADAS_FILTROS_PADRAO
  );
  const scanLockedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const torch = useScannerTorch(scannerVisible && !!cameraPermission?.granted);
  const geocodedIdsRef = useRef<Set<number>>(new Set());
  const geocodedCoordsRef = useRef(geocodedCoords);
  geocodedCoordsRef.current = geocodedCoords;
  const geocodedMetaRef = useRef(geocodedMeta);
  geocodedMetaRef.current = geocodedMeta;
  const mapRef = useRef<MapView>(null);
  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const setSomenteHojePendentes = useMotoboyPrefsStore((s) => s.setSomenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const [totalPendentesCount, setTotalPendentesCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<Tab, number>>(TAB_DEFAULT_COUNTS);
  const [tabCountsError, setTabCountsError] = useState<string | null>(null);
  const [lastDelivered, setLastDelivered] = useState<EntregaListItem | null>(null);

  const listForTab = (tab === "pendente" ? pendingDeliveries : list) ?? [];
  const showPrepararRotaBtn =
    roteirizacaoHabilitada &&
    tab === "pendente" &&
    (listForTab.length > 0 || totalPendentesCount > 0 || routeStarted);
  const loadingForTab =
    tab === "pendente"
      ? storeLoading && (pendingDeliveries?.length ?? 0) === 0
      : loading;
  const shouldShowMapInFilters = tab === "pendente" && roteirizacaoHabilitada;

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

  const loadTabCounts = useCallback(async () => {
    const paramsToday = { dia: "hoje" as const, data: getTodayISO() };
    setTabCountsError(null);
    try {
      const [ausentes, finalizadas] = await Promise.all([
        getEntregas("ausentes", somenteHojePendentes ? paramsToday : undefined),
        fetchFinalizadasFiltradas(somenteHojePendentes ? paramsToday : undefined, finalizadasFiltros),
      ]);
      setTabCounts((prev) => ({
        ...prev,
        ausentes: ausentes.length,
        finalizadas: finalizadas.length,
      }));
      setAusentesCache(ausentes);
      setFinalizadasCache(finalizadas);
      const deliveredOnly = finalizadas.filter((item) => item.exibicao === "Entregue");
      const recentDelivered = deliveredOnly
        .slice()
        .sort((a, b) => {
          const ta =
            parseDateSafe(a.data_hora_entrega) ??
            parseDateSafe(a.data) ??
            Number.MIN_SAFE_INTEGER;
          const tb =
            parseDateSafe(b.data_hora_entrega) ??
            parseDateSafe(b.data) ??
            Number.MIN_SAFE_INTEGER;
          return tb - ta;
        })[0];
      setLastDelivered(recentDelivered ?? null);
    } catch {
      setTabCountsError("Não foi possível atualizar as contagens das abas.");
    }
  }, [somenteHojePendentes, finalizadasFiltros]);

  const toggleFilterDraftFinalizadas = useCallback((key: keyof FinalizadasFiltros) => {
    setFilterDraftFinalizadas((prev) => {
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

  useEffect(() => {
    if (route.params?.initialMapMode === "map") return;
    setMapMode("list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab === "pendente" && roteirizacaoHabilitada) {
        void ensureActiveRouteLoaded();
      }
    }, [tab, roteirizacaoHabilitada, ensureActiveRouteLoaded])
  );

  useFocusEffect(
    useCallback(() => {
      void loadTabCounts();
      if (tab === "pendente") {
        void loadDeliveries({ onlyToday: somenteHojePendentes }).then((result) => {
          if (result.ok) {
            setTabCounts((prev) => ({ ...prev, pendente: result.count }));
            setTotalPendentesCount(result.count);
          }
        });
      } else {
        void load();
      }
    }, [tab, loadDeliveries, load, somenteHojePendentes, loadTabCounts])
  );

  useEffect(() => {
    if (tab !== "pendente") return;
    const count = pendingDeliveries.length;
    setTabCounts((prev) => ({ ...prev, pendente: count }));
    setTotalPendentesCount(count);
  }, [pendingDeliveries, tab]);

  useEffect(() => {
    if (tab === "finalizadas") void load();
  }, [tab, finalizadasFiltros, load]);

  useEffect(() => {
    if (!filterModalVisible) return;
    setFilterDraftSomenteHoje(somenteHojePendentes);
    setFilterDraftViewMode(shouldShowMapInFilters ? mapMode : "list");
    setFilterDraftFinalizadas(finalizadasFiltros);
  }, [filterModalVisible, somenteHojePendentes, mapMode, shouldShowMapInFilters, finalizadasFiltros]);

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

  const serviceStatusSummary = useMemo(
    () =>
      SERVICO_ORDER.reduce(
        (acc, service) => {
          const pending = pendingDeliveries.filter((item) => servicoTipo(item.servico) === service).length;
          const absent = ausentesCache.filter((item) => servicoTipo(item.servico) === service).length;
          const finished = finalizadasCache.filter(
            (item) => servicoTipo(item.servico) === service && item.exibicao === "Entregue"
          ).length;
          const total = pending + absent + finished;
          acc[service] = { pending, absent, finished, total };
          return acc;
        },
        {} as Record<ServicoTipo, { pending: number; absent: number; finished: number; total: number }>
      ),
    [pendingDeliveries, ausentesCache, finalizadasCache]
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
    () =>
      buildPendingMapGroups(
        orderedPendentes,
        geocodedCoords,
        todayIso,
        geocodedMeta,
        legacyValidationCache
      ),
    [orderedPendentes, geocodedCoords, geocodedMeta, legacyValidationCache, todayIso]
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
    const toGeocode = (pendingDeliveries ?? []).filter((d) => {
      if (!d.possui_endereco && !(d.endereco_formatado ?? "").trim() && !(d.endereco ?? "").trim()) {
        return false;
      }
      const dest = resolveDeliveryDestination(
        d,
        geocodedCoordsRef.current,
        geocodedMetaRef.current
      );
      if (dest.hasTrustedCoords) return false;
      return !geocodedIdsRef.current.has(d.id_saida);
    });
    if (toGeocode.length === 0) return;
    const batchIds = new Set(toGeocode.map((d) => d.id_saida));
    let cancelled = false;
    (async () => {
      let pendingBatch: Record<number, { latitude: number; longitude: number }> = {};
      let pendingMeta: GeocodedMetaMap = {};
      const flushBatch = () => {
        if (Object.keys(pendingBatch).length === 0) return;
        const snapshot = pendingBatch;
        const metaSnapshot = pendingMeta;
        pendingBatch = {};
        pendingMeta = {};
        setGeocodedCoords((prev) => ({ ...prev, ...snapshot }));
        setGeocodedMeta((prev) => ({ ...prev, ...metaSnapshot }));
      };
      for (const d of toGeocode) {
        if (cancelled) break;
        const fields = extractAddressFields(d);
        if (!fields.cidade && cidadePadrao) fields.cidade = cidadePadrao;
        if (!fields.estado && estadoPadrao) fields.estado = estadoPadrao;
        const strict = await geocodeAddressStrict(fields);
        if (cancelled) break;
        geocodedIdsRef.current.add(d.id_saida);
        if (!strict) continue;
        pendingBatch[d.id_saida] = {
          latitude: strict.latitude,
          longitude: strict.longitude,
        };
        pendingMeta[d.id_saida] = {
          confidence: strict.confidence,
          source: "app_geocoded",
          validated: true,
        };
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

  useEffect(() => {
    if (tab !== "pendente") return;
    let cancelled = false;
    (async () => {
      for (const d of pendingDeliveries ?? []) {
        if (cancelled) return;
        if (!needsStoredCoordsValidation(d)) continue;
        if (legacyValidationCacheRef.current[d.id_saida] !== undefined) continue;

        const confidence = await validateStoredCoordsAgainstAddress(d);
        if (cancelled) return;
        setLegacyValidationCache((prev) => {
          if (prev[d.id_saida] !== undefined) return prev;
          return { ...prev, [d.id_saida]: confidence };
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, pendingDeliveries]);

  const firstDestForNav = useMemo(() => orderedPendentes[0] ?? null, [orderedPendentes]);

  const firstDestNavTarget = useMemo(
    () =>
      firstDestForNav
        ? resolveNavigationTarget(
            firstDestForNav,
            geocodedCoords,
            geocodedMeta,
            legacyValidationCache
          )
        : null,
    [firstDestForNav, geocodedCoords, geocodedMeta, legacyValidationCache]
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
      const result = resolvePendingDeliveryByScan(raw, pendingDeliveries ?? []);
      if (!result.ok) {
        Alert.alert(result.title, result.message);
        return;
      }
      navigation.navigate("EntregaDetail", { idSaida: result.item.id_saida });
      setSearchQuery("");
    },
    [pendingDeliveries, navigation]
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
    await openNavigationToStop(firstDestForNav, "google", {
      geocodedCoords,
      geocodedMeta,
      legacyCache: legacyValidationCache,
    });
    setShowNavegarModal(false);
  }, [firstDestForNav, geocodedCoords]);

  const openWaze = useCallback(async () => {
    if (!firstDestForNav) {
      Alert.alert("Aviso", "Nenhuma entrega para navegação.");
      return;
    }
    await openNavigationToStop(firstDestForNav, "waze", {
      geocodedCoords,
      geocodedMeta,
      legacyCache: legacyValidationCache,
    });
    setShowNavegarModal(false);
  }, [firstDestForNav, geocodedCoords]);

  const openNavegador = useCallback(async () => {
    if (!firstDestForNav) {
      Alert.alert("Aviso", "Nenhuma entrega para navegação.");
      return;
    }
    await openNavigationToStop(firstDestForNav, "google", {
      geocodedCoords,
      geocodedMeta,
      legacyCache: legacyValidationCache,
    });
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
    if (!mapReady) return;
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
  }, [mapMode, tab, mapReady, pendingMapGroups, persistedMapGroups]);

  useEffect(() => {
    if (loadingForTab || mapMode !== "map" || tab !== "pendente") {
      setMapReady(false);
    }
  }, [loadingForTab, mapMode, tab]);

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
            const withCoords = group.deliveries.filter((d) =>
              resolveDeliveryCoords(d, geocodedCoords, geocodedMeta, legacyValidationCache)
            );
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
                const result = await runOptimizeRouteWithFeedback(optimizeRoute);
                if (!result?.ok) return;
              }
              setSelectedPendingGroup(null);
              navigation.navigate("RouteBuilder", { highlightLocatePackage: true });
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
    async (values: AddressFormValues, coords?: GeocodeResult | null, origem?: AddressOrigem) => {
      if (!editDelivery) return;
      try {
        const effectiveOrigem = origem ?? "manual";
        const hasClientCoords = isValidGeocodeCoords(coords?.latitude, coords?.longitude);
        const body = {
          ...values,
          origem: effectiveOrigem,
          ...(hasClientCoords
            ? {
                latitude: coords!.latitude,
                longitude: coords!.longitude,
                coord_precision: inferCoordPrecision(effectiveOrigem),
              }
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

  const applyFilterDraft = useCallback(async () => {
    await setSomenteHojePendentes(filterDraftSomenteHoje);
    if (tab === "pendente" && shouldShowMapInFilters) {
      setMapMode(filterDraftViewMode);
    } else if (tab === "pendente") {
      setMapMode("list");
    }
    if (tab === "finalizadas") {
      setFinalizadasFiltros(filterDraftFinalizadas);
    }
    setFilterModalVisible(false);
  }, [
    filterDraftSomenteHoje,
    filterDraftViewMode,
    filterDraftFinalizadas,
    setSomenteHojePendentes,
    tab,
    setMapMode,
    shouldShowMapInFilters,
  ]);

  const clearFilterDraft = useCallback(() => {
    setFilterDraftSomenteHoje(false);
    setFilterDraftViewMode("list");
    setFilterDraftFinalizadas(FINALIZADAS_FILTROS_PADRAO);
  }, []);

  const filterCount = useMemo(() => {
    let count = 0;
    if (somenteHojePendentes) count += 1;
    if (tab === "pendente" && mapMode === "map") count += 1;
    if (tab === "finalizadas") {
      if (finalizadasFiltros.cancelado) count += 1;
      if (!finalizadasFiltros.entregue) count += 1;
    }
    return count;
  }, [somenteHojePendentes, tab, mapMode, finalizadasFiltros]);

  const filterBadgeLabel = useMemo(
    () => (filterCount > 0 ? `Filtro · ${filterCount}` : "Filtro"),
    [filterCount]
  );

  const lastDeliveryMeta = useMemo(() => {
    if (!lastDelivered) return null;
    const ts = parseDateSafe(lastDelivered.data_hora_entrega) ?? parseDateSafe(lastDelivered.data);
    if (!ts) return null;
    const date = new Date(ts);
    const hh = `${date.getHours()}`.padStart(2, "0");
    const mm = `${date.getMinutes()}`.padStart(2, "0");
    const ago = formatTimeAgoFrom(ts, Date.now());
    return `Finalizada às ${hh}:${mm} · ${ago}`;
  }, [lastDelivered]);

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        titleNode={<AppBrandTitleLogo size="header" />}
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
        rightElement={
          <TouchableOpacity
            style={styles.headerFilterButton}
            onPress={() => setFilterModalVisible(true)}
            accessibilityLabel="Filtros"
          >
            <Ionicons name="filter-outline" size={16} color={colors.text} />
            {!compactHeader ? (
              <Text style={styles.headerFilterButtonText}>{filterBadgeLabel}</Text>
            ) : null}
            {compactHeader && filterCount > 0 ? <View style={styles.headerFilterDotBadge} /> : null}
          </TouchableOpacity>
        }
      />

      <View style={styles.tabs}>
        {TAB_ORDER.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]} numberOfLines={1}>
              {`${TAB_LABELS[t]} (${tabCounts[t] ?? 0})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(tab === "pendente" && pendingRefreshError) || tabCountsError ? (
        <View style={styles.refreshErrorBanner}>
          <Text style={styles.refreshErrorText}>
            {tab === "pendente" && pendingRefreshError
              ? pendingRefreshError
              : tabCountsError}
          </Text>
        </View>
      ) : null}

      {tab === "pendente" && (
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
            onSubmitEditing={() => processarBuscaOuScan(searchQuery)}
          />
          <TouchableOpacity style={styles.searchIconBtn} onPress={() => void openScanner()}>
            <Ionicons name="scan-outline" size={22} color={colors.primaryContrast} />
            <Text style={styles.searchIconBtnText}>Escanear</Text>
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
      ) : null}

      {!loadingForTab && lastDelivered && (
        <TouchableOpacity
          style={styles.lastDeliveryCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("EntregaDetail", { idSaida: lastDelivered.id_saida })}
        >
          <View style={styles.lastDeliveryIcon}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          </View>
          <View style={styles.lastDeliveryBody}>
            <Text style={styles.lastDeliveryTitle}>Última Entrega</Text>
            <Text style={styles.lastDeliveryCode} numberOfLines={1} ellipsizeMode="tail">
              {lastDelivered.codigo ?? `Pedido ${lastDelivered.id_saida}`}
            </Text>
            <Text style={styles.lastDeliveryMeta}>{lastDeliveryMeta ?? "Finalizada recentemente"}</Text>
          </View>
        </TouchableOpacity>
      )}

      {loadingForTab ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : tab === "pendente" && mapMode === "map" ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapInitialRegion}
            onMapReady={() => setMapReady(true)}
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
                ? { paddingBottom: BATCH_SELECTION_LIST_PADDING + Math.max(0, insets.bottom - 4) }
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
                    <View style={styles.sectionHeaderTop}>
                      <View style={styles.sectionHeaderLeft}>
                        <View
                          style={[
                            styles.sectionServiceIconWrap,
                            getServiceHeaderBadgeStyle(section.section),
                          ]}
                        >
                          <Ionicons
                            name={SERVICE_ICONS[section.section]}
                            size={18}
                            color={badgeTextColor}
                          />
                        </View>
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
                        <Text style={styles.sectionChevron}>{isExpanded ? "▼" : "▶"}</Text>
                      </View>
                      <View
                        style={[
                          styles.serviceTotalBadgeLarge,
                          getServiceHeaderBadgeStyle(section.section),
                        ]}
                      >
                        <Text style={[styles.serviceTotalBadgeTextLarge, { color: badgeTextColor }]}>
                          {serviceCountLabelForTab(
                            tab,
                            serviceCountForTab(
                              tab,
                              serviceStatusSummary[section.section] ?? {
                                pending: 0,
                                absent: 0,
                                finished: 0,
                              },
                              section.data.length
                            )
                          )}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.serviceStatsRow}>
                      <Text style={styles.serviceStatsText}>
                        {serviceStatusSummary[section.section]?.pending ?? 0} Pendentes |{" "}
                        {serviceStatusSummary[section.section]?.absent ?? 0} Ausentes |{" "}
                        {serviceStatusSummary[section.section]?.finished ?? 0} Finalizadas
                      </Text>
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
                            <EntregaCodigoHeader
                              codigo={item.codigo}
                              servico={item.servico}
                              exibicao={item.exibicao}
                              data={item.data}
                              tentativa={item.tentativa}
                              style={{ marginBottom: 8 }}
                            />
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
            enableTorch={torch.enableTorch}
            onCameraReady={torch.onCameraReady}
            onBarcodeScanned={scanLockedRef.current ? undefined : handleBarcodeScanned}
          />
          <ScannerTorchButton
            mode={torch.mode}
            onPress={torch.cycleMode}
            style={{ top: insets.top + 72, right: 16 }}
          />
          <View style={styles.cameraOverlay}>
            <ScanFrameOverlay wrapStyle={{}} />
          </View>
          <View style={[styles.scannerFooter, { bottom: Math.max(14, insets.bottom) }]}>
            <Text style={styles.scannerFooterText}>Escaneie um código pendente para abrir a entrega</Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
          <View style={styles.filterModalSheet}>
            <Text style={styles.filterModalTitle}>Filtros</Text>

            <Text style={styles.filterSectionTitle}>
              {tab === "pendente" ? "Período pendentes" : "Período"}
            </Text>
            <View style={styles.filterChoiceRow}>
              <TouchableOpacity
                style={[
                  styles.filterChoiceBtn,
                  filterDraftSomenteHoje && styles.filterChoiceBtnActive,
                ]}
                onPress={() => setFilterDraftSomenteHoje(true)}
              >
                <Text
                  style={[
                    styles.filterChoiceText,
                    filterDraftSomenteHoje && styles.filterChoiceTextActive,
                  ]}
                >
                  Somente hoje
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChoiceBtn,
                  !filterDraftSomenteHoje && styles.filterChoiceBtnActive,
                ]}
                onPress={() => setFilterDraftSomenteHoje(false)}
              >
                <Text
                  style={[
                    styles.filterChoiceText,
                    !filterDraftSomenteHoje && styles.filterChoiceTextActive,
                  ]}
                >
                  {tab === "pendente" ? "Todos pendentes" : "Todos"}
                </Text>
              </TouchableOpacity>
            </View>

            {shouldShowMapInFilters ? (
              <>
                <Text style={styles.filterSectionTitle}>Visualização</Text>
                <View style={styles.filterChoiceRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterChoiceBtn,
                      filterDraftViewMode === "list" && styles.filterChoiceBtnActive,
                    ]}
                    onPress={() => setFilterDraftViewMode("list")}
                  >
                    <Text
                      style={[
                        styles.filterChoiceText,
                        filterDraftViewMode === "list" && styles.filterChoiceTextActive,
                      ]}
                    >
                      Lista
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterChoiceBtn,
                      filterDraftViewMode === "map" && styles.filterChoiceBtnActive,
                    ]}
                    onPress={() => setFilterDraftViewMode("map")}
                  >
                    <Text
                      style={[
                        styles.filterChoiceText,
                        filterDraftViewMode === "map" && styles.filterChoiceTextActive,
                      ]}
                    >
                      Mapa
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {tab === "finalizadas" ? (
              <>
                <Text style={styles.filterSectionTitle}>Status</Text>
                <View style={styles.filterChoiceRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterChoiceBtn,
                      filterDraftFinalizadas.entregue && styles.filterChoiceBtnActive,
                    ]}
                    onPress={() => toggleFilterDraftFinalizadas("entregue")}
                  >
                    <Text
                      style={[
                        styles.filterChoiceText,
                        filterDraftFinalizadas.entregue && styles.filterChoiceTextActive,
                      ]}
                    >
                      Entregues
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterChoiceBtn,
                      filterDraftFinalizadas.cancelado && styles.filterChoiceBtnActive,
                    ]}
                    onPress={() => toggleFilterDraftFinalizadas("cancelado")}
                  >
                    <Text
                      style={[
                        styles.filterChoiceText,
                        filterDraftFinalizadas.cancelado && styles.filterChoiceTextActive,
                      ]}
                    >
                      Cancelados
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            <View style={styles.filterActionsRow}>
              <TouchableOpacity style={styles.filterActionBtn} onPress={clearFilterDraft}>
                <Text style={styles.filterActionText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterActionBtn, styles.filterActionPrimary]}
                onPress={() => {
                  void applyFilterDraft();
                }}
              >
                <Text style={[styles.filterActionText, styles.filterActionTextPrimary]}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
