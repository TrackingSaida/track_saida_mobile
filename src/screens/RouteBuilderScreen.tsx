import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  Dimensions,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useThemeColors } from "../theme/colors";
import { HeaderBackButton } from "../components/ScreenHeaderBar";
import DeliveryMap from "../components/DeliveryMap";
import RouteBottomSheet from "../components/RouteBottomSheet";
import RouteMarkerCard from "../components/RouteMarkerCard";
import RouteSequenceStrip from "../components/RouteSequenceStrip";
import FormEntregaConcluida from "../features/entregas/components/FormEntregaConcluida";
import FormAusenteModal from "../features/entregas/components/FormAusenteModal";
import type { MarcacaoEntregaResponse } from "../features/entregas/types";
import { getEntrega } from "../features/entregas/api";
import { useDeliveryStore } from "../store/deliveryStore";
import {
  getOrderedRouteDeliveries,
  computeRouteStats,
  groupOrderedByAddress,
  computeRouteStatsFromGroups,
  computeRouteHeaderStats,
  getActiveGroupIndex,
  getFirstPendingInGroup,
  getPendingDeliveriesInGroup,
  getNextPendingGroupIndex,
  getEffectiveCurrentGroupIndex,
  getEffectiveCurrentGroupNumber,
  formatStopAddressLines,
  type GroupedStop,
} from "../features/entregas/utils/routeUtils";
import { useActiveRoutePolyline } from "../features/entregas/hooks/useActiveRoutePolyline";
import NextStopNavigationSheet from "../features/entregas/components/NextStopNavigationSheet";
import { resolveGroupNavigationTarget } from "../features/entregas/utils/externalNavigation";
import RoutePartialReviewModal from "../features/entregas/components/RoutePartialReviewModal";
import RouteStopPedidosModal from "../features/entregas/components/RouteStopPedidosModal";
import RouteStopActionSheet from "../features/entregas/components/RouteStopActionSheet";
import RouteEditAddressSheet from "../features/entregas/components/RouteEditAddressSheet";
import RouteLocatePackageSheet from "../features/entregas/components/RouteLocatePackageSheet";
import RouteQuickAddSheet from "../features/entregas/components/RouteQuickAddSheet";
import RouteBulkImportSheet from "../features/entregas/components/RouteBulkImportSheet";
import RouteReadySummaryCard from "../features/entregas/components/RouteReadySummaryCard";
import RouteAdvancedMenuSheet from "../features/entregas/components/RouteAdvancedMenuSheet";
import PrepSeparatePackagesSheet from "../features/entregas/components/PrepSeparatePackagesSheet";
import RoutePriorityModal from "../features/entregas/components/RoutePriorityModal";
import { routePriorityLabel } from "../features/entregas/utils/routePriority";
import type { AddressFormValues, AddressOrigem } from "../features/entregas/components/AddressForm";
import { playSound } from "../utils/sound";
import { runPostFinalizeFeedback } from "../features/entregas/utils/finalizeEntregaFeedback";
import { formatApiError } from "../utils/formatApiError";
import { inferCoordPrecision, isValidGeocodeCoords, type GeocodeResult } from "../features/entregas/utils/geocode";
import { extractAddressFields } from "../features/entregas/utils/addressBuild";
import {
  countUntrustedDeliveries,
  resolveDeliveryDestination,
  needsStoredCoordsValidation,
  validateStoredCoordsAgainstAddress,
  type GeocodedMetaMap,
  type LegacyValidationCache,
} from "../features/entregas/utils/deliveryDestination";
import { geocodeAddressStrict } from "../features/entregas/utils/geocodeStrict";
import type { EntregaListItem } from "../features/entregas/types";
import { useMotoboyPrefsStore } from "../store/motoboyPrefsStore";
import { runOptimizeRouteWithFeedback } from "../features/entregas/utils/optimizeRouteFeedback";
import {
  deliveryNeedsAddressForRoute,
  notifyPendingAdded,
} from "../features/entregas/utils/postScanRouteFlow";
import PulsingTouchable from "../components/PulsingTouchable";

const LOCATE_PACKAGE_LABEL = "Buscar pacote e anotar parada";
const LOCATE_PACKAGE_HINT =
  "Anote o número da parada em cada pacote. Busque pelo código antes de sair.";

type Props = NativeStackScreenProps<RootStackParamList, "RouteBuilder">;

type NavSheetTarget = { group: GroupedStop; stopNumber: number };

