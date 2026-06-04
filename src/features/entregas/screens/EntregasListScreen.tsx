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
  Linking,
  Alert,
  TextInput,
  Image,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import { API_BASE_URL } from "../../../config/api";
import { getComprovanteWatermark, getEntregas, getTodayISO } from "../api";
import type { EntregaListItem } from "../types";
import FormEntregaConcluida from "../components/FormEntregaConcluida";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { geocodeAddress } from "../utils/geocode";
import { SERVICO_ORDER, servicoTipo, type ServicoTipo } from "../utils/servico";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { useThemeStore } from "../../../store/themeStore";
import { useAuthStore } from "../../../store/authStore";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";

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

const SERVICO_INICIAL: Record<string, string> = {
  Shopee: "S",
  Flex: "F",
  Avulso: "A",
};

const defaultExpanded: Record<string, boolean> = { Shopee: false, Flex: false, Avulso: false };

const DEFAULT_REGION = { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.05, longitudeDelta: 0.05 };
type ServiceSection = { section: ServicoTipo; data: EntregaListItem[] };

export default function EntregasListScreen({ navigation }: Props) {
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
        searchBtn: {
          backgroundColor: colors.primary,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        searchBtnText: { color: colors.primaryContrast, fontWeight: "700" },
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
        thumbWrap: { marginTop: 10, borderRadius: 8, overflow: "hidden", alignSelf: "flex-start" },
        thumbImage: { width: 92, height: 92, borderRadius: 8, backgroundColor: colors.background },
        thumbHint: { marginTop: 6, fontSize: 12, color: colors.textSecondary },
        imageViewerOverlay: { flex: 1, backgroundColor: "#000" },
        imageViewerHeader: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: "rgba(0,0,0,0.3)",
        },
        imageViewerClose: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
        imageViewerTitle: { color: "#fff", fontSize: 14 },
        imageViewerImage: { flex: 1, resizeMode: "contain" },
        scanOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
        scanPanel: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
        },
        scanTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 6 },
        scanSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
        scanCloseBtn: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
        scanCloseText: { color: colors.primary, fontWeight: "600" },
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
        listContent: { padding: 16, paddingBottom: 32 },
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
      }),
    [colors]
  );
  const [tab, setTab] = useState<Tab>("pendente");
  const [list, setList] = useState<EntregaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedServico, setExpandedServico] = useState<Record<string, boolean>>(defaultExpanded);
  const [saving, setSaving] = useState(false);

  const {
    pendingDeliveries,
    deliveriesWithAddress,
    deliveriesWithoutAddress,
    mapMode,
    setMapMode,
    setRouteDeliveries,
    activeRouteId,
    clearActiveRouteState,
    selectedDelivery,
    setSelectedDelivery,
    loadDeliveries,
    markDelivered,
    suggestedOrder,
    loading: storeLoading,
  } = useDeliveryStore();
  const [showNavegarModal, setShowNavegarModal] = useState(false);
  const [showEntregueModal, setShowEntregueModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<number, { latitude: number; longitude: number }>>({});
  const [selectedMarkerCount, setSelectedMarkerCount] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ originalLatitude: number; originalLongitude: number } | null>(null);
  const selectedGroupRef = useRef<{ originalLatitude: number; originalLongitude: number } | null>(null);
  const [listFinalizadas, setListFinalizadas] = useState<EntregaListItem[]>([]);
  const [listAusentes, setListAusentes] = useState<EntregaListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [visualizadorImagem, setVisualizadorImagem] = useState<{ visible: boolean; codigo: string; uri: string | null }>({
    visible: false,
    codigo: "",
    uri: null,
  });
  const [thumbBySaida, setThumbBySaida] = useState<Record<number, string>>({});
  const [loadingThumb, setLoadingThumb] = useState<Record<number, boolean>>({});
  const scanLockedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const geocodedIdsRef = useRef<Set<number>>(new Set());
  const mapRef = useRef<MapView>(null);
  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const setSomenteHojePendentes = useMotoboyPrefsStore((s) => s.setSomenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const token = useAuthStore((s) => s.token);

  const listForTab = (tab === "pendente" ? pendingDeliveries : list) ?? [];
  const loadingForTab = tab === "pendente" ? storeLoading : loading;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const shouldFilterToday = somenteHojePendentes && (tab === "finalizadas" || tab === "ausentes");
      const params = shouldFilterToday ? { dia: "hoje" as const, data: getTodayISO() } : undefined;
      const data = await getEntregas(tab, params);
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [tab, somenteHojePendentes]);

  useFocusEffect(
    useCallback(() => {
      if (tab === "pendente") {
        loadDeliveries({ onlyToday: somenteHojePendentes });
      } else {
        load();
      }
    }, [tab, loadDeliveries, load, somenteHojePendentes])
  );

  useEffect(() => {
    if (mapMode !== "map" || tab !== "pendente") return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(coords);
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            if (cancelled) return;
            const { latitude, longitude } = location.coords;
            setUserLocation({ latitude, longitude });
            mapRef.current?.animateToRegion({
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        );
      } catch {
        // ignora falha de localização
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [mapMode, tab]);

  const loadMapListsRef = useRef(false);
  useEffect(() => {
    if (mapMode !== "map" || tab !== "pendente") return;
    loadMapListsRef.current = false;
    (async () => {
      try {
        const params = somenteHojePendentes ? { dia: "hoje" as const, data: getTodayISO() } : undefined;
        const [fin, aus] = await Promise.all([
          getEntregas("finalizadas", params),
          getEntregas("ausentes", params),
        ]);
        if (!loadMapListsRef.current) {
          setListFinalizadas(fin ?? []);
          setListAusentes(aus ?? []);
        }
      } catch {
        if (!loadMapListsRef.current) {
          setListFinalizadas([]);
          setListAusentes([]);
        }
      }
    })();
    return () => { loadMapListsRef.current = true; };
  }, [mapMode, tab, somenteHojePendentes]);

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
    () =>
      listWithSections.reduce(
        (acc, section) => {
          acc[section.section] = section.data.length;
          return acc;
        },
        { Shopee: 0, Flex: 0, Avulso: 0 }
      ),
    [listWithSections]
  );

  const totalGeral = useMemo(
    () => totalByService.Shopee + totalByService.Flex + totalByService.Avulso,
    [totalByService]
  );

  const entregasComCoords = useMemo(
    () => (listForTab ?? []).filter((d) => d.latitude != null && d.longitude != null),
    [listForTab]
  );

  type MapMarkerStatus = "pendente" | "entregue" | "ausente";
  type ItemComCoords = EntregaListItem & { latitude: number; longitude: number; mapStatus: MapMarkerStatus };

  const listaUnicaParaMapa = useMemo(() => {
    if (tab !== "pendente") return [];
    const withCoords = (d: EntregaListItem, status: MapMarkerStatus): ItemComCoords | null => {
      const lat = d.latitude ?? geocodedCoords[d.id_saida]?.latitude;
      const lon = d.longitude ?? geocodedCoords[d.id_saida]?.longitude;
      if (lat == null || lon == null) return null;
      return { ...d, latitude: lat, longitude: lon, mapStatus: status };
    };
    const pendentes = (pendingDeliveries ?? []).map((d) => withCoords(d, "pendente")).filter(Boolean) as ItemComCoords[];
    const finalizadas = listFinalizadas.map((d) => withCoords(d, "entregue")).filter(Boolean) as ItemComCoords[];
    const ausentes = listAusentes.map((d) => withCoords(d, "ausente")).filter(Boolean) as ItemComCoords[];
    return [...pendentes, ...finalizadas, ...ausentes];
  }, [tab, pendingDeliveries, listFinalizadas, listAusentes, geocodedCoords]);

  const gruposNoMapa = useMemo(() => {
    const list = listaUnicaParaMapa;
    const key = (lat: number, lon: number, tipo: string, status: MapMarkerStatus) =>
      `${Number(lat.toFixed(6))}_${Number(lon.toFixed(6))}_${tipo}_${status}`;
    const map = new Map<
      string,
      { latitude: number; longitude: number; tipo: string; status: MapMarkerStatus; items: ItemComCoords[] }
    >();
    for (const d of list) {
      const tipo = servicoTipo(d.servico);
      const k = key(d.latitude, d.longitude, tipo, d.mapStatus);
      const existing = map.get(k);
      if (existing) {
        existing.items.push(d);
      } else {
        map.set(k, {
          latitude: d.latitude,
          longitude: d.longitude,
          tipo,
          status: d.mapStatus,
          items: [d],
        });
      }
    }
    return Array.from(map.values());
  }, [listaUnicaParaMapa]);

  const OFFSET_DEG = 0.00012;
  type GrupoComDeslocamento = {
    latitude: number;
    longitude: number;
    originalLatitude: number;
    originalLongitude: number;
    tipo: string;
    status: MapMarkerStatus;
    items: ItemComCoords[];
  };
  const gruposComDeslocamento = useMemo((): GrupoComDeslocamento[] => {
    const pointKey = (lat: number, lon: number) => `${Number(lat.toFixed(6))}_${Number(lon.toFixed(6))}`;
    const byPoint = new Map<string, typeof gruposNoMapa>();
    for (const g of gruposNoMapa) {
      const k = pointKey(g.latitude, g.longitude);
      if (!byPoint.has(k)) byPoint.set(k, []);
      byPoint.get(k)!.push(g);
    }
    return gruposNoMapa.map((g) => {
      const k = pointKey(g.latitude, g.longitude);
      const noMesmoPonto = byPoint.get(k)!;
      const originalLat = g.latitude;
      const originalLon = g.longitude;
      if (noMesmoPonto.length <= 1) {
        return { ...g, originalLatitude: originalLat, originalLongitude: originalLon };
      }
      const idx = noMesmoPonto.indexOf(g);
      const n = noMesmoPonto.length;
      const angleRad = (idx * (2 * Math.PI)) / n;
      const dLat = OFFSET_DEG * Math.cos(angleRad);
      const dLon = (OFFSET_DEG / Math.cos((g.latitude * Math.PI) / 180)) * Math.sin(angleRad);
      return {
        ...g,
        latitude: g.latitude + dLat,
        longitude: g.longitude + dLon,
        originalLatitude: originalLat,
        originalLongitude: originalLon,
      };
    });
  }, [gruposNoMapa]);

  const listaPedidosNoEndereco = useMemo(() => {
    if (!selectedGroup) return [];
    return gruposComDeslocamento
      .filter(
        (g) =>
          Number(g.originalLatitude.toFixed(6)) === Number(selectedGroup.originalLatitude.toFixed(6)) &&
          Number(g.originalLongitude.toFixed(6)) === Number(selectedGroup.originalLongitude.toFixed(6))
      )
      .flatMap((g) => g.items);
  }, [selectedGroup, gruposComDeslocamento]);

  const totalNoEndereco = listaPedidosNoEndereco.length;
  const finalizadosNoEndereco = listaPedidosNoEndereco.filter((i) => i.mapStatus !== "pendente").length;
  const pendentesNoEndereco = listaPedidosNoEndereco.filter((i) => i.mapStatus === "pendente").length;
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
    if (mapMode !== "map" || tab !== "pendente") return;
    const list = [
      ...(pendingDeliveries ?? []),
      ...listFinalizadas,
      ...listAusentes,
    ];
    const toGeocode = list.filter(
      (d) =>
        (d.possui_endereco || (d.endereco_formatado ?? "").trim() || (d.endereco ?? "").trim()) &&
        (d.latitude == null || d.longitude == null) &&
        !geocodedIdsRef.current.has(d.id_saida)
    );
    if (toGeocode.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const d of toGeocode) {
        if (cancelled) break;
        geocodedIdsRef.current.add(d.id_saida);
        const address = (d.endereco_formatado || d.endereco || "").trim();
        if (!address) continue;
        const coords = await geocodeAddress(address, { cidade: d.bairro ?? undefined, estado: undefined });
        if (cancelled || !coords) continue;
        setGeocodedCoords((prev) => ({ ...prev, [d.id_saida]: coords }));
        await new Promise((r) => setTimeout(r, 1100));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapMode, tab, pendingDeliveries, listFinalizadas, listAusentes]);

  const firstDestWithCoords = useMemo(
    () => orderedPendentes.find((d) => d.latitude != null && d.longitude != null),
    [orderedPendentes]
  );

  const abrirAcoesOuBloquear = useCallback(
    (item: EntregaListItem) => {
      const statusNorm = String(item.status || item.exibicao || "").trim().toLowerCase();
      if (statusNorm.includes("entreg") || statusNorm.includes("cancel")) {
        Alert.alert("Bloqueado", `Pedido ${item.codigo ?? ""} está com status final (${item.exibicao || item.status}).`);
        return;
      }
      setSelectedGroup(null);
      setSelectedDelivery(item);
      setSelectedMarkerCount(1);
    },
    [setSelectedDelivery]
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
        const finalizado = [...(listFinalizadas ?? []), ...(listAusentes ?? [])].find(
          (d) => String(d.codigo ?? "").trim().toLowerCase() === codigo
        );
        if (finalizado) {
          Alert.alert("Bloqueado", `Pedido ${finalizado.codigo ?? ""} está com status final (${finalizado.exibicao || finalizado.status}).`);
          return;
        }
      }
      if (!item) {
        Alert.alert("Não encontrado", "Código não está nos pendentes carregados ou já está finalizado/cancelado.");
        return;
      }
      abrirAcoesOuBloquear(item);
    },
    [pendingDeliveries, listFinalizadas, listAusentes, abrirAcoesOuBloquear]
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

  const loadThumbIfNeeded = useCallback(
    async (idSaida: number) => {
      if (thumbBySaida[idSaida] || loadingThumb[idSaida]) return;
      setLoadingThumb((prev) => ({ ...prev, [idSaida]: true }));
      try {
        const data = await getComprovanteWatermark(idSaida);
        const relative = data.image_url?.trim();
        if (data.tem_comprovante && relative) {
          const full = relative.startsWith("http") ? relative : `${API_BASE_URL.replace(/\/api$/, "")}${relative}`;
          setThumbBySaida((prev) => ({ ...prev, [idSaida]: full }));
        }
      } catch {
        // não bloqueia listagem
      } finally {
        setLoadingThumb((prev) => ({ ...prev, [idSaida]: false }));
      }
    },
    [thumbBySaida, loadingThumb]
  );

  useEffect(() => {
    if (tab !== "finalizadas") return;
    const target = (listForTab ?? []).filter((i) => !!i.tem_comprovante).slice(0, 20);
    target.forEach((item) => {
      void loadThumbIfNeeded(item.id_saida);
    });
  }, [tab, listForTab, loadThumbIfNeeded]);

  const openGoogleMaps = useCallback(() => {
    if (!firstDestWithCoords?.latitude || !firstDestWithCoords?.longitude) {
      Alert.alert("Aviso", "Nenhuma entrega com endereço para navegação.");
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${firstDestWithCoords.latitude},${firstDestWithCoords.longitude}`;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o Google Maps."));
    setShowNavegarModal(false);
  }, [firstDestWithCoords]);

  const openWaze = useCallback(() => {
    if (!firstDestWithCoords?.latitude || !firstDestWithCoords?.longitude) {
      Alert.alert("Aviso", "Nenhuma entrega com endereço para navegação.");
      return;
    }
    const url = `https://waze.com/ul?ll=${firstDestWithCoords.latitude},${firstDestWithCoords.longitude}&navigate=yes`;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o Waze."));
    setShowNavegarModal(false);
  }, [firstDestWithCoords]);

  const openNavegador = useCallback(() => {
    if (!firstDestWithCoords?.latitude || !firstDestWithCoords?.longitude) {
      Alert.alert("Aviso", "Nenhuma entrega com endereço para navegação.");
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${firstDestWithCoords.latitude},${firstDestWithCoords.longitude}`;
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir."));
    setShowNavegarModal(false);
  }, [firstDestWithCoords]);
  const mapRegion = useMemo(() => {
    if (userLocation) {
      return {
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    if (gruposComDeslocamento.length === 0) return DEFAULT_REGION;
    const lats = gruposComDeslocamento.map((g) => g.latitude);
    const lons = gruposComDeslocamento.map((g) => g.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5 || 0.05),
      longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.5 || 0.05),
    };
  }, [userLocation, gruposComDeslocamento]);

  const fecharSheetERestaurarLista = useCallback(() => {
    setSelectedDelivery(null);
    setSelectedMarkerCount(null);
    if (selectedGroupRef.current) {
      setSelectedGroup(selectedGroupRef.current);
      selectedGroupRef.current = null;
    }
  }, []);

  const handleAbrirEntregueModal = useCallback(() => setShowEntregueModal(true), []);

  const handleEntregueModalSuccess = useCallback(() => {
    if (!selectedDelivery) return;
    const lat = selectedDelivery.latitude ?? geocodedCoords[selectedDelivery.id_saida]?.latitude;
    const lon = selectedDelivery.longitude ?? geocodedCoords[selectedDelivery.id_saida]?.longitude;
    if (lat != null && lon != null) {
      setListFinalizadas((prev) => [...prev, { ...selectedDelivery, latitude: lat, longitude: lon }]);
    }
    setShowEntregueModal(false);
    fecharSheetERestaurarLista();
  }, [selectedDelivery, geocodedCoords, fecharSheetERestaurarLista]);

  const handleMarcarAusente = useCallback(
    (item: EntregaListItem) => {
      const lat = (item as ItemComCoords).latitude ?? geocodedCoords[item.id_saida]?.latitude;
      const lon = (item as ItemComCoords).longitude ?? geocodedCoords[item.id_saida]?.longitude;
      if (lat != null && lon != null) {
        setListAusentes((prev) => [...prev, { ...item, latitude: lat, longitude: lon }]);
      }
      fecharSheetERestaurarLista();
      navigation.navigate("EntregaDetail", { idSaida: item.id_saida });
    },
    [geocodedCoords, navigation, fecharSheetERestaurarLista]
  );


  const toggleServico = (s: string) => {
    setExpandedServico((prev) => ({ ...prev, [s]: !prev[s] }));
  };

  const handleToggleSomenteHoje = useCallback(
    async (value: boolean) => {
      await setSomenteHojePendentes(value);
      await loadDeliveries({ onlyToday: value });
    },
    [setSomenteHojePendentes, loadDeliveries]
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

      {tab === "pendente" && listForTab.length > 0 && roteirizacaoHabilitada && (
        <TouchableOpacity
          style={styles.btnSugerirRota}
          onPress={() => {
            if (deliveriesWithAddress.length === 0) {
              Alert.alert("Atenção", "Nenhuma entrega possui endereço válido.", [
                { text: "OK", style: "cancel" },
                { text: "Adicionar endereços", onPress: () => navigation.navigate("PrepareDeliveries") },
              ]);
              return;
            }
            if (deliveriesWithoutAddress.length > 0) {
              const x = deliveriesWithoutAddress.length;
              Alert.alert(
                "Criar Rota",
                `${x} entrega${x !== 1 ? "s" : ""} não possuem endereço e não entrarão na rota.`,
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Criar rota parcial",
                    onPress: () => {
                      try {
                        if (activeRouteId === null) clearActiveRouteState();
                        setRouteDeliveries(deliveriesWithAddress);
                        navigation.navigate("RouteBuilder");
                      } catch (e) {
                        console.error("[Criar rota parcial] crash:", e);
                        Alert.alert(
                          "Erro",
                          `Erro ao criar rota parcial: ${e instanceof Error ? e.message : String(e)}. Conecte o celular ao PC e use "adb logcat" para ver o log completo.`
                        );
                      }
                    },
                  },
                  {
                    text: "Adicionar endereços",
                    onPress: () => navigation.navigate("PrepareDeliveries"),
                  },
                ]
              );
            } else {
              try {
                if (activeRouteId === null) clearActiveRouteState();
                setRouteDeliveries(deliveriesWithAddress);
                navigation.navigate("RouteBuilder");
              } catch (e) {
                console.error("[Sugerir Rota] crash:", e);
                Alert.alert(
                  "Erro",
                  `Erro ao sugerir rota: ${e instanceof Error ? e.message : String(e)}. Conecte o celular ao PC e use "adb logcat" para ver o log completo.`
                );
              }
            }
          }}
        >
          <Text style={styles.btnSugerirRotaText}>
            {deliveriesWithoutAddress.length > 0 ? "🧭 Criar Rota" : "🧭 Sugerir Rota"}
          </Text>
        </TouchableOpacity>
      )}

      {tab === "pendente" && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar código pendente"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => processarBuscaOuScan(searchQuery)}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => processarBuscaOuScan(searchQuery)}>
            <Text style={styles.searchBtnText}>Ir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBtn} onPress={() => void openScanner()}>
            <Text style={styles.searchBtnText}>Scan</Text>
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

      {tab === "pendente" && (
        <View style={styles.toggleRow}>
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
        </View>
      )}

      {!loadingForTab && (
        <View style={styles.cardsRow}>
          <View style={styles.cardTotal}>
            <Text style={styles.servicoCardLabel}>{TAB_LABELS[tab]}</Text>
            <Text style={styles.servicoCardValue}>{totalGeral}</Text>
          </View>
        </View>
      )}

      {loadingForTab ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : tab === "pendente" && mapMode === "map" ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            region={mapRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {gruposComDeslocamento.map((grupo, idx) => {
              const first = grupo.items[0];
              const count = grupo.items.length;
              const onPress = () => {
                if (count > 1) {
                  setSelectedGroup({ originalLatitude: grupo.originalLatitude, originalLongitude: grupo.originalLongitude });
                  setSelectedDelivery(null);
                  setSelectedMarkerCount(null);
                } else {
                  setSelectedGroup(null);
                  setSelectedDelivery(first);
                  setSelectedMarkerCount(1);
                }
              };
              if (grupo.status === "entregue") {
                return (
                  <Marker
                    key={`entregue-${idx}-${grupo.latitude}-${grupo.longitude}`}
                    coordinate={{ latitude: grupo.latitude, longitude: grupo.longitude }}
                    onPress={onPress}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={[styles.markerWrap, styles.markerEntregue]}>
                      <Text style={styles.markerIconText}>✓</Text>
                      {count > 1 && <View style={styles.markerCountBadge}><Text style={styles.markerCountText}>{count}</Text></View>}
                    </View>
                  </Marker>
                );
              }
              if (grupo.status === "ausente") {
                return (
                  <Marker
                    key={`ausente-${idx}-${grupo.latitude}-${grupo.longitude}`}
                    coordinate={{ latitude: grupo.latitude, longitude: grupo.longitude }}
                    onPress={onPress}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={[styles.markerWrap, styles.markerAusente]}>
                      <Text style={styles.markerIconText}>✕</Text>
                      {count > 1 && <View style={styles.markerCountBadge}><Text style={styles.markerCountText}>{count}</Text></View>}
                    </View>
                  </Marker>
                );
              }
              const cor = SERVICO_COLORS[grupo.tipo] || "#999";
              const inicial = SERVICO_INICIAL[grupo.tipo] || "?";
              const textoClaro = grupo.tipo !== "Flex";
              return (
                <Marker
                  key={`pendente-${idx}-${grupo.latitude}-${grupo.longitude}-${grupo.tipo}`}
                  coordinate={{ latitude: grupo.latitude, longitude: grupo.longitude }}
                  onPress={onPress}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={[styles.markerWrap, { backgroundColor: cor }]}>
                    <Text style={[styles.markerInicialText, { color: textoClaro ? "#fff" : "#333" }]}>{inicial}</Text>
                    {count > 1 && <View style={styles.markerCountBadge}><Text style={styles.markerCountText}>{count}</Text></View>}
                  </View>
                </Marker>
              );
            })}
          </MapView>
          <Modal visible={!!selectedGroup} transparent animationType="slide">
            <TouchableOpacity
              style={styles.bottomSheetOverlay}
              activeOpacity={1}
              onPress={() => setSelectedGroup(null)}
            />
            <View style={[styles.listSheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
              <Text style={styles.listSheetTitle}>Pedidos neste endereço</Text>
              <Text style={styles.listSheetSubtitle}>
                {finalizadosNoEndereco} de {totalNoEndereco} finalizados
                {pendentesNoEndereco > 0 ? ` · ${pendentesNoEndereco} pendente${pendentesNoEndereco > 1 ? "s" : ""}` : ""}
              </Text>
              <FlatList
                data={listaPedidosNoEndereco}
                keyExtractor={(item) => String(item.id_saida)}
                style={styles.listSheetList}
                renderItem={({ item }) => {
                  const isPendente = item.mapStatus === "pendente";
                  const statusLabel = item.mapStatus === "entregue" ? "Entregue" : item.mapStatus === "ausente" ? "Ausente" : "Pendente";
                  const statusStyle = item.mapStatus === "entregue" ? styles.badgeEntregue : item.mapStatus === "ausente" ? styles.badgeAusente : styles.badgePendente;
                  return (
                    <TouchableOpacity
                      style={[styles.listSheetItem, !isPendente && styles.listSheetItemDisabled]}
                      onPress={() => {
                        if (!isPendente) return;
                        selectedGroupRef.current = selectedGroup;
                        handleSelectBuscaDigitada(item);
                      }}
                      disabled={!isPendente}
                    >
                      <View style={styles.listSheetItemLeft}>
                        <Text style={styles.listSheetItemCodigo}>{item.codigo ?? "—"}</Text>
                        <Text style={styles.listSheetItemCliente}>{item.cliente ?? "—"}</Text>
                      </View>
                      <View style={[styles.badge, statusStyle]}>
                        <Text style={styles.badgeText}>{statusLabel}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
              <TouchableOpacity style={styles.bottomSheetFechar} onPress={() => setSelectedGroup(null)}>
                <Text style={styles.bottomSheetFecharText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </Modal>

          <Modal visible={!!selectedDelivery} transparent animationType="slide">
            <TouchableOpacity
              style={styles.bottomSheetOverlay}
              activeOpacity={1}
              onPress={fecharSheetERestaurarLista}
            />
            <View style={[styles.bottomSheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
              {selectedDelivery && (
                <>
                  <Text style={styles.bottomSheetTitle}>{selectedDelivery.codigo ?? "—"}</Text>
                  <Text style={styles.bottomSheetCliente}>{selectedDelivery.cliente ?? "—"}</Text>
                  {selectedMarkerCount != null && selectedMarkerCount > 1 && (
                    <Text style={styles.bottomSheetGrupoInfo}>{selectedMarkerCount} entregas neste endereço</Text>
                  )}
                  <Text style={styles.bottomSheetEndereco}>
                    {selectedDelivery.endereco_formatado || selectedDelivery.endereco || "—"}
                  </Text>
                  {(pendingDeliveries ?? []).some((d) => d.id_saida === selectedDelivery.id_saida) ? (
                    <View style={styles.bottomSheetActions}>
                      <TouchableOpacity
                        style={styles.bottomSheetBtnEntregue}
                        onPress={handleAbrirEntregueModal}
                      >
                        <Text style={styles.bottomSheetBtnText}>Marcar como entregue</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.bottomSheetBtnAusente, saving && styles.btnDisabled]}
                        onPress={() => handleMarcarAusente(selectedDelivery)}
                        disabled={saving}
                      >
                        <Text style={styles.bottomSheetBtnText}>Marcar como ausente</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.bottomSheetBtnVerDetalhes}
                      onPress={() => navigation.navigate("EntregaDetail", { idSaida: selectedDelivery.id_saida })}
                    >
                      <Text style={styles.bottomSheetBtnText}>Ver detalhes</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.bottomSheetFechar} onPress={fecharSheetERestaurarLista}>
                    <Text style={styles.bottomSheetFecharText}>Fechar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Modal>

          <FormEntregaConcluida
            visible={showEntregueModal && !!selectedDelivery}
            idSaida={selectedDelivery?.id_saida ?? 0}
            destinatarioPreenchido={selectedDelivery?.cliente ?? selectedDelivery?.endereco_formatado?.split(",")[0] ?? undefined}
            onConfirm={async (body) => {
              if (selectedDelivery) await markDelivered(selectedDelivery.id_saida, body);
            }}
            onClose={() => setShowEntregueModal(false)}
            onSuccess={handleEntregueModalSuccess}
          />

          <Modal visible={showNavegarModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Navegar com</Text>
                <Text style={styles.modalMessage}>
                  Abrir primeiro destino da rota sugerida em:
                </Text>
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
        <FlatList
          data={listWithSections}
          keyExtractor={(sec, idx) => sec.section ? sec.section : `list-${idx}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: section }) => {
            const isExpanded = !section.section || expandedServico[section.section] !== false;
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
                {isExpanded &&
                  section.data.map((item) => (
                    <TouchableOpacity
                      key={item.id_saida}
                      style={[styles.item, getServiceRowStyle(section.section)]}
                      onPress={() =>
                        tab === "pendente"
                          ? handleSelectBuscaDigitada(item)
                          : navigation.navigate("EntregaDetail", { idSaida: item.id_saida })
                      }
                    >
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
                      {tab === "finalizadas" && item.tem_comprovante && (
                        <TouchableOpacity
                          style={styles.thumbWrap}
                          onPress={() => {
                            const uri = thumbBySaida[item.id_saida] ?? null;
                            if (!uri) {
                              void loadThumbIfNeeded(item.id_saida);
                              Alert.alert("Aguarde", "Carregando comprovante...");
                              return;
                            }
                            setVisualizadorImagem({ visible: true, codigo: item.codigo ?? "", uri });
                          }}
                        >
                          {thumbBySaida[item.id_saida] ? (
                            <Image
                              source={{
                                uri: thumbBySaida[item.id_saida],
                                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                              }}
                              style={styles.thumbImage}
                            />
                          ) : (
                            <View style={[styles.thumbImage, { justifyContent: "center", alignItems: "center" }]}>
                              {loadingThumb[item.id_saida] ? (
                                <ActivityIndicator />
                              ) : (
                                <Text style={styles.thumbHint}>Sem preview</Text>
                              )}
                            </View>
                          )}
                          <Text style={styles.thumbHint}>Toque para ampliar</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
              </View>
            );
          }}
        />
      )}
      <Modal visible={scannerVisible} transparent animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.imageViewerOverlay}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scanOverlay}>
            <View style={[styles.scanPanel, { paddingBottom: Math.max(16, insets.bottom) }]}>
              <Text style={styles.scanTitle}>Escanear pedido pendente</Text>
              <Text style={styles.scanSubtitle}>Aponte para o QR Code da etiqueta.</Text>
              <TouchableOpacity style={styles.scanCloseBtn} onPress={() => setScannerVisible(false)}>
                <Text style={styles.scanCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={visualizadorImagem.visible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setVisualizadorImagem({ visible: false, codigo: "", uri: null })}
      >
        <View style={styles.imageViewerOverlay}>
          <View style={[styles.imageViewerHeader, { paddingTop: Math.max(14, insets.top) }]}>
            <TouchableOpacity onPress={() => setVisualizadorImagem({ visible: false, codigo: "", uri: null })}>
              <Text style={styles.imageViewerClose}>Fechar</Text>
            </TouchableOpacity>
            <Text style={styles.imageViewerTitle}>Comprovante {visualizadorImagem.codigo ? `- ${visualizadorImagem.codigo}` : ""}</Text>
          </View>
          {visualizadorImagem.uri ? (
            <Image
              source={{
                uri: visualizadorImagem.uri,
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              }}
              style={styles.imageViewerImage}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
