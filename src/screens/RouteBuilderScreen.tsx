import React, { useMemo, useState, useCallback, useEffect } from "react";
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
import DeliveryMap from "../components/DeliveryMap";
import RouteBottomSheet from "../components/RouteBottomSheet";
import RouteMarkerCard from "../components/RouteMarkerCard";
import RouteSequenceStrip from "../components/RouteSequenceStrip";
import FormEntregaConcluida from "../features/entregas/components/FormEntregaConcluida";
import FormAusenteModal, {
  uploadAusentePhotosForDeliveryIds,
} from "../features/entregas/components/FormAusenteModal";
import type { EntregueBody } from "../features/entregas/api";
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
import RoutePriorityModal from "../features/entregas/components/RoutePriorityModal";
import { routePriorityLabel } from "../features/entregas/utils/routePriority";
import type { AddressFormValues } from "../features/entregas/components/AddressForm";
import { playSound } from "../utils/sound";
import { runPostFinalizeFeedback } from "../features/entregas/utils/finalizeEntregaFeedback";
import { formatApiError } from "../utils/formatApiError";
import {
  geocodeAddress,
  geocodeAddressFromValues,
  isValidGeocodeCoords,
  type GeocodeResult,
} from "../features/entregas/utils/geocode";
import type { EntregaListItem } from "../features/entregas/types";
import { useMotoboyPrefsStore } from "../store/motoboyPrefsStore";
import { runOptimizeRouteWithFeedback } from "../features/entregas/utils/optimizeRouteFeedback";

type Props = NativeStackScreenProps<RootStackParamList, "RouteBuilder">;

type NavSheetTarget = { group: GroupedStop; stopNumber: number };