export default function RouteBuilderScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [selectedDelivery, setSelectedDelivery] = useState<EntregaListItem | null>(null);
  const [showAusenteModal, setShowAusenteModal] = useState(false);
  const [deliveryForAusente, setDeliveryForAusente] = useState<EntregaListItem | null>(null);
  const [pendingAusenteIds, setPendingAusenteIds] = useState<number[]>([]);
  const [ausenteBatchCount, setAusenteBatchCount] = useState(1);
  const [navSheetTarget, setNavSheetTarget] = useState<NavSheetTarget | null>(null);

  const markDelivered = useDeliveryStore((s) => s.markDelivered);
  const markAbsent = useDeliveryStore((s) => s.markAbsent);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const activeRouteId = useDeliveryStore((s) => s.activeRouteId);
  const routeDistanceM = useDeliveryStore((s) => s.routeDistanceM);
  const routeDurationS = useDeliveryStore((s) => s.routeDurationS);
  const routeOptimizationMode = useDeliveryStore((s) => s.routeOptimizationMode);
  const acknowledgeRouteSeparation = useDeliveryStore((s) => s.acknowledgeRouteSeparation);
  const routeSeparationAcknowledged = useDeliveryStore((s) => s.routeSeparationAcknowledged);
  const activeStopIndex = useDeliveryStore((s) => s.activeStopIndex);
  const startActiveRoute = useDeliveryStore((s) => s.startActiveRoute);
  const optimizeRoute = useDeliveryStore((s) => s.optimizeRoute);
  const saveAddress = useDeliveryStore((s) => s.saveAddress);
  const removeFromRoute = useDeliveryStore((s) => s.removeFromRoute);
  const moveGroupedStopToIndex = useDeliveryStore((s) => s.moveGroupedStopToIndex);
  const moveGroupedStopToStart = useDeliveryStore((s) => s.moveGroupedStopToStart);
  const moveGroupedStopToEnd = useDeliveryStore((s) => s.moveGroupedStopToEnd);
  const updateRouteDelivery = useDeliveryStore((s) => s.updateRouteDelivery);
  const findInRouteByQuery = useDeliveryStore((s) => s.findInRouteByQuery);
  const reoptimizeFromGroupAnchor = useDeliveryStore((s) => s.reoptimizeFromGroupAnchor);
  const restoreOriginalRoute = useDeliveryStore((s) => s.restoreOriginalRoute);
  const reoptimizeFullRoute = useDeliveryStore((s) => s.reoptimizeFullRoute);
  const cancelActiveRoute = useDeliveryStore((s) => s.cancelActiveRoute);
  const rebuildRouteFromPendentes = useDeliveryStore((s) => s.rebuildRouteFromPendentes);
  const routeManuallyAdjusted = useDeliveryStore((s) => s.routeManuallyAdjusted);
  const routeAdjustMode = useDeliveryStore((s) => s.routeAdjustMode);
  const routeOriginalOrder = useDeliveryStore((s) => s.routeOriginalOrder);
  const appendToRoute = useDeliveryStore((s) => s.appendToRoute);
  const appendToRouteAtEnd = useDeliveryStore((s) => s.appendToRouteAtEnd);
  const pendingDeliveries = useDeliveryStore((s) => s.pendingDeliveries);
  const pendingAddToRouteIdRef = useRef<number | null>(null);

  const isRouteActive = activeRouteId != null;

  const [centerOnStopId, setCenterOnStopId] = useState<number | null>(null);
  const [iniciandoRota, setIniciandoRota] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [actionSheetGroup, setActionSheetGroup] = useState<GroupedStop | null>(null);
  const [actionSheetStopIndex, setActionSheetStopIndex] = useState(1);
  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [pedidosGroup, setPedidosGroup] = useState<GroupedStop | null>(null);
  const [editDelivery, setEditDelivery] = useState<EntregaListItem | null>(null);
  const [showLocateSheet, setShowLocateSheet] = useState(false);
  const [showLocateHint, setShowLocateHint] = useState(false);
  const [showSeparationSheet, setShowSeparationSheet] = useState(false);
  const [routeListCollapsed, setRouteListCollapsed] = useState(true);
  const [optimizingHeader, setOptimizingHeader] = useState(false);
  const [recalculatingRoute, setRecalculatingRoute] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const [routeActionLoading, setRouteActionLoading] = useState(false);
  const [pendingEntregueIds, setPendingEntregueIds] = useState<number[] | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<number, { latitude: number; longitude: number }>>({});
  const [geocodedMeta, setGeocodedMeta] = useState<GeocodedMetaMap>({});
  const [legacyValidationCache, setLegacyValidationCache] = useState<LegacyValidationCache>({});
  const legacyValidationCacheRef = useRef(legacyValidationCache);
  legacyValidationCacheRef.current = legacyValidationCache;
  const currentLocation = useDeliveryStore((s) => s.currentLocation);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const routePriority = useMotoboyPrefsStore((s) => s.routePriority);
  const setRoutePriority = useMotoboyPrefsStore((s) => s.setRoutePriority);
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const [showPriorityModal, setShowPriorityModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!roteirizacaoHabilitada) {
        navigation.replace("EntregasList");
      }
    }, [roteirizacaoHabilitada, navigation])
  );

  useFocusEffect(
    useCallback(() => {
      if (route.params?.openLocatePackage) {
        setShowLocateSheet(true);
        navigation.setParams({ openLocatePackage: undefined });
      }
      if (route.params?.openSeparation) {
        setShowSeparationSheet(true);
        navigation.setParams({ openSeparation: undefined });
      }
      if (route.params?.highlightLocatePackage) {
        setShowLocateHint(true);
        navigation.setParams({ highlightLocatePackage: undefined });
      } else if (
        !routeSeparationAcknowledged &&
        useDeliveryStore.getState().activeRouteId == null &&
        useDeliveryStore.getState().routeOrder.length > 0
      ) {
        setShowLocateHint(true);
      }
    }, [
      route.params?.openLocatePackage,
      route.params?.openSeparation,
      route.params?.highlightLocatePackage,
      routeSeparationAcknowledged,
      navigation,
    ])
  );

  const dismissLocateHint = useCallback(() => {
    setShowLocateHint(false);
    acknowledgeRouteSeparation();
  }, [acknowledgeRouteSeparation]);

  const openLocatePackage = useCallback(() => {
    dismissLocateHint();
    setShowLocateSheet(true);
  }, [dismissLocateHint]);

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );
  const groupedStops = useMemo(() => groupOrderedByAddress(ordered), [ordered]);
  const showHeaderOptimize =
    !isRouteActive && routeOptimizationMode == null && groupedStops.length >= 2;
  const fallbackRouteStats = useMemo(
    () =>
      groupedStops.length > 0
        ? computeRouteStatsFromGroups(groupedStops)
        : computeRouteStats(ordered),
    [groupedStops, ordered]
  );
  const displayRouteStats = useMemo(() => {
    if (routeDistanceM != null && routeDurationS != null) {
      const stopMinutes = groupedStops.length * 2;
      return {
        distanceKm: Math.round((routeDistanceM / 1000) * 10) / 10,
        estimatedMinutes: Math.round(routeDurationS / 60) + stopMinutes,
      };
    }
    return fallbackRouteStats;
  }, [routeDistanceM, routeDurationS, groupedStops.length, fallbackRouteStats]);
  const headerStats = useMemo(
    () =>
      computeRouteHeaderStats(
        groupedStops,
        geocodedCoords,
        geocodedMeta,
        legacyValidationCache
      ),
    [groupedStops, geocodedCoords, geocodedMeta, legacyValidationCache]
  );

  const untrustedCount = useMemo(
    () =>
      countUntrustedDeliveries(ordered, geocodedCoords, geocodedMeta, legacyValidationCache),
    [ordered, geocodedCoords, geocodedMeta, legacyValidationCache]
  );
  const activeGroupIndex = useMemo(
    () => (isRouteActive ? getActiveGroupIndex(groupedStops, activeStopIndex) : -1),
    [isRouteActive, groupedStops, activeStopIndex]
  );

  const effectiveCurrentGroupIndex = useMemo(
    () =>
      isRouteActive
        ? getEffectiveCurrentGroupIndex(groupedStops, routeDeliveryStatus, activeGroupIndex)
        : -1,
    [isRouteActive, groupedStops, routeDeliveryStatus, activeGroupIndex]
  );

  const effectiveCurrentGroupNumber = useMemo(
    () =>
      isRouteActive
        ? getEffectiveCurrentGroupNumber(groupedStops, routeDeliveryStatus, activeGroupIndex)
        : 1,
    [isRouteActive, groupedStops, routeDeliveryStatus, activeGroupIndex]
  );

  const nextPendingGroupIndex = useMemo(
    () =>
      getNextPendingGroupIndex(groupedStops, routeDeliveryStatus, effectiveCurrentGroupIndex),
    [groupedStops, routeDeliveryStatus, effectiveCurrentGroupIndex]
  );

  const syncActiveStopIndex = useDeliveryStore((s) => s.syncActiveStopIndex);

  useEffect(() => {
    if (isRouteActive) syncActiveStopIndex();
  }, [isRouteActive, routeDeliveryStatus, routeOrder, syncActiveStopIndex]);

  const nextGroup = useMemo(
    () => (nextPendingGroupIndex >= 0 ? groupedStops[nextPendingGroupIndex] : null),
    [groupedStops, nextPendingGroupIndex]
  );

  const nextGroupAddressLines = useMemo(
    () => (nextGroup ? formatStopAddressLines(nextGroup.representativeDelivery) : null),
    [nextGroup]
  );

  const nextGroupCanNavigate = useMemo(() => {
    if (!nextGroup) return false;
    const target = resolveGroupNavigationTarget(
      nextGroup,
      geocodedCoords,
      geocodedMeta,
      legacyValidationCache
    );
    return target.mode === "coords" || (target.mode === "address" && Boolean(target.address));
  }, [nextGroup, geocodedCoords, geocodedMeta, legacyValidationCache]);

  const { polyline: routePolyline, polylineWarning, recalcPolyline } = useActiveRoutePolyline({
    isRouteActive,
    groupedStops,
    activeGroupIndex: effectiveCurrentGroupIndex,
    routeDeliveryStatus,
    geocodedCoords,
    geocodedMeta,
    legacyValidationCache,
    currentLocation,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const d of ordered) {
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
  }, [ordered]);

  const geocodeAttemptRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextCoords: Record<number, { latitude: number; longitude: number }> = {};
      const nextMeta: GeocodedMetaMap = {};
      for (const d of ordered) {
        if (cancelled) return;
        if (geocodeAttemptRef.current.has(d.id_saida)) continue;
        const existing = resolveDeliveryDestination(
          d,
          {},
          {},
          legacyValidationCache
        );
        if (existing.hasTrustedCoords) continue;
        geocodeAttemptRef.current.add(d.id_saida);

        const fields = extractAddressFields(d);
        if (!fields.cidade && cidadePadrao) fields.cidade = cidadePadrao;
        if (!fields.estado && estadoPadrao) fields.estado = estadoPadrao;

        const res = await geocodeAddressStrict(fields);
        if (cancelled) return;
        if (!res) continue;

        nextCoords[d.id_saida] = { latitude: res.latitude, longitude: res.longitude };
        nextMeta[d.id_saida] = {
          confidence: res.confidence,
          source: "app_geocoded",
          validated: true,
        };
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (!cancelled) {
        if (Object.keys(nextCoords).length > 0) {
          setGeocodedCoords((prev) => ({ ...prev, ...nextCoords }));
        }
        if (Object.keys(nextMeta).length > 0) {
          setGeocodedMeta((prev) => ({ ...prev, ...nextMeta }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ordered, cidadePadrao, estadoPadrao, legacyValidationCache]);

  const findGroupForDelivery = useCallback(
    (d: EntregaListItem): GroupedStop | undefined =>
      groupedStops.find((g) => g.deliveries.some((x) => x.id_saida === d.id_saida)),
    [groupedStops]
  );

  const openNavigationForGroup = useCallback((group: GroupedStop, stopNumber: number) => {
    setNavSheetTarget({ group, stopNumber });
  }, []);

  const openNextStopNavigation = useCallback(() => {
    const st = useDeliveryStore.getState();
    if (st.routeOrder.length === 0) return;
    if (st.activeStopIndex >= st.routeOrder.length) return;
    const ord = getOrderedRouteDeliveries(st.routeDeliveries, st.routeOrder);
    const grps = groupOrderedByAddress(ord);
    const actG = getActiveGroupIndex(grps, st.activeStopIndex);
    const currentG = getEffectiveCurrentGroupIndex(grps, st.routeDeliveryStatus, actG);
    const nextG = getNextPendingGroupIndex(grps, st.routeDeliveryStatus, currentG);
    if (nextG < 0) return;
    setNavSheetTarget({ group: grps[nextG], stopNumber: nextG + 1 });
  }, []);

  /** Aguarda o Modal nativo do formulário fechar antes de abrir o sheet (Android). */
  const scheduleOpenNextStopNavigation = useCallback(() => {
    const delayMs = Platform.OS === "android" ? 350 : 120;
    setTimeout(() => {
      openNextStopNavigation();
    }, delayMs);
  }, [openNextStopNavigation]);

  const promptMarkStopBatch = useCallback(
    (
      selected: EntregaListItem,
      group: GroupedStop | undefined,
      actionLabel: string,
      onSingle: () => void,
      onAll: (ids: number[]) => void
    ) => {
      const pending = group
        ? getPendingDeliveriesInGroup(group, routeDeliveryStatus)
        : [selected].filter((x) => (routeDeliveryStatus[x.id_saida] ?? "pendente") === "pendente");
      if (pending.length <= 1) {
        onSingle();
        return;
      }
      const selectedCodigo = selected.codigo?.trim() || "—";
      const others = pending.filter((x) => x.id_saida !== selected.id_saida);
      const othersList = others.map((x) => x.codigo?.trim() || "—").join("\n");
      Alert.alert(
        actionLabel,
        `Pacote: ${selectedCodigo}\n\nEsta parada tem mais ${others.length} pacote${others.length !== 1 ? "s" : ""} pendente${others.length !== 1 ? "s" : ""}:\n${othersList}\n\nDeseja marcar todos os pacotes desta parada?`,
        [
          { text: "Não, só este", style: "cancel" as const, onPress: onSingle },
          { text: "Sim, todos", onPress: () => onAll(pending.map((x) => x.id_saida)) },
        ]
      );
    },
    [routeDeliveryStatus]
  );

  const handleMarkerPress = useCallback(
    (d: EntregaListItem) => {
      const group = findGroupForDelivery(d);
      const target = group
        ? getFirstPendingInGroup(group, routeDeliveryStatus) ?? d
        : d;
      setSelectedDelivery(target);
      setCenterOnStopId(target.id_saida);
      setRouteListCollapsed(true);
    },
    [findGroupForDelivery, routeDeliveryStatus]
  );

  const handleSequenceStopPress = useCallback(
    (stopNumber: number) => {
      const group = groupedStops[stopNumber - 1];
      if (!group) return;
      const target = getFirstPendingInGroup(group, routeDeliveryStatus) ?? group.deliveries[0];
      setCenterOnStopId(target.id_saida);
      if (isRouteActive) {
        setSelectedDelivery(target);
        setRouteListCollapsed(true);
      }
    },
    [groupedStops, routeDeliveryStatus, isRouteActive]
  );

  const handleCloseCard = useCallback(() => {
    setSelectedDelivery(null);
  }, []);

  const runMarcarEntregueFor = useCallback(
    (d: EntregaListItem) => {
      setSelectedDelivery(d);
      const group = findGroupForDelivery(d);
      promptMarkStopBatch(
        d,
        group,
        "Marcar como entregue?",
        () => setPendingEntregueIds([d.id_saida]),
        (ids) => setPendingEntregueIds(ids)
      );
    },
    [findGroupForDelivery, promptMarkStopBatch]
  );

  const handleMarcarEntregue = useCallback(() => {
    if (!selectedDelivery) return;
    runMarcarEntregueFor(selectedDelivery);
  }, [selectedDelivery, runMarcarEntregueFor]);

  const handleMarcarEntregueFor = useCallback(
    (d: EntregaListItem) => {
      runMarcarEntregueFor(d);
    },
    [runMarcarEntregueFor]
  );

  const openAusenteForDelivery = useCallback(
    (d: EntregaListItem) => {
      const group = groupedStops.find((g) => g.deliveries.some((x) => x.id_saida === d.id_saida));
      const pendingInGroup = group
        ? getPendingDeliveriesInGroup(group, routeDeliveryStatus)
        : [d];
      setDeliveryForAusente(d);
      setPendingAusenteIds([d.id_saida]);
      setAusenteBatchCount(pendingInGroup.length);
      setShowAusenteModal(true);
    },
    [groupedStops, routeDeliveryStatus]
  );

  const handleMarcarAusenteFor = useCallback(
    (d: EntregaListItem) => {
      setSelectedDelivery(d);
      openAusenteForDelivery(d);
    },
    [openAusenteForDelivery]
  );

  const closeAusenteModal = useCallback(() => {
    setShowAusenteModal(false);
    setDeliveryForAusente(null);
    setPendingAusenteIds([]);
    setAusenteBatchCount(1);
  }, []);

  const handleEntregueSuccess = useCallback(
    async (result?: { marcacao?: MarcacaoEntregaResponse; queued?: boolean }) => {
      const codigoFeedback = selectedDelivery?.codigo ?? null;
      const marcacao = result?.marcacao;
      const entregaAtrasada = marcacao?.entrega_atrasada ?? false;
      const extra = marcacao as MarcacaoEntregaResponse & {
        routeJustCompleted?: boolean;
        rotaIdForResumo?: string | null;
      };
      const routeJustCompleted = extra?.routeJustCompleted ?? false;
      const rotaIdForResumo = extra?.rotaIdForResumo ?? null;

      // Sempre libera a UI, mesmo se o pós-sucesso falhar.
      setPendingEntregueIds(null);
      setSelectedDelivery(null);

      try {
        if (isRouteActive && activeRouteId && !routeJustCompleted) {
          try {
            recalcPolyline();
          } catch {
            /* polyline não pode bloquear a próxima parada */
          }
          useDeliveryStore.getState().syncActiveStopIndex();
          const nextIdx = useDeliveryStore.getState().activeStopIndex;
          const order = useDeliveryStore.getState().routeOrder;
          if (nextIdx < order.length) {
            setCenterOnStopId(order[nextIdx]);
            scheduleOpenNextStopNavigation();
          }
        }

        runPostFinalizeFeedback({
          tipo: "entregue",
          codigo: codigoFeedback,
          entregaAtrasada,
          routeJustCompleted,
          rotaIdForResumo,
          isRouteFlow: isRouteActive,
          queued: result?.queued,
        });
      } catch (e) {
        console.warn("[RouteBuilder] handleEntregueSuccess pós-UI falhou", e);
      }
    },
    [isRouteActive, activeRouteId, selectedDelivery, recalcPolyline, scheduleOpenNextStopNavigation]
  );

  const resolveAusenteBatchTargets = useCallback(async (): Promise<number[]> => {
    if (!deliveryForAusente) return [];
    const group = findGroupForDelivery(deliveryForAusente);
    const pendingInGroup = group
      ? getPendingDeliveriesInGroup(group, routeDeliveryStatus)
      : [deliveryForAusente];
    if (pendingInGroup.length <= 1) return [deliveryForAusente.id_saida];
    return new Promise<number[]>((resolve) => {
      const selectedCodigo = deliveryForAusente.codigo?.trim() || "—";
      const others = pendingInGroup.filter((x) => x.id_saida !== deliveryForAusente.id_saida);
      const othersList = others.map((x) => x.codigo?.trim() || "—").join("\n");
      Alert.alert(
        "Marcar como ausente?",
        `Pacote: ${selectedCodigo}\n\nEsta parada tem mais ${others.length} pacote${others.length !== 1 ? "s" : ""} pendente${others.length !== 1 ? "s" : ""}:\n${othersList}\n\nDeseja marcar todos os pacotes desta parada?`,
        [
          {
            text: "Não, só este",
            style: "cancel" as const,
            onPress: () => resolve([deliveryForAusente.id_saida]),
          },
          { text: "Sim, todos", onPress: () => resolve(pendingInGroup.map((d) => d.id_saida)) },
        ]
      );
    });
  }, [deliveryForAusente, findGroupForDelivery, routeDeliveryStatus]);

  const handleAusenteSuccess = useCallback(async (result?: { queued?: boolean }) => {
    if (!deliveryForAusente) return;
    const codigoFeedback = deliveryForAusente.codigo;
    const activeRotaId = useDeliveryStore.getState().activeRouteId;

    closeAusenteModal();
    setSelectedDelivery(null);

    try {
      if (activeRotaId) {
        try {
          recalcPolyline();
        } catch {
          /* ignore */
        }
        useDeliveryStore.getState().syncActiveStopIndex();
        const nextIdx = useDeliveryStore.getState().activeStopIndex;
        const order = useDeliveryStore.getState().routeOrder;
        if (nextIdx < order.length) {
          setCenterOnStopId(order[nextIdx]);
          scheduleOpenNextStopNavigation();
        }
      }

      runPostFinalizeFeedback({
        tipo: "ausente",
        codigo: codigoFeedback,
        entregaAtrasada: false,
        routeJustCompleted: false,
        rotaIdForResumo: null,
        isRouteFlow: activeRotaId != null,
        queued: result?.queued,
      });
    } catch (e) {
      console.warn("[RouteBuilder] handleAusenteSuccess pós-UI falhou", e);
    }
  }, [deliveryForAusente, closeAusenteModal, recalcPolyline, scheduleOpenNextStopNavigation]);

  const openAusenteModal = useCallback(() => {
    if (!selectedDelivery) return;
    openAusenteForDelivery(selectedDelivery);
  }, [selectedDelivery, openAusenteForDelivery]);

  const openNavegarModal = useCallback(() => {
    if (!selectedDelivery) return;
    const group = findGroupForDelivery(selectedDelivery);
    if (!group) return;
    const gIdx = groupedStops.findIndex((g) =>
      g.deliveries.some((d) => d.id_saida === selectedDelivery.id_saida)
    );
    openNavigationForGroup(group, gIdx >= 0 ? gIdx + 1 : 1);
  }, [selectedDelivery, findGroupForDelivery, groupedStops, openNavigationForGroup]);

  const handleIniciarEntrega = useCallback(async () => {
    if (ordered.length === 0) return;
    setIniciandoRota(true);
    try {
      await startActiveRoute();
      playSound("success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao iniciar entrega.";
      Alert.alert("Erro", msg);
    } finally {
      setIniciandoRota(false);
    }
  }, [ordered.length, startActiveRoute]);

  const handleCancelarRota = useCallback(() => {
    Alert.alert(
      "Cancelar rota?",
      "A rota atual será cancelada. Os pedidos não entregues voltam para preparação.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Cancelar rota",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setRouteActionLoading(true);
              try {
                const result = await cancelActiveRoute();
                if (!result.ok) {
                  Alert.alert("Erro", result.error);
                  return;
                }
                navigation.navigate("EntregasList", { initialTab: "pendente" });
              } finally {
                setRouteActionLoading(false);
              }
            })();
          },
        },
      ]
    );
  }, [cancelActiveRoute, navigation]);

  const handleRefazerRota = useCallback(() => {
    Alert.alert(
      "Refazer rota?",
      "Vamos cancelar esta rota e montar outra com todos os pedidos pendentes de agora.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Refazer rota",
          onPress: () => {
            void (async () => {
              setRouteActionLoading(true);
              try {
                const result = await rebuildRouteFromPendentes();
                if (!result.ok) {
                  Alert.alert(
                    result.reason === "no_pending" ? "Sem pedidos" : "Erro",
                    result.message
                  );
                  if (result.reason === "no_pending") {
                    navigation.navigate("EntregasList", { initialTab: "pendente" });
                  }
                  return;
                }
                playSound("success");
                setShowLocateHint(true);
              } finally {
                setRouteActionLoading(false);
              }
            })();
          },
        },
      ]
    );
  }, [rebuildRouteFromPendentes, navigation]);

  const confirmReorderDuringActiveRoute = useCallback((onConfirm: () => void | Promise<void>) => {
    if (!isRouteActive) {
      void onConfirm();
      return;
    }
    Alert.alert(
      "Alterar ordem da rota?",
      "Isso vai mudar a numeração de todas as paradas. Os números anotados nos pacotes podem ficar incorretos. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Continuar", onPress: () => void onConfirm() },
      ]
    );
  }, [isRouteActive]);

  const handleStopPress = useCallback((group: GroupedStop, stopIndex: number) => {
    setActionSheetGroup(group);
    setActionSheetStopIndex(stopIndex);
  }, []);

  const handleNavegarGroup = useCallback(
    (group: GroupedStop) => {
      const gIdx = groupedStops.findIndex((g) =>
        g.deliveries.some((x) => group.deliveries.some((y) => y.id_saida === x.id_saida))
      );
      openNavigationForGroup(group, gIdx >= 0 ? gIdx + 1 : 1);
    },
    [groupedStops, openNavigationForGroup]
  );

  const handleRemoverGroup = useCallback(() => {
    if (!actionSheetGroup) return;
    const ids = actionSheetGroup.deliveries.map((d) => d.id_saida);
    removeFromRoute(ids);
    setActionSheetGroup(null);
  }, [actionSheetGroup, removeFromRoute]);

  const refreshActivePolyline = useCallback(async () => {
    recalcPolyline();
  }, [recalcPolyline]);

  const applyAppendAtEnd = useCallback(
    async (delivery: EntregaListItem) => {
      appendToRouteAtEnd([delivery]);
      await refreshActivePolyline();
      Alert.alert("Rota atualizada", "Parada adicionada ao final da rota.");
    },
    [appendToRouteAtEnd, refreshActivePolyline]
  );

  const applyAppendReoptimize = useCallback(
    async (delivery: EntregaListItem) => {
      setRecalculatingRoute(true);
      try {
        appendToRoute([delivery]);
        await runOptimizeRouteWithFeedback(() => reoptimizeFullRoute(), { silent: true });
        await refreshActivePolyline();
        Alert.alert("Rota reotimizada", "A rota foi reorganizada com o novo pacote.");
      } finally {
        setRecalculatingRoute(false);
      }
    },
    [appendToRoute, reoptimizeFullRoute, refreshActivePolyline]
  );

  const promptPlacementChoice = useCallback(
    (delivery: EntregaListItem) => {
      pendingAddToRouteIdRef.current = null;
      Alert.alert(
        "Incluir na rota",
        "Como deseja incluir esta parada na rota planejada?",
        [
          { text: "Cancelar", style: "cancel", onPress: notifyPendingAdded },
          {
            text: "Última parada",
            onPress: () => void applyAppendAtEnd(delivery),
          },
          {
            text: "Reotimizar rota",
            onPress: () => void applyAppendReoptimize(delivery),
          },
        ]
      );
    },
    [applyAppendAtEnd, applyAppendReoptimize]
  );

  const startPendingAddToRouteFlow = useCallback(
    async (idSaida: number) => {
      if (isRouteActive) return;
      let delivery =
        pendingDeliveries.find((d) => d.id_saida === idSaida) ??
        routeDeliveries.find((d) => d.id_saida === idSaida);
      if (!delivery) {
        try {
          delivery = await getEntrega(idSaida);
        } catch {
          Alert.alert("Erro", "Não foi possível carregar o pacote.");
          return;
        }
      }
      pendingAddToRouteIdRef.current = idSaida;
      if (deliveryNeedsAddressForRoute(delivery)) {
        setEditDelivery(delivery);
        return;
      }
      promptPlacementChoice(delivery);
    },
    [isRouteActive, pendingDeliveries, routeDeliveries, promptPlacementChoice]
  );

  useEffect(() => {
    const idSaida = route.params?.pendingAddToRoute;
    if (idSaida == null) return;
    navigation.setParams({ pendingAddToRoute: undefined });
    void startPendingAddToRouteFlow(idSaida);
  }, [route.params?.pendingAddToRoute, navigation, startPendingAddToRouteFlow]);

  const runPreStartReoptimize = useCallback(
    async (
      fromGroupIndex: number,
      toGroupIndex: number,
      mode: "recalculate" | "swap_only"
    ) => {
      setRecalculatingRoute(true);
      try {
        const result = await reoptimizeFromGroupAnchor({
          fromGroupIndex,
          toGroupIndex,
          mode,
        });
        await refreshActivePolyline();
        if (!result.ok) {
          Alert.alert(
            "Não foi possível recalcular",
            "A sequência anterior foi mantida."
          );
          return;
        }
        if (mode === "recalculate") {
          Alert.alert(
            "Rota atualizada",
            `Sequência recalculada a partir da parada ${toGroupIndex + 1}.`
          );
        }
      } finally {
        setRecalculatingRoute(false);
      }
    },
    [reoptimizeFromGroupAnchor, refreshActivePolyline]
  );

  const confirmPreStartMove = useCallback(
    (fromGroupIndex: number, toGroupIndex: number, onDone?: () => void) => {
      Alert.alert(
        "Recalcular rota?",
        "Esta parada será fixada na nova posição e as próximas serão reorganizadas pela melhor sequência.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Somente trocar posição",
            onPress: () => {
              void runPreStartReoptimize(fromGroupIndex, toGroupIndex, "swap_only").then(onDone);
            },
          },
          {
            text: "Recalcular rota",
            onPress: () => {
              void runPreStartReoptimize(fromGroupIndex, toGroupIndex, "recalculate").then(onDone);
            },
          },
        ]
      );
    },
    [runPreStartReoptimize]
  );

  const runPartialOptimize = useCallback(
    async (fromIndex?: number) => {
      if (groupedStops.length < 2) return;
      await runOptimizeRouteWithFeedback(optimizeRoute, {
        fromDeliveryIndex: fromIndex ?? (isRouteActive ? activeStopIndex : 0),
        persistActive: isRouteActive,
      });
      await refreshActivePolyline();
    },
    [groupedStops.length, optimizeRoute, isRouteActive, activeStopIndex, refreshActivePolyline]
  );

  const handleHeaderOptimize = useCallback(async () => {
    if (groupedStops.length < 2 || optimizingHeader) return;
    setOptimizingHeader(true);
    try {
      await runPartialOptimize();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao otimizar a rota.";
      Alert.alert("Erro ao otimizar", msg);
    } finally {
      setOptimizingHeader(false);
    }
  }, [groupedStops.length, optimizingHeader, runPartialOptimize]);

  const handleSavePriority = useCallback(
    async (p: typeof routePriority) => {
      await setRoutePriority(p);
      if (p.type !== "none" && groupedStops.length >= 2) {
        Alert.alert(
          "Preferência salva",
          "Deseja reotimizar a rota agora com essa prioridade?",
          [
            { text: "Agora não", style: "cancel" },
            { text: "Reotimizar", onPress: () => void handleHeaderOptimize() },
          ]
        );
      }
    },
    [setRoutePriority, groupedStops.length, handleHeaderOptimize]
  );

  const handleSaveAddress = useCallback(
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
                coord_precision: inferCoordPrecision(effectiveOrigem, coords?.confidence),
                geocode_source:
                  effectiveOrigem === "google_places" || effectiveOrigem === "mapa"
                    ? effectiveOrigem
                    : coords?.source ?? "nominatim_strict",
              }
            : {}),
        };
        const updated = await saveAddress(editDelivery.id_saida, body);
        updateRouteDelivery(editDelivery.id_saida, updated);
        if (updated.latitude != null && updated.longitude != null) {
          setGeocodedCoords((prev) => ({
            ...prev,
            [updated.id_saida]: { latitude: updated.latitude!, longitude: updated.longitude! },
          }));
        } else {
          const geo = await geocodeAddressStrict({
            rua: values.rua,
            numero: values.numero,
            bairro: values.bairro,
            cidade: values.cidade || cidadePadrao,
            estado: values.estado || estadoPadrao,
            cep: values.cep,
          });
          if (geo) {
            setGeocodedMeta((prev) => ({
              ...prev,
              [editDelivery.id_saida]: {
                confidence: geo.confidence,
                source: "app_geocoded",
                validated: true,
              },
            }));
            setGeocodedCoords((prev) => ({
              ...prev,
              [editDelivery.id_saida]: {
                latitude: geo.latitude,
                longitude: geo.longitude,
              },
            }));
          }
        }
        setEditDelivery(null);
        const pendingAddId = pendingAddToRouteIdRef.current;
        if (pendingAddId === updated.id_saida && !isRouteActive) {
          pendingAddToRouteIdRef.current = null;
          promptPlacementChoice(updated);
          return;
        }
        if (isRouteActive) {
          await runPartialOptimize();
        } else {
          const gIdx = groupedStops.findIndex((g) =>
            g.deliveries.some((d) => d.id_saida === updated.id_saida)
          );
          if (gIdx >= 0) {
            setRecalculatingRoute(true);
            try {
              await reoptimizeFromGroupAnchor({
                fromGroupIndex: gIdx,
                toGroupIndex: gIdx,
                mode: "recalculate",
              });
              await refreshActivePolyline();
              Alert.alert("Endereço salvo", "Próximas paradas recalculadas a partir desta parada.");
            } catch {
              Alert.alert("Endereço salvo", "Não foi possível recalcular as próximas paradas.");
            } finally {
              setRecalculatingRoute(false);
            }
          }
        }
      } catch (e) {
        Alert.alert("Erro ao salvar", formatApiError(e, "Não foi possível salvar o endereço."));
      }
    },
    [editDelivery, saveAddress, updateRouteDelivery, runPartialOptimize, isRouteActive, cidadePadrao, estadoPadrao, groupedStops, reoptimizeFromGroupAnchor, refreshActivePolyline, promptPlacementChoice]
  );

  const handleAlterarPosicao = useCallback(
    (toIndex: number, mode: "recalculate" | "swap_only" = "recalculate") => {
      const fromGroupIndex = actionSheetStopIndex - 1;
      if (!isRouteActive) {
        setActionSheetGroup(null);
        void runPreStartReoptimize(fromGroupIndex, toIndex, mode);
        return;
      }
      confirmReorderDuringActiveRoute(async () => {
        moveGroupedStopToIndex(fromGroupIndex, toIndex);
        setActionSheetGroup(null);
        await runPartialOptimize();
      });
    },
    [
      actionSheetStopIndex,
      moveGroupedStopToIndex,
      runPartialOptimize,
      isRouteActive,
      confirmReorderDuringActiveRoute,
      runPreStartReoptimize,
    ]
  );

  const handleMoverInicio = useCallback(() => {
    const fromGroupIndex = actionSheetStopIndex - 1;
    const toGroupIndex = isRouteActive ? effectiveCurrentGroupNumber - 1 : 0;
    if (!isRouteActive) {
      setActionSheetGroup(null);
      confirmPreStartMove(fromGroupIndex, toGroupIndex);
      return;
    }
    confirmReorderDuringActiveRoute(async () => {
      moveGroupedStopToStart(fromGroupIndex);
      setActionSheetGroup(null);
      await runPartialOptimize();
    });
  }, [
    actionSheetStopIndex,
    moveGroupedStopToStart,
    runPartialOptimize,
    isRouteActive,
    confirmReorderDuringActiveRoute,
    confirmPreStartMove,
    effectiveCurrentGroupNumber,
  ]);

  const handleMoverFim = useCallback(() => {
    const fromGroupIndex = actionSheetStopIndex - 1;
    const toGroupIndex = groupedStops.length - 1;
    if (!isRouteActive) {
      setActionSheetGroup(null);
      confirmPreStartMove(fromGroupIndex, toGroupIndex);
      return;
    }
    confirmReorderDuringActiveRoute(async () => {
      moveGroupedStopToEnd(fromGroupIndex);
      setActionSheetGroup(null);
      await runPartialOptimize();
    });
  }, [
    actionSheetStopIndex,
    moveGroupedStopToEnd,
    runPartialOptimize,
    isRouteActive,
    confirmReorderDuringActiveRoute,
    confirmPreStartMove,
    groupedStops.length,
  ]);

  const handleStopReorder = useCallback(
    (fromGroupIndex: number, toGroupIndex: number) => {
      if (isRouteActive || fromGroupIndex === toGroupIndex) return;
      confirmPreStartMove(fromGroupIndex, toGroupIndex);
    },
    [isRouteActive, confirmPreStartMove]
  );

  const handleRestoreOriginal = useCallback(async () => {
    const result = restoreOriginalRoute();
    if (!result.ok) {
      Alert.alert(
        "Restaurar rota original",
        result.reason === "unchanged"
          ? "A ordem atual já é a original."
          : "Não há rota original salva."
      );
      return;
    }
    await refreshActivePolyline();
    Alert.alert("Rota restaurada", "A ordem original foi restaurada.");
  }, [restoreOriginalRoute, refreshActivePolyline]);

  const handleReoptimizeFullRoute = useCallback(async () => {
    if (groupedStops.length < 2 || optimizingHeader) return;
    setOptimizingHeader(true);
    try {
      const result = await runOptimizeRouteWithFeedback(() => reoptimizeFullRoute(), {
        silent: true,
      });
      await refreshActivePolyline();
      if (result?.ok && result.message !== "noop") {
        Alert.alert("Rota reotimizada", "A rota completa foi reorganizada.");
      }
    } finally {
      setOptimizingHeader(false);
    }
  }, [groupedStops.length, optimizingHeader, reoptimizeFullRoute, refreshActivePolyline]);

  const canRestoreOriginal = useMemo(() => {
    if (!routeOriginalOrder || routeOriginalOrder.length === 0) return false;
    return routeOriginalOrder.join(",") !== routeOrder.join(",");
  }, [routeOriginalOrder, routeOrder]);

  const routeStatusLabel = useMemo(() => {
    if (!routeManuallyAdjusted) return null;
    if (routeAdjustMode === "swap_only") return "Rota ajustada manualmente";
    return "Rota recalculada";
  }, [routeManuallyAdjusted, routeAdjustMode]);

  const priorityDisplayLabel = useMemo(() => {
    if (routePriority.type === "delivery") {
      const d = routeDeliveries.find((x) => x.id_saida === routePriority.idSaida);
      return routePriorityLabel(routePriority, d?.codigo ?? undefined);
    }
    return routePriorityLabel(routePriority);
  }, [routePriority, routeDeliveries]);

  const handleCorrigirReview = useCallback((delivery: EntregaListItem) => {
    setShowReviewModal(false);
    setEditDelivery(delivery);
  }, []);

  const handleAddIdsToRoute = useCallback(
    (ids: number[]) => {
      const toAdd = pendingDeliveries.filter((d) => ids.includes(d.id_saida));
      appendToRoute(toAdd);
    },
    [pendingDeliveries, appendToRoute]
  );


  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 13,
          paddingHorizontal: 16,
          paddingTop: Math.max(12, insets.top),
          paddingBottom: 12,
          backgroundColor: colors.backgroundCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        headerCompact: {
          paddingBottom: 8,
        },
        compactLine: {
          fontSize: 14,
          fontWeight: "600",
          color: colors.text,
          marginBottom: 0,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        menuBtn: { padding: 4 },
        startDeliveryBtn: {
          paddingVertical: 14,
          borderRadius: 10,
          backgroundColor: colors.primary,
          alignItems: "center",
          marginBottom: 4,
        },
        startDeliveryBtnText: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.primaryContrast,
        },
        secondaryActionsRow: {
          flexDirection: "row",
          gap: 8,
          marginBottom: 8,
        },
        secondaryActionBtn: {
          flex: 1,
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          alignItems: "center",
        },
        secondaryActionBtnText: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.primary,
          textAlign: "center",
        },
        locateHintBanner: {
          backgroundColor: colors.primarySoft,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.primary + "33",
        },
        locateHintText: {
          fontSize: 13,
          color: colors.text,
          lineHeight: 18,
          marginBottom: 8,
        },
        locateHintDismiss: {
          alignSelf: "flex-start",
          paddingVertical: 4,
        },
        locateHintDismissText: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.primary,
        },
        secondaryActionBtnPulse: {
          borderColor: colors.primary,
          borderWidth: 2,
        },
        priorityRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        priorityText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
        priorityBadge: {
          flex: 1,
          backgroundColor: colors.primarySoft,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 20,
        },
        priorityBadgeText: {
          fontSize: 15,
          fontWeight: "700",
          color: colors.primary,
        },
        priorityLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
        mapHeaderBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: colors.primary,
          marginRight: 8,
        },
        mapHeaderBtnText: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.primaryContrast,
        },
        headerStats: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 8,
        },
        statText: { fontSize: 13, color: colors.textSecondary },
        statValue: { fontWeight: "600", color: colors.text },
        badgeRota: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          marginBottom: 8,
        },
        badgeRotaText: { fontSize: 12, fontWeight: "600", color: colors.text, marginLeft: 4 },
        badgeReview: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          marginBottom: 8,
          backgroundColor: colors.warning + "30",
        },
        statsLine: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
        localizedLine: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
        nextStopBlock: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 8,
        },
        nextStopTextWrap: { flex: 1, minWidth: 0 },
        nextStopLine: { fontSize: 13, color: colors.text, lineHeight: 18 },
        nextStopLineSecondary: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 },
        nextStopPedidos: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        nextStopLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 2 },
        navHeaderBtn: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: colors.primary,
          alignSelf: "flex-start",
        },
        navHeaderBtnText: { fontSize: 12, fontWeight: "700", color: colors.primaryContrast },
        sequenceWrap: { marginBottom: 0 },
        headerButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
        headerBtnSmall: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        headerBtnSmallText: { fontSize: 12, fontWeight: "600", color: colors.text },
        headerBtnSmallActive: { backgroundColor: colors.primary + "20", borderColor: colors.primary },
        headerBtn: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: colors.primary,
        },
        headerBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryContrast },
        headerBtnSecondary: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: colors.primary,
        },
        headerBtnSecondaryText: { fontSize: 13, fontWeight: "600", color: colors.primary },
        mapFull: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        recalcOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 6,
        },
        recalcBox: {
          paddingHorizontal: 24,
          paddingVertical: 16,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        recalcText: { fontSize: 15, fontWeight: "600", color: colors.text },
        sheetOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 8 },
        cardOverlay: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 12,
          paddingHorizontal: 16,
          paddingBottom: 24,
        },
        navOption: {
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        navOptionText: { fontSize: 16, fontWeight: "600", color: colors.text },
      }),
    [colors, insets.top]
  );

  const selectedGroup = useMemo(() => {
    if (!selectedDelivery) return undefined;
    return groupedStops.find((g) =>
      g.deliveries.some((d) => d.id_saida === selectedDelivery.id_saida)
    );
  }, [groupedStops, selectedDelivery]);

  const selectedOrderNumber = useMemo(() => {
    if (!selectedDelivery) return undefined;
    const stopIdx = groupedStops.findIndex((g) =>
      g.deliveries.some((d) => d.id_saida === selectedDelivery.id_saida)
    );
    return stopIdx >= 0 ? stopIdx + 1 : undefined;
  }, [groupedStops, selectedDelivery]);

  const selectedStatus = selectedDelivery
    ? (routeDeliveryStatus[selectedDelivery.id_saida] ?? "pendente")
    : "pendente";

  const headerCompact = selectedDelivery != null;
  const listModeOpen = !isRouteActive && !routeListCollapsed;
  const showPlanningDetails = !isRouteActive && routeListCollapsed && !headerCompact;
  const selectedPackageCount = selectedGroup?.deliveries.length ?? 1;

  const cardMaxScrollHeight = useMemo(() => {
    const screenHeight = Dimensions.get("window").height;
    const headerReserved = headerCompact ? 64 : listModeOpen ? 56 : isRouteActive ? 200 : 300;
    const bottomReserved = routeListCollapsed ? 100 : 220;
    const cardChrome = 88;
    return Math.max(140, screenHeight - insets.top - headerReserved - bottomReserved - cardChrome);
  }, [headerCompact, listModeOpen, routeListCollapsed, insets.top, isRouteActive]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [headerCompact]);

  return (
    <View style={styles.container}>
      <View style={styles.mapFull}>
        <DeliveryMap
          onMarkerPress={handleMarkerPress}
          selectedId={selectedDelivery?.id_saida ?? null}
          centerOnStopId={centerOnStopId}
          geocodedCoords={geocodedCoords}
          geocodedMeta={geocodedMeta}
          legacyValidationCache={legacyValidationCache}
          untrustedCount={untrustedCount}
          routePolyline={routePolyline ?? undefined}
          routeMode
          isRouteActive={isRouteActive}
          polylineWarning={polylineWarning}
          activeGroupIndex={effectiveCurrentGroupIndex}
          selectedStopNumber={selectedOrderNumber ?? null}
          controlsBottomInset={routeListCollapsed ? 100 : 220}
        />
        {recalculatingRoute && (
          <View style={styles.recalcOverlay} pointerEvents="auto">
            <View style={styles.recalcBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.recalcText}>Recalculando rota…</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.header, (headerCompact || listModeOpen) && styles.headerCompact]}>
        <View style={[styles.headerRow, listModeOpen && { marginBottom: 0 }]}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }} />
          {listModeOpen && (
            <TouchableOpacity
              style={styles.mapHeaderBtn}
              onPress={() => setRouteListCollapsed(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="map" size={18} color={colors.primaryContrast} />
              <Text style={styles.mapHeaderBtnText}>Ver mapa</Text>
            </TouchableOpacity>
          )}
          {!headerCompact && !isRouteActive && !listModeOpen && ordered.length > 0 && (
            <TouchableOpacity style={styles.menuBtn} onPress={() => setShowAdvancedMenu(true)}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
        {ordered.length > 0 && headerCompact && selectedOrderNumber != null && (
          <Text style={styles.compactLine}>
            Parada <Text style={styles.statValue}>{selectedOrderNumber}</Text> de{" "}
            <Text style={styles.statValue}>{groupedStops.length}</Text>
            {" · "}
            <Text style={styles.statValue}>{selectedPackageCount}</Text> pedido
            {selectedPackageCount !== 1 ? "s" : ""}
          </Text>
        )}
        {ordered.length > 0 && showPlanningDetails && (
          <>
            <RouteReadySummaryCard
              pedidoCount={headerStats.pedidoCount}
              stopCount={headerStats.stopCount}
              distanceKm={displayRouteStats.distanceKm}
              estimatedMinutes={displayRouteStats.estimatedMinutes}
              localizedStops={headerStats.localizedStops}
              reviewCount={headerStats.reviewCount}
              priorityLabel={routePriority.type !== "none" ? priorityDisplayLabel : null}
              routeStatusLabel={routeStatusLabel}
              onReviewPress={() => setShowReviewModal(true)}
            />
            <View style={styles.priorityRow}>
              {routePriority.type !== "none" ? (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>
                    Priorizar por: {priorityDisplayLabel}
                  </Text>
                </View>
              ) : (
                <Text style={styles.priorityText}>Priorizar por: {priorityDisplayLabel}</Text>
              )}
              <TouchableOpacity onPress={() => setShowPriorityModal(true)}>
                <Text style={styles.priorityLink}>Alterar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sequenceWrap}>
              <RouteSequenceStrip
                groupedStops={groupedStops}
                statusMap={routeDeliveryStatus}
                activeGroupIndex={effectiveCurrentGroupIndex}
                isRouteActive={isRouteActive}
                onPressStop={handleSequenceStopPress}
              />
            </View>
            {showLocateHint ? (
              <View style={styles.locateHintBanner}>
                <Text style={styles.locateHintText}>{LOCATE_PACKAGE_HINT}</Text>
                <TouchableOpacity style={styles.locateHintDismiss} onPress={dismissLocateHint}>
                  <Text style={styles.locateHintDismissText}>Entendi</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.secondaryActionsRow}>
              <PulsingTouchable
                pulsing={showLocateHint}
                style={[
                  styles.secondaryActionBtn,
                  showLocateHint ? styles.secondaryActionBtnPulse : null,
                ]}
                onPress={openLocatePackage}
              >
                <Text style={styles.secondaryActionBtnText}>{LOCATE_PACKAGE_LABEL}</Text>
              </PulsingTouchable>
              {showHeaderOptimize ? (
              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => void handleHeaderOptimize()}
                disabled={optimizingHeader || groupedStops.length < 2}
              >
                {optimizingHeader ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.secondaryActionBtnText}>Otimizar rota</Text>
                )}
              </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.startDeliveryBtn}
              onPress={() => void handleIniciarEntrega()}
              disabled={iniciandoRota || optimizingHeader}
            >
              {iniciandoRota ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={styles.startDeliveryBtnText}>Iniciar entrega</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        {ordered.length > 0 && !headerCompact && isRouteActive && (
          <>
            <TouchableOpacity
              style={[styles.secondaryActionBtn, { marginBottom: 8, alignSelf: "flex-start", paddingHorizontal: 14 }]}
              onPress={openLocatePackage}
            >
              <Text style={styles.secondaryActionBtnText}>{LOCATE_PACKAGE_LABEL}</Text>
            </TouchableOpacity>
            <Text style={styles.statsLine}>
              <Text style={styles.statValue}>{headerStats.stopCount}</Text> parada
              {headerStats.stopCount !== 1 ? "s" : ""}
              {" · "}
              <Text style={styles.statValue}>{headerStats.pedidoCount}</Text> pedido
              {headerStats.pedidoCount !== 1 ? "s" : ""}
            </Text>
            <Text style={styles.localizedLine}>
              Parada atual: <Text style={styles.statValue}>{effectiveCurrentGroupNumber}</Text> de{" "}
              <Text style={styles.statValue}>{groupedStops.length}</Text>
            </Text>
            {nextGroup && nextGroupAddressLines && (
              <View style={styles.nextStopBlock}>
                <View style={styles.nextStopTextWrap}>
                  <Text style={styles.nextStopLabel}>Próxima:</Text>
                  <Text style={styles.nextStopLine} numberOfLines={2}>
                    {nextGroupAddressLines.line1}
                  </Text>
                  {nextGroupAddressLines.line2 && (
                    <Text style={styles.nextStopLineSecondary} numberOfLines={2}>
                      {nextGroupAddressLines.line2}
                    </Text>
                  )}
                  <Text style={styles.nextStopPedidos}>
                    {nextGroup.deliveries.length} pedido
                    {nextGroup.deliveries.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                {nextGroupCanNavigate && (
                  <TouchableOpacity
                    style={styles.navHeaderBtn}
                    onPress={() =>
                      openNavigationForGroup(nextGroup, nextPendingGroupIndex + 1)
                    }
                  >
                    <Text style={styles.navHeaderBtnText}>Navegar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={styles.sequenceWrap}>
              <RouteSequenceStrip
                groupedStops={groupedStops}
                statusMap={routeDeliveryStatus}
                activeGroupIndex={effectiveCurrentGroupIndex}
                isRouteActive={isRouteActive}
                onPressStop={handleSequenceStopPress}
              />
            </View>
          </>
        )}
      </View>

      <View style={styles.sheetOverlay}>
        <RouteBottomSheet
          disableDrag={isRouteActive || recalculatingRoute}
          activeGroupIndex={effectiveCurrentGroupIndex}
          isRouteActive={isRouteActive}
          onStopPress={handleStopPress}
          onStopReorder={!isRouteActive ? handleStopReorder : undefined}
          collapsed={routeListCollapsed}
          onCollapsedChange={setRouteListCollapsed}
          defaultCollapsed
          planningHeaderCollapsed={listModeOpen}
        />
      </View>

      <RoutePriorityModal
        visible={showPriorityModal}
        current={routePriority}
        packages={routeDeliveries}
        onClose={() => setShowPriorityModal(false)}
        onSave={(p) => void handleSavePriority(p)}
      />

      <RouteAdvancedMenuSheet
        visible={showAdvancedMenu}
        onClose={() => setShowAdvancedMenu(false)}
        onOptimize={() => void handleReoptimizeFullRoute()}
        onRestoreOriginal={() => void handleRestoreOriginal()}
        canRestoreOriginal={canRestoreOriginal}
        onAddStop={() => setShowQuickAdd(true)}
        onImport={() => setShowBulkImport(true)}
        onLocate={() => setShowLocateSheet(true)}
        onIniciar={() => void handleIniciarEntrega()}
        onCancelar={handleCancelarRota}
        onRefazer={handleRefazerRota}
        showRouteManagement={routeOrder.length > 0 || isRouteActive}
        onToggleList={() => setRouteListCollapsed((c) => !c)}
        listExpanded={!routeListCollapsed}
        optimizing={optimizingHeader || recalculatingRoute || routeActionLoading}
        iniciando={iniciandoRota || routeActionLoading}
        canOptimize={groupedStops.length >= 2}
        showPlanningActions={!isRouteActive}
      />

      <RouteStopActionSheet
        visible={actionSheetGroup != null}
        group={actionSheetGroup}
        stopIndex={actionSheetStopIndex}
        totalStops={groupedStops.length}
        canMutateStop={!isRouteActive || actionSheetStopIndex >= effectiveCurrentGroupNumber}
        isReviewPhase={!isRouteActive}
        isCurrentStop={isRouteActive && actionSheetStopIndex === effectiveCurrentGroupNumber}
        minPosition={isRouteActive ? effectiveCurrentGroupNumber : 1}
        geocodedCoords={geocodedCoords}
        geocodedMeta={geocodedMeta}
        legacyValidationCache={legacyValidationCache}
        onClose={() => setActionSheetGroup(null)}
        onNavegar={() => actionSheetGroup && handleNavegarGroup(actionSheetGroup)}
        onVerPedidos={() => {
          if (actionSheetGroup) {
            setPedidosGroup(actionSheetGroup);
            setShowPedidosModal(true);
          }
        }}
        onEditarParada={(d) => setEditDelivery(d)}
        onConfirmRecalculate={(toIndex) => handleAlterarPosicao(toIndex, "recalculate")}
        onConfirmSwapOnly={(toIndex) => handleAlterarPosicao(toIndex, "swap_only")}
        onMoverInicio={() => void handleMoverInicio()}
        onMoverFim={() => void handleMoverFim()}
        onRemover={handleRemoverGroup}
      />

      <RouteStopPedidosModal
        visible={showPedidosModal}
        group={pedidosGroup}
        routeDeliveryStatus={routeDeliveryStatus}
        onClose={() => {
          setShowPedidosModal(false);
          setPedidosGroup(null);
        }}
        onSelectPedido={(item) => {
          setSelectedDelivery(item);
          setShowPedidosModal(false);
          setPedidosGroup(null);
        }}
      />

      <RoutePartialReviewModal
        visible={showReviewModal}
        deliveries={headerStats.reviewDeliveries}
        geocodedCoords={geocodedCoords}
        geocodedMeta={geocodedMeta}
        legacyValidationCache={legacyValidationCache}
        onClose={() => setShowReviewModal(false)}
        onCorrigir={handleCorrigirReview}
      />

      <RouteEditAddressSheet
        visible={editDelivery != null}
        delivery={editDelivery}
        onSave={handleSaveAddress}
        onClose={() => setEditDelivery(null)}
      />

      <RouteLocatePackageSheet
        visible={showLocateSheet}
        totalStops={groupedStops.length}
        onFindByQuery={(query) => {
          const matches = findInRouteByQuery(query);
          if (matches.length === 0) return null;
          const found = matches[0];
          return {
            stopIndex: found.stopIndex,
            delivery: found.delivery,
            sameStopDeliveries: found.sameStopDeliveries,
            totalStops: groupedStops.length,
            ambiguousMatches:
              matches.length > 1
                ? matches.slice(1).map((m) => ({
                    stopIndex: m.stopIndex,
                    delivery: m.delivery,
                    sameStopDeliveries: m.sameStopDeliveries,
                    totalStops: groupedStops.length,
                  }))
                : undefined,
          };
        }}
        onViewStop={(stopIndex) => {
          const group = groupedStops[stopIndex];
          if (!group) return;
          setShowLocateSheet(false);
          setCenterOnStopId(group.deliveries[0]?.id_saida ?? null);
          setActionSheetGroup(group);
          setActionSheetStopIndex(stopIndex + 1);
        }}
        onNavigate={(stopIndex) => {
          const group = groupedStops[stopIndex];
          if (group) handleNavegarGroup(group);
        }}
        onEditAddress={(delivery) => {
          setShowLocateSheet(false);
          setEditDelivery(delivery);
        }}
        onChangePosition={(stopIndex) => {
          const group = groupedStops[stopIndex];
          if (!group) return;
          setShowLocateSheet(false);
          setActionSheetGroup(group);
          setActionSheetStopIndex(stopIndex + 1);
        }}
        onClose={() => setShowLocateSheet(false)}
      />

      <PrepSeparatePackagesSheet
        visible={showSeparationSheet}
        routeDeliveries={routeDeliveries}
        routeOrder={routeOrder}
        onConfirm={() => {
          acknowledgeRouteSeparation();
          setShowSeparationSheet(false);
        }}
        onClose={() => setShowSeparationSheet(false)}
      />

      <RouteQuickAddSheet
        visible={showQuickAdd}
        pendingDeliveries={pendingDeliveries}
        routeOrder={routeOrder}
        onAddIds={handleAddIdsToRoute}
        onClose={() => setShowQuickAdd(false)}
      />

      <RouteBulkImportSheet
        visible={showBulkImport}
        pendingDeliveries={pendingDeliveries}
        routeOrder={routeOrder}
        onAddIds={handleAddIdsToRoute}
        onClose={() => setShowBulkImport(false)}
      />

      {selectedDelivery && (
        <View
          style={[
            styles.cardOverlay,
            {
              paddingBottom: routeListCollapsed
                ? 100
                : 24 + Math.max(0, insets.bottom),
            },
          ]}
        >
          <RouteMarkerCard
            delivery={selectedDelivery}
            group={selectedGroup}
            status={selectedStatus}
            orderNumber={selectedOrderNumber}
            totalStops={groupedStops.length}
            maxScrollHeight={cardMaxScrollHeight}
            deliveryStatusMap={routeDeliveryStatus}
            canMarkDelivery={isRouteActive}
            onClose={handleCloseCard}
            onMarcarEntregue={handleMarcarEntregue}
            onMarcarAusente={openAusenteModal}
            onMarcarEntregueFor={handleMarcarEntregueFor}
            onMarcarAusenteFor={handleMarcarAusenteFor}
            onNavegar={openNavegarModal}
            onLocalizarPacote={openLocatePackage}
            onEditarParada={() => setEditDelivery(selectedGroup?.representativeDelivery ?? selectedDelivery)}
            onSelectDelivery={setSelectedDelivery}
          />
        </View>
      )}

      <FormAusenteModal
        visible={showAusenteModal}
        idSaidas={pendingAusenteIds}
        requiredFields={deliveryForAusente?.campos_obrigatorios_ausente || []}
        codigo={deliveryForAusente?.codigo ?? undefined}
        batchCount={ausenteBatchCount}
        stopLabel={
          deliveryForAusente
            ? (() => {
                const stopIdx = groupedStops.findIndex((g) =>
                  g.deliveries.some((d) => d.id_saida === deliveryForAusente.id_saida)
                );
                return stopIdx >= 0
                  ? `Parada ${stopIdx + 1} de ${groupedStops.length}`
                  : undefined;
              })()
            : undefined
        }
        resolveBatchTargets={resolveAusenteBatchTargets}
        onSuccess={handleAusenteSuccess}
        onClose={closeAusenteModal}
      />

      <NextStopNavigationSheet
        visible={navSheetTarget != null}
        group={navSheetTarget?.group ?? null}
        stopNumber={navSheetTarget?.stopNumber ?? 1}
        totalStops={groupedStops.length}
        geocodedCoords={geocodedCoords}
        geocodedMeta={geocodedMeta}
        legacyValidationCache={legacyValidationCache}
        onContinue={() => setNavSheetTarget(null)}
        onClose={() => setNavSheetTarget(null)}
      />
      <FormEntregaConcluida
        visible={pendingEntregueIds != null && pendingEntregueIds.length > 0}
        idSaida={pendingEntregueIds?.[0] ?? 0}
        extraIdSaidas={(pendingEntregueIds ?? []).slice(1)}
        destinatarioPreenchido={selectedDelivery?.cliente ?? undefined}
        requiredFields={selectedDelivery?.campos_obrigatorios_entregue || []}
        codigo={selectedDelivery?.codigo ?? undefined}
        batchCount={pendingEntregueIds?.length ?? 1}
        stopLabel={
          selectedOrderNumber != null
            ? `Parada ${selectedOrderNumber} de ${groupedStops.length}`
            : undefined
        }
        onClose={() => setPendingEntregueIds(null)}
        onSuccess={handleEntregueSuccess}
      />
    </View>
  );
}