export default function RouteBuilderScreen({ navigation }: Props) {
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
  const activeStopIndex = useDeliveryStore((s) => s.activeStopIndex);
  const startActiveRoute = useDeliveryStore((s) => s.startActiveRoute);
  const completeStop = useDeliveryStore((s) => s.completeStop);
  const finishRoute = useDeliveryStore((s) => s.finishRoute);
  const optimizeRoute = useDeliveryStore((s) => s.optimizeRoute);
  const saveAddress = useDeliveryStore((s) => s.saveAddress);
  const removeFromRoute = useDeliveryStore((s) => s.removeFromRoute);
  const moveGroupedStopToIndex = useDeliveryStore((s) => s.moveGroupedStopToIndex);
  const moveGroupedStopToStart = useDeliveryStore((s) => s.moveGroupedStopToStart);
  const moveGroupedStopToEnd = useDeliveryStore((s) => s.moveGroupedStopToEnd);
  const updateRouteDelivery = useDeliveryStore((s) => s.updateRouteDelivery);
  const findInRouteByCodigo = useDeliveryStore((s) => s.findInRouteByCodigo);
  const appendToRoute = useDeliveryStore((s) => s.appendToRoute);
  const pendingDeliveries = useDeliveryStore((s) => s.pendingDeliveries);

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
  const [routeListCollapsed, setRouteListCollapsed] = useState(true);
  const [optimizingHeader, setOptimizingHeader] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const [pendingEntregueIds, setPendingEntregueIds] = useState<number[] | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<number, { latitude: number; longitude: number }>>({});
  const currentLocation = useDeliveryStore((s) => s.currentLocation);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const routePriority = useMotoboyPrefsStore((s) => s.routePriority);
  const setRoutePriority = useMotoboyPrefsStore((s) => s.setRoutePriority);
  const [showPriorityModal, setShowPriorityModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!roteirizacaoHabilitada) {
        navigation.replace("EntregasList");
      }
    }, [roteirizacaoHabilitada, navigation])
  );

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );
  const groupedStops = useMemo(() => groupOrderedByAddress(ordered), [ordered]);
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
    () => computeRouteHeaderStats(groupedStops, geocodedCoords),
    [groupedStops, geocodedCoords]
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
    const target = resolveGroupNavigationTarget(nextGroup, geocodedCoords);
    return target.mode === "coords" || (target.mode === "address" && Boolean(target.address));
  }, [nextGroup, geocodedCoords]);

  const { polyline: routePolyline, polylineWarning, recalcPolyline } = useActiveRoutePolyline({
    isRouteActive,
    groupedStops,
    activeGroupIndex: effectiveCurrentGroupIndex,
    routeDeliveryStatus,
    geocodedCoords,
    currentLocation,
  });

  useEffect(() => {
    const withoutCoords = ordered.filter((d) => d.latitude == null || d.longitude == null);
    if (withoutCoords.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<number, { latitude: number; longitude: number }> = {};
      for (const d of withoutCoords) {
        if (cancelled) return;
        const addr = d.endereco_formatado || [d.endereco, d.bairro].filter(Boolean).join(", ");
            if (!addr.trim()) continue;
            const res = await geocodeAddress(addr);
            if (cancelled) return;
            if (res) next[d.id_saida] = res;
          }
      if (!cancelled) setGeocodedCoords((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [ordered]);

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
    if (st.activeStopIndex >= st.routeOrder.length) return;
    const ord = getOrderedRouteDeliveries(st.routeDeliveries, st.routeOrder);
    const grps = groupOrderedByAddress(ord);
    const actG = getActiveGroupIndex(grps, st.activeStopIndex);
    const currentG = getEffectiveCurrentGroupIndex(grps, st.routeDeliveryStatus, actG);
    const nextG = getNextPendingGroupIndex(grps, st.routeDeliveryStatus, currentG);
    if (nextG < 0) return;
    setNavSheetTarget({ group: grps[nextG], stopNumber: nextG + 1 });
  }, []);

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
      setSelectedDelivery(target);
      setCenterOnStopId(target.id_saida);
      setRouteListCollapsed(true);
    },
    [groupedStops, routeDeliveryStatus]
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

  const handleConfirmarEntregueBatch = useCallback(
    async (body: EntregueBody) => {
      if (!pendingEntregueIds || pendingEntregueIds.length === 0) return;
      const codigoFeedback = selectedDelivery?.codigo ?? null;
      let entregaAtrasada = false;
      let routeJustCompleted = false;
      let rotaIdForResumo: string | null = null;

      for (let i = 0; i < pendingEntregueIds.length; i++) {
        const res = await markDelivered(pendingEntregueIds[i], body);
        if (res.entrega_atrasada) entregaAtrasada = true;
      }
      if (isRouteActive && activeRouteId && pendingEntregueIds.length > 0) {
        const rotaId = activeRouteId;
        await completeStop();
        recalcPolyline();
        const nextIdx = useDeliveryStore.getState().activeStopIndex;
        const order = useDeliveryStore.getState().routeOrder;
        if (nextIdx >= order.length) {
          routeJustCompleted = true;
          rotaIdForResumo = rotaId;
          await finishRoute();
          playSound("success");
        } else {
          playSound("success");
          setCenterOnStopId(order[nextIdx]);
          openNextStopNavigation();
        }
      } else if (pendingEntregueIds && pendingEntregueIds.length > 0) {
        playSound("success");
      }
      setPendingEntregueIds(null);
      setSelectedDelivery(null);
      runPostFinalizeFeedback({
        tipo: "entregue",
        codigo: codigoFeedback,
        entregaAtrasada,
        routeJustCompleted,
        rotaIdForResumo,
        isRouteFlow: isRouteActive,
      });
    },
    [pendingEntregueIds, markDelivered, isRouteActive, activeRouteId, completeStop, finishRoute, selectedDelivery, recalcPolyline, openNextStopNavigation]
  );

  const openAusenteModal = useCallback(() => {
    if (!selectedDelivery) return;
    openAusenteForDelivery(selectedDelivery);
  }, [selectedDelivery, openAusenteForDelivery]);

  const closeAusenteModal = useCallback(() => {
    setShowAusenteModal(false);
    setDeliveryForAusente(null);
    setPendingAusenteIds([]);
    setAusenteBatchCount(1);
  }, []);

  const handleConfirmarAusente = useCallback(
    async ({
      motivoId,
      observacao,
      photoUris,
    }: {
      motivoId: number;
      observacao?: string;
      photoUris: string[];
    }) => {
      if (!deliveryForAusente) return;
      try {
      const group = findGroupForDelivery(deliveryForAusente);
      const pendingInGroup = group
        ? getPendingDeliveriesInGroup(group, routeDeliveryStatus)
        : [deliveryForAusente];
      const idsToMark =
        pendingInGroup.length > 1
          ? await new Promise<number[]>((resolve) => {
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
            })
          : [deliveryForAusente.id_saida];

      const uploadedIds = new Set(pendingAusenteIds);
      const extraIds = idsToMark.filter((id) => !uploadedIds.has(id));
      if (photoUris.length > 0 && extraIds.length > 0) {
        await uploadAusentePhotosForDeliveryIds(photoUris, extraIds);
      }

      let entregaAtrasada = false;
      let routeJustCompleted = false;
      let rotaIdForResumo: string | null = null;
      const activeRotaId = useDeliveryStore.getState().activeRouteId;

      for (let i = 0; i < idsToMark.length; i++) {
        const res = await markAbsent(idsToMark[i], motivoId, observacao);
        if (res.entrega_atrasada) entregaAtrasada = true;
      }
      if (activeRotaId && idsToMark.length > 0) {
        await completeStop();
        recalcPolyline();
        const nextIdx = useDeliveryStore.getState().activeStopIndex;
        const order = useDeliveryStore.getState().routeOrder;
        if (nextIdx < order.length) {
          playSound("warn");
          setCenterOnStopId(order[nextIdx]);
          openNextStopNavigation();
        } else {
          routeJustCompleted = true;
          rotaIdForResumo = activeRotaId;
          await finishRoute();
          playSound("success");
        }
      } else {
        playSound("warn");
      }
      const codigoFeedback = deliveryForAusente.codigo;
      closeAusenteModal();
      setSelectedDelivery(null);
      runPostFinalizeFeedback({
        tipo: "ausente",
        codigo: codigoFeedback,
        entregaAtrasada,
        routeJustCompleted,
        rotaIdForResumo,
        isRouteFlow: activeRotaId != null,
      });
      } catch (e: unknown) {
        Alert.alert("Erro", formatApiError(e, "Erro ao salvar."));
        throw e;
      }
    },
    [
      deliveryForAusente,
      pendingAusenteIds,
      markAbsent,
      completeStop,
      finishRoute,
      findGroupForDelivery,
      routeDeliveryStatus,
      recalcPolyline,
      openNextStopNavigation,
      closeAusenteModal,
    ]
  );

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
    } finally {
      setOptimizingHeader(false);
    }
  }, [groupedStops.length, optimizingHeader, runPartialOptimize]);

  const handleSaveAddress = useCallback(
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
        updateRouteDelivery(editDelivery.id_saida, updated);
        if (updated.latitude != null && updated.longitude != null) {
          setGeocodedCoords((prev) => ({
            ...prev,
            [updated.id_saida]: { latitude: updated.latitude!, longitude: updated.longitude! },
          }));
        } else {
          const geo = await geocodeAddressFromValues(values);
          if (geo) {
            updateRouteDelivery(editDelivery.id_saida, {
              latitude: geo.latitude,
              longitude: geo.longitude,
            });
            setGeocodedCoords((prev) => ({
              ...prev,
              [editDelivery.id_saida]: geo,
            }));
          }
        }
        setEditDelivery(null);
        if (isRouteActive) await runPartialOptimize();
      } catch (e) {
        Alert.alert("Erro ao salvar", formatApiError(e, "Não foi possível salvar o endereço."));
      }
    },
    [editDelivery, saveAddress, updateRouteDelivery, runPartialOptimize, isRouteActive]
  );

  const handleAlterarPosicao = useCallback(
    (toIndex: number) => {
      confirmReorderDuringActiveRoute(async () => {
        moveGroupedStopToIndex(actionSheetStopIndex - 1, toIndex);
        setActionSheetGroup(null);
        if (isRouteActive) await runPartialOptimize();
      });
    },
    [
      actionSheetStopIndex,
      moveGroupedStopToIndex,
      runPartialOptimize,
      isRouteActive,
      confirmReorderDuringActiveRoute,
    ]
  );

  const handleMoverInicio = useCallback(() => {
    confirmReorderDuringActiveRoute(async () => {
      moveGroupedStopToStart(actionSheetStopIndex - 1);
      setActionSheetGroup(null);
      if (isRouteActive) await runPartialOptimize();
    });
  }, [
    actionSheetStopIndex,
    moveGroupedStopToStart,
    runPartialOptimize,
    isRouteActive,
    confirmReorderDuringActiveRoute,
  ]);

  const handleMoverFim = useCallback(() => {
    confirmReorderDuringActiveRoute(async () => {
      moveGroupedStopToEnd(actionSheetStopIndex - 1);
      setActionSheetGroup(null);
      if (isRouteActive) await runPartialOptimize();
    });
  }, [
    actionSheetStopIndex,
    moveGroupedStopToEnd,
    runPartialOptimize,
    isRouteActive,
    confirmReorderDuringActiveRoute,
  ]);

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
        backText: { fontSize: 16, color: colors.primary },
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
        },
        priorityRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        priorityText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
        priorityLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
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
  const selectedPackageCount = selectedGroup?.deliveries.length ?? 1;

  const cardMaxScrollHeight = useMemo(() => {
    const screenHeight = Dimensions.get("window").height;
    const headerReserved = headerCompact ? 64 : isRouteActive ? 200 : 300;
    const bottomReserved = routeListCollapsed ? 100 : 220;
    const cardChrome = 88;
    return Math.max(140, screenHeight - insets.top - headerReserved - bottomReserved - cardChrome);
  }, [headerCompact, routeListCollapsed, insets.top, isRouteActive]);

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
          routePolyline={routePolyline ?? undefined}
          routeMode
          isRouteActive={isRouteActive}
          polylineWarning={polylineWarning}
          activeGroupIndex={effectiveCurrentGroupIndex}
          selectedStopNumber={selectedOrderNumber ?? null}
          controlsBottomInset={routeListCollapsed ? 100 : 220}
        />
      </View>

      <View style={[styles.header, headerCompact && styles.headerCompact]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          {!headerCompact && !isRouteActive && ordered.length > 0 && (
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
        {ordered.length > 0 && !headerCompact && !isRouteActive && (
          <>
            <RouteReadySummaryCard
              pedidoCount={headerStats.pedidoCount}
              stopCount={headerStats.stopCount}
              distanceKm={displayRouteStats.distanceKm}
              estimatedMinutes={displayRouteStats.estimatedMinutes}
              localizedStops={headerStats.localizedStops}
              reviewCount={headerStats.reviewCount}
              priorityLabel={routePriority.type !== "none" ? priorityDisplayLabel : null}
              onReviewPress={() => setShowReviewModal(true)}
            />
            <View style={styles.priorityRow}>
              <Text style={styles.priorityText}>Priorizar por: {priorityDisplayLabel}</Text>
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
            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => setShowLocateSheet(true)}
              >
                <Text style={styles.secondaryActionBtnText}>Localizar pacote</Text>
              </TouchableOpacity>
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
            </View>
            <TouchableOpacity
              style={styles.startDeliveryBtn}
              onPress={() => void handleIniciarEntrega()}
              disabled={iniciandoRota}
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
              onPress={() => setShowLocateSheet(true)}
            >
              <Text style={styles.secondaryActionBtnText}>Localizar pacote</Text>
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
          disableDrag={isRouteActive}
          activeGroupIndex={effectiveCurrentGroupIndex}
          isRouteActive={isRouteActive}
          onStopPress={handleStopPress}
          collapsed={routeListCollapsed}
          onCollapsedChange={setRouteListCollapsed}
          defaultCollapsed
        />
      </View>

      <RoutePriorityModal
        visible={showPriorityModal}
        current={routePriority}
        packages={routeDeliveries}
        onClose={() => setShowPriorityModal(false)}
        onSave={(p) => void setRoutePriority(p)}
      />

      <RouteAdvancedMenuSheet
        visible={showAdvancedMenu}
        onClose={() => setShowAdvancedMenu(false)}
        onOptimize={() => void handleHeaderOptimize()}
        onAddStop={() => setShowQuickAdd(true)}
        onImport={() => setShowBulkImport(true)}
        onLocate={() => setShowLocateSheet(true)}
        onToggleList={() => setRouteListCollapsed((c) => !c)}
        listExpanded={!routeListCollapsed}
        optimizing={optimizingHeader}
        canOptimize={groupedStops.length >= 2}
      />

      <RouteStopActionSheet
        visible={actionSheetGroup != null}
        group={actionSheetGroup}
        stopIndex={actionSheetStopIndex}
        totalStops={groupedStops.length}
        canMutateStop={!isRouteActive || actionSheetStopIndex >= effectiveCurrentGroupNumber}
        isCurrentStop={isRouteActive && actionSheetStopIndex === effectiveCurrentGroupNumber}
        minPosition={isRouteActive ? effectiveCurrentGroupNumber : 1}
        onClose={() => setActionSheetGroup(null)}
        onNavegar={() => actionSheetGroup && handleNavegarGroup(actionSheetGroup)}
        onVerPedidos={() => {
          if (actionSheetGroup) {
            setPedidosGroup(actionSheetGroup);
            setShowPedidosModal(true);
          }
        }}
        onEditarParada={(d) => setEditDelivery(d)}
        onAlterarPosicao={(toIndex) => void handleAlterarPosicao(toIndex)}
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
        geocodedCoords={geocodedCoords}
        onFindByCodigo={(codigo) => {
          const found = findInRouteByCodigo(codigo);
          if (!found) return null;
          return {
            stopIndex: found.stopIndex,
            delivery: found.delivery,
            sameStopDeliveries: found.sameStopDeliveries,
            totalStops: groupedStops.length,
          };
        }}
        onGoToStop={(idSaida) => setCenterOnStopId(idSaida)}
        onClose={() => setShowLocateSheet(false)}
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
            onLocalizarPacote={() => setShowLocateSheet(true)}
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
        onConfirm={handleConfirmarAusente}
        onClose={closeAusenteModal}
      />

      <NextStopNavigationSheet
        visible={navSheetTarget != null}
        group={navSheetTarget?.group ?? null}
        stopNumber={navSheetTarget?.stopNumber ?? 1}
        totalStops={groupedStops.length}
        geocodedCoords={geocodedCoords}
        onContinue={() => setNavSheetTarget(null)}
        onClose={() => setNavSheetTarget(null)}
      />
      <FormEntregaConcluida
        visible={pendingEntregueIds != null && pendingEntregueIds.length > 0}
        idSaida={pendingEntregueIds?.[0] ?? 0}
        destinatarioPreenchido={selectedDelivery?.cliente ?? undefined}
        requiredFields={selectedDelivery?.campos_obrigatorios_entregue || []}
        codigo={selectedDelivery?.codigo ?? undefined}
        batchCount={pendingEntregueIds?.length ?? 1}
        stopLabel={
          selectedOrderNumber != null
            ? `Parada ${selectedOrderNumber} de ${groupedStops.length}`
            : undefined
        }
        onConfirm={handleConfirmarEntregueBatch}
        onClose={() => setPendingEntregueIds(null)}
        onSuccess={() => {}}
      />
    </View>
  );
}
