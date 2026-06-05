import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useThemeColors } from "../theme/colors";
import DeliveryMap from "../components/DeliveryMap";
import RouteBottomSheet from "../components/RouteBottomSheet";
import RouteMarkerCard from "../components/RouteMarkerCard";
import FormEntregaConcluida from "../features/entregas/components/FormEntregaConcluida";
import type { EntregueBody } from "../features/entregas/api";
import { useDeliveryStore } from "../store/deliveryStore";
import { getMotivosAusencia } from "../features/entregas/api";
import {
  getOrderedRouteDeliveries,
  computeRouteStats,
  groupOrderedByAddress,
  computeRouteStatsFromGroups,
  computeRouteHeaderStats,
  getActiveGroupIndex,
  addressAndRecipientKey,
  type GroupedStop,
} from "../features/entregas/utils/routeUtils";
import RoutePartialReviewModal from "../features/entregas/components/RoutePartialReviewModal";
import RouteStopPedidosModal from "../features/entregas/components/RouteStopPedidosModal";
import RouteStopActionSheet from "../features/entregas/components/RouteStopActionSheet";
import RouteEditAddressSheet from "../features/entregas/components/RouteEditAddressSheet";
import RouteLocatePackageSheet from "../features/entregas/components/RouteLocatePackageSheet";
import RouteQuickAddSheet from "../features/entregas/components/RouteQuickAddSheet";
import RouteBulkImportSheet from "../features/entregas/components/RouteBulkImportSheet";
import type { AddressFormValues } from "../features/entregas/components/AddressForm";
import { playSound } from "../utils/sound";
import { runPostFinalizeFeedback } from "../features/entregas/utils/finalizeEntregaFeedback";
import SuccessLottie from "../components/SuccessLottie";
import { formatApiError } from "../utils/formatApiError";
import { geocodeAddress } from "../features/entregas/utils/geocode";
import { fetchOsrmRoutePolyline } from "../features/entregas/utils/osrm";
import type { EntregaListItem, MotivoAusencia } from "../features/entregas/types";
import { useMotoboyPrefsStore } from "../store/motoboyPrefsStore";

type Props = NativeStackScreenProps<RootStackParamList, "RouteBuilder">;

function getGoogleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

function getWazeUrl(lat: number, lon: number): string {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
}

export default function RouteBuilderScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [selectedDelivery, setSelectedDelivery] = useState<EntregaListItem | null>(null);
  const [showAusenteModal, setShowAusenteModal] = useState(false);
  const [showNavegarModal, setShowNavegarModal] = useState(false);
  const [deliveryForAusente, setDeliveryForAusente] = useState<EntregaListItem | null>(null);
  const [deliveryForNavegar, setDeliveryForNavegar] = useState<EntregaListItem | null>(null);
  const [motivos, setMotivos] = useState<MotivoAusencia[]>([]);
  const [motivoId, setMotivoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const markDelivered = useDeliveryStore((s) => s.markDelivered);
  const markAbsent = useDeliveryStore((s) => s.markAbsent);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const deliveriesWithAddress = useDeliveryStore((s) => s.deliveriesWithAddress);
  const deliveriesWithoutAddress = useDeliveryStore((s) => s.deliveriesWithoutAddress);
  const setRouteDeliveries = useDeliveryStore((s) => s.setRouteDeliveries);
  const activeRouteId = useDeliveryStore((s) => s.activeRouteId);
  const clearActiveRouteState = useDeliveryStore((s) => s.clearActiveRouteState);
  const activeStopIndex = useDeliveryStore((s) => s.activeStopIndex);
  const startActiveRoute = useDeliveryStore((s) => s.startActiveRoute);
  const completeStop = useDeliveryStore((s) => s.completeStop);
  const finishRoute = useDeliveryStore((s) => s.finishRoute);
  const optimizeRoute = useDeliveryStore((s) => s.optimizeRoute);
  const routeOptimizationMode = useDeliveryStore((s) => s.routeOptimizationMode);
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

  const [showRotaFinalizadaModal, setShowRotaFinalizadaModal] = useState(false);
  const [rotaFinalizadaTotalParadas, setRotaFinalizadaTotalParadas] = useState(0);
  const [centerOnStopId, setCenterOnStopId] = useState<number | null>(null);
  const [iniciandoRota, setIniciandoRota] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [actionSheetGroup, setActionSheetGroup] = useState<GroupedStop | null>(null);
  const [actionSheetStopIndex, setActionSheetStopIndex] = useState(1);
  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [pedidosGroup, setPedidosGroup] = useState<GroupedStop | null>(null);
  const [editDelivery, setEditDelivery] = useState<EntregaListItem | null>(null);
  const [showLocateSheet, setShowLocateSheet] = useState(false);
  const [scanMode, setScanMode] = useState<"locate" | "cargo">("locate");
  const [cargoScannedIds, setCargoScannedIds] = useState<Set<number>>(new Set());
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [pendingEntregueIds, setPendingEntregueIds] = useState<number[] | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<number, { latitude: number; longitude: number }>>({});
  const [routePolyline, setRoutePolyline] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);

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
  const routeStats = useMemo(
    () =>
      groupedStops.length > 0
        ? computeRouteStatsFromGroups(groupedStops)
        : computeRouteStats(ordered),
    [groupedStops, ordered]
  );
  const headerStats = useMemo(
    () => computeRouteHeaderStats(groupedStops, geocodedCoords),
    [groupedStops, geocodedCoords]
  );
  const activeGroupIndex = useMemo(
    () => (isRouteActive ? getActiveGroupIndex(groupedStops, activeStopIndex) : -1),
    [isRouteActive, groupedStops, activeStopIndex]
  );

  const routePointsForOsrm = useMemo(() => {
    const points: Array<{ latitude: number; longitude: number }> = [];
    for (const group of groupedStops) {
      const d = group.deliveries.find(
        (x) =>
          (x.latitude != null && x.longitude != null) ||
          (geocodedCoords[x.id_saida]?.latitude != null && geocodedCoords[x.id_saida]?.longitude != null)
      );
      if (!d) continue;
      const lat = d.latitude ?? geocodedCoords[d.id_saida]?.latitude;
      const lon = d.longitude ?? geocodedCoords[d.id_saida]?.longitude;
      if (lat != null && lon != null) points.push({ latitude: lat, longitude: lon });
    }
    return points;
  }, [groupedStops, geocodedCoords]);

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

  useEffect(() => {
    if (!isRouteActive) {
      setRoutePolyline(null);
      return;
    }
    if (routePointsForOsrm.length < 2) return;
    let cancelled = false;
    fetchOsrmRoutePolyline(routePointsForOsrm).then((poly) => {
      if (!cancelled && poly) setRoutePolyline(poly);
    });
    return () => { cancelled = true; };
  }, [isRouteActive, routePointsForOsrm]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isRouteActive && ordered.length > 0) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.65, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRouteActive, ordered.length, pulseAnim]);

  const getPendingSameAddressRecipient = useCallback(
    (d: EntregaListItem): EntregaListItem[] =>
      ordered.filter(
        (x) =>
          addressAndRecipientKey(x) === addressAndRecipientKey(d) &&
          (routeDeliveryStatus[x.id_saida] ?? "pendente") === "pendente"
      ),
    [ordered, routeDeliveryStatus]
  );

  const handleCriarRota = useCallback(() => {
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
              } catch (e) {
                console.error("[RouteBuilder Criar rota parcial] crash:", e);
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
      if (activeRouteId === null) clearActiveRouteState();
      setRouteDeliveries(deliveriesWithAddress);
    }
  }, [deliveriesWithAddress, deliveriesWithoutAddress.length, setRouteDeliveries, navigation, activeRouteId, clearActiveRouteState]);

  const handleMarkerPress = useCallback((d: EntregaListItem) => {
    setSelectedDelivery(d);
  }, []);

  const handleCloseCard = useCallback(() => {
    setSelectedDelivery(null);
  }, []);

  const handleMarcarEntregue = useCallback(() => {
    if (!selectedDelivery) return;
    const pending = getPendingSameAddressRecipient(selectedDelivery);
    const ids = pending.map((d) => d.id_saida);
    if (ids.length > 1) {
      Alert.alert(
        "Finalizar todos?",
        `Há mais ${ids.length} pedidos para o mesmo destinatário neste endereço. Deseja finalizar todos?`,
        [
          { text: "Não", style: "cancel" as const, onPress: () => setPendingEntregueIds([selectedDelivery.id_saida]) },
          { text: "Sim", onPress: () => setPendingEntregueIds(ids) },
        ]
      );
    } else {
      setPendingEntregueIds([selectedDelivery.id_saida]);
    }
  }, [selectedDelivery, getPendingSameAddressRecipient]);

  const handleConfirmarEntregueBatch = useCallback(
    async (body: EntregueBody) => {
      if (!pendingEntregueIds || pendingEntregueIds.length === 0) return;
      const codigoFeedback = selectedDelivery?.codigo ?? null;
      for (let i = 0; i < pendingEntregueIds.length; i++) {
        await markDelivered(pendingEntregueIds[i], body);
      }
      if (isRouteActive && activeRouteId && pendingEntregueIds.length > 0) {
        await completeStop();
        const nextIdx = useDeliveryStore.getState().activeStopIndex;
        const order = useDeliveryStore.getState().routeOrder;
                if (nextIdx >= order.length) {
                  setRotaFinalizadaTotalParadas(order.length);
                  await finishRoute();
                  playSound("success");
                  setShowRotaFinalizadaModal(true);
                } else {
          playSound("success");
          setCenterOnStopId(order[nextIdx]);
        }
      } else if (pendingEntregueIds && pendingEntregueIds.length > 0) {
        playSound("success");
      }
      setPendingEntregueIds(null);
      setSelectedDelivery(null);
      runPostFinalizeFeedback({ tipo: "entregue", codigo: codigoFeedback });
    },
    [pendingEntregueIds, markDelivered, isRouteActive, activeRouteId, completeStop, finishRoute, selectedDelivery]
  );

  const openAusenteModal = useCallback(() => {
    if (!selectedDelivery) return;
    setDeliveryForAusente(selectedDelivery);
    setShowAusenteModal(true);
    setMotivoId(null);
    setObservacao("");
  }, [selectedDelivery]);

  useEffect(() => {
    if (showAusenteModal && motivos.length === 0) {
      getMotivosAusencia()
        .then((m) => {
          setMotivos(m);
          if (m.length) setMotivoId(m[0].id);
        })
        .catch(() => setMotivos([]));
    }
  }, [showAusenteModal, motivos.length]);

  const handleConfirmarAusente = useCallback(async () => {
    if (!deliveryForAusente) return;
    if (motivoId == null) {
      Alert.alert("Atenção", "Selecione um motivo.");
      return;
    }
    const motivo = motivos.find((m) => m.id === motivoId);
    if (motivo?.descricao.trim().toLowerCase() === "outro" && !observacao.trim()) {
      Alert.alert("Atenção", "Informe a observação quando o motivo for 'Outro'.");
      return;
    }
    const required = new Set((deliveryForAusente?.campos_obrigatorios_ausente || []).map((f) => String(f || "").trim().toLowerCase()));
    const missing: string[] = [];
    if (required.has("observacao") && !observacao.trim()) missing.push("Observação");
    if (required.has("foto")) missing.push("Foto (use tela de detalhe)");
    if (missing.length) {
      Alert.alert("Atenção", `Preencha os campos obrigatórios para concluir este pedido: ${missing.join(", ")}.`);
      return;
    }
    const pending = getPendingSameAddressRecipient(deliveryForAusente);
    const idsToMark =
      pending.length > 1
        ? await new Promise<number[]>((resolve) => {
            Alert.alert(
              "Finalizar todos?",
              `Há mais ${pending.length} pedidos para o mesmo destinatário neste endereço. Deseja finalizar todos?`,
              [
                { text: "Não", style: "cancel" as const, onPress: () => resolve([deliveryForAusente.id_saida]) },
                { text: "Sim", onPress: () => resolve(pending.map((d) => d.id_saida)) },
              ]
            );
          })
        : [deliveryForAusente.id_saida];

    setSaving(true);
    try {
      for (let i = 0; i < idsToMark.length; i++) {
        await markAbsent(idsToMark[i], motivoId, observacao.trim() || undefined);
      }
      if (useDeliveryStore.getState().activeRouteId && idsToMark.length > 0) {
        await completeStop();
        const nextIdx = useDeliveryStore.getState().activeStopIndex;
        const order = useDeliveryStore.getState().routeOrder;
        if (nextIdx < order.length) {
          playSound("warn");
          setCenterOnStopId(order[nextIdx]);
        } else {
          setRotaFinalizadaTotalParadas(order.length);
          await finishRoute();
          playSound("success");
          setShowRotaFinalizadaModal(true);
        }
      } else {
        playSound("warn");
      }
      const codigoFeedback = deliveryForAusente.codigo;
      setShowAusenteModal(false);
      setDeliveryForAusente(null);
      setSelectedDelivery(null);
      runPostFinalizeFeedback({ tipo: "ausente", codigo: codigoFeedback });
    } catch (e: unknown) {
      Alert.alert("Erro", formatApiError(e, "Erro ao salvar."));
    } finally {
      setSaving(false);
    }
  }, [deliveryForAusente, motivoId, motivos, observacao, markAbsent, completeStop, finishRoute, getPendingSameAddressRecipient]);

  const openNavegarModal = useCallback(() => {
    if (!selectedDelivery) return;
    setDeliveryForNavegar(selectedDelivery);
    setShowNavegarModal(true);
  }, [selectedDelivery]);

  const handleNavegarWith = useCallback((url: string) => {
    Linking.openURL(url);
    setShowNavegarModal(false);
    setDeliveryForNavegar(null);
  }, []);

  const handleIniciarRota = useCallback(async () => {
    if (ordered.length === 0) return;
    setIniciandoRota(true);
    try {
      await startActiveRoute();
      playSound("success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao iniciar rota.";
      Alert.alert("Erro", msg);
    } finally {
      setIniciandoRota(false);
    }
  }, [ordered.length, startActiveRoute]);

  const handleCriarEIniciarRota = useCallback(async () => {
    if (routeOrder.length === 0) {
      Alert.alert("Atenção", "Adicione entregas à rota antes de iniciar.");
      return;
    }
    setIniciandoRota(true);
    try {
      if (routeOptimizationMode == null && groupedStops.length >= 2) {
        await optimizeRoute();
      }
      await startActiveRoute();
      playSound("success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar e iniciar rota.";
      Alert.alert("Erro", msg);
    } finally {
      setIniciandoRota(false);
    }
  }, [routeOrder.length, routeOptimizationMode, groupedStops.length, optimizeRoute, startActiveRoute]);

  const handleStopPress = useCallback((group: GroupedStop, stopIndex: number) => {
    setActionSheetGroup(group);
    setActionSheetStopIndex(stopIndex);
  }, []);

  const handleNavegarGroup = useCallback(
    (group: GroupedStop) => {
      const d = group.deliveries.find(
        (x) => x.latitude != null && x.longitude != null
      ) ?? group.deliveries[0];
      if (d?.latitude != null && d?.longitude != null) {
        setDeliveryForNavegar(d);
        setShowNavegarModal(true);
      } else {
        Alert.alert("Atenção", "Esta parada não possui coordenadas para navegação.");
      }
    },
    []
  );

  const handleRemoverGroup = useCallback(() => {
    if (!actionSheetGroup) return;
    const ids = actionSheetGroup.deliveries.map((d) => d.id_saida);
    removeFromRoute(ids);
    setActionSheetGroup(null);
  }, [actionSheetGroup, removeFromRoute]);

  const handleSaveAddress = useCallback(
    async (values: AddressFormValues) => {
      if (!editDelivery) return;
      const updated = await saveAddress(editDelivery.id_saida, { ...values, origem: "manual" });
      updateRouteDelivery(editDelivery.id_saida, updated);
      if (updated.latitude != null && updated.longitude != null) {
        setGeocodedCoords((prev) => ({
          ...prev,
          [updated.id_saida]: { latitude: updated.latitude!, longitude: updated.longitude! },
        }));
      } else {
        const addr = [values.rua, values.numero, values.bairro, values.cidade, values.estado]
          .filter(Boolean)
          .join(", ");
        const geo = await geocodeAddress(addr, {
          cidade: values.cidade,
          estado: values.estado,
          bairro: values.bairro,
          numero: values.numero,
        });
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
      if (isRouteActive && routePointsForOsrm.length >= 2) {
        const poly = await fetchOsrmRoutePolyline(routePointsForOsrm);
        if (poly) setRoutePolyline(poly);
      }
    },
    [editDelivery, saveAddress, updateRouteDelivery, isRouteActive, routePointsForOsrm]
  );

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

  const handleCargoScan = useCallback((codigo: string, inRoute: boolean, idSaida?: number) => {
    if (inRoute && idSaida != null) {
      setCargoScannedIds((prev) => new Set(prev).add(idSaida));
    }
  }, []);

  const handleFecharRotaFinalizada = useCallback(() => {
    setShowRotaFinalizadaModal(false);
    setCenterOnStopId(null);
    navigation.navigate("EntregasList");
  }, [navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingHorizontal: 16,
          paddingTop: Math.max(12, insets.top),
          paddingBottom: 12,
          backgroundColor: colors.backgroundCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        backText: { fontSize: 16, color: colors.primary },
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
        localizedLine: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
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
        sheetOverlay: { position: "absolute", left: 0, right: 0, bottom: 0 },
        cardOverlay: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingBottom: 24,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          padding: 24,
        },
        modalBox: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 24,
          maxHeight: "80%",
        },
        modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, color: colors.text },
        modalRotaFinalizadaPhrase: { fontSize: 16, color: colors.text, textAlign: "center", marginBottom: 4 },
        modalRotaFinalizadaResumo: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 8 },
        radio: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        radioActive: { borderColor: colors.primary, backgroundColor: colors.backgroundCard },
        radioText: { fontSize: 16, color: colors.text },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          backgroundColor: colors.inputBackground,
          color: colors.text,
          minHeight: 80,
          textAlignVertical: "top",
          marginTop: 8,
          marginBottom: 16,
        },
        modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
        modalBtnCancel: { flex: 1, paddingVertical: 12, alignItems: "center" },
        modalBtnCancelText: { fontSize: 16, color: colors.textSecondary },
        modalBtnOk: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.primary,
        },
        modalBtnOkText: { fontSize: 16, fontWeight: "600", color: colors.primaryContrast },
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

  const selectedOrderNumber = useMemo(() => {
    if (!selectedDelivery) return undefined;
    const idx = routeOrder.indexOf(selectedDelivery.id_saida);
    return idx >= 0 ? idx + 1 : undefined;
  }, [routeOrder, selectedDelivery]);

  const activeGroupIndex1Based = useMemo(() => {
    if (groupedStops.length === 0) return 1;
    let idx = 0;
    for (let i = 0; i < groupedStops.length; i++) {
      if (activeStopIndex < idx + groupedStops[i].deliveries.length) return i + 1;
      idx += groupedStops[i].deliveries.length;
    }
    return groupedStops.length;
  }, [groupedStops, activeStopIndex]);

  const selectedStatus = selectedDelivery
    ? (routeDeliveryStatus[selectedDelivery.id_saida] ?? "pendente")
    : "pendente";

  const modalRotaFinalizada = (
    <Modal visible={showRotaFinalizadaModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Rota finalizada</Text>
          <SuccessLottie visible={showRotaFinalizadaModal} />
          <Text style={styles.modalRotaFinalizadaPhrase}>Parabéns! Você concluiu sua rota.</Text>
          {rotaFinalizadaTotalParadas > 0 && (
            <Text style={styles.modalRotaFinalizadaResumo}>
              {rotaFinalizadaTotalParadas} parada{rotaFinalizadaTotalParadas !== 1 ? "s" : ""} concluída
              {rotaFinalizadaTotalParadas !== 1 ? "s" : ""} hoje
            </Text>
          )}
          <TouchableOpacity
            style={[styles.modalBtnOk, { marginTop: 16 }]}
            onPress={handleFecharRotaFinalizada}
          >
            <Text style={styles.modalBtnOkText}>Ver listagem</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.mapFull}>
        <DeliveryMap
          onMarkerPress={handleMarkerPress}
          selectedId={selectedDelivery?.id_saida ?? null}
          centerOnStopId={centerOnStopId}
          geocodedCoords={geocodedCoords}
          routePolyline={routePolyline ?? undefined}
        />
      </View>

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
        </View>
        {ordered.length > 0 && (
          <>
            <Text style={styles.statsLine}>
              <Text style={styles.statValue}>{headerStats.stopCount}</Text> parada
              {headerStats.stopCount !== 1 ? "s" : ""}
              {" · "}
              <Text style={styles.statValue}>{headerStats.pedidoCount}</Text> pedido
              {headerStats.pedidoCount !== 1 ? "s" : ""}
              {!isRouteActive && (
                <>
                  {" · "}
                  <Text style={styles.statValue}>{routeStats.distanceKm.toFixed(1)}</Text> km
                  {" · ~"}
                  <Text style={styles.statValue}>{routeStats.estimatedMinutes}</Text> min
                </>
              )}
            </Text>
            {isRouteActive ? (
              <Text style={styles.localizedLine}>
                Parada <Text style={styles.statValue}>{activeGroupIndex1Based}</Text> de{" "}
                <Text style={styles.statValue}>{groupedStops.length}</Text>
              </Text>
            ) : (
              <Text style={styles.localizedLine}>
                ✓ {headerStats.localizedStops} localizado{headerStats.localizedStops !== 1 ? "s" : ""}
                {headerStats.reviewCount > 0 && (
                  <>
                    {" · "}⚠ {headerStats.reviewCount} precisam revisão
                  </>
                )}
              </Text>
            )}
          </>
        )}
        {!isRouteActive && headerStats.reviewCount > 0 && (
          <TouchableOpacity style={styles.badgeReview} onPress={() => setShowReviewModal(true)}>
            <Text style={styles.badgeRotaText}>
              ⚠ {headerStats.reviewCount} endereço{headerStats.reviewCount !== 1 ? "s" : ""} precisam revisão
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerButtons}>
          {ordered.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.headerBtnSmall}
                onPress={() => {
                  setScanMode("locate");
                  setShowLocateSheet(true);
                }}
              >
                <Text style={styles.headerBtnSmallText}>Localizar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerBtnSmall,
                  scanMode === "cargo" && showLocateSheet && styles.headerBtnSmallActive,
                ]}
                onPress={() => {
                  setScanMode("cargo");
                  setShowLocateSheet(true);
                }}
              >
                <Text style={styles.headerBtnSmallText}>Conferir</Text>
              </TouchableOpacity>
            </>
          )}
          {!isRouteActive && ordered.length > 0 && (
            <>
              <TouchableOpacity style={styles.headerBtnSmall} onPress={() => setShowQuickAdd(true)}>
                <Text style={styles.headerBtnSmallText}>+ Parada</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtnSmall} onPress={() => setShowBulkImport(true)}>
                <Text style={styles.headerBtnSmallText}>Importar</Text>
              </TouchableOpacity>
            </>
          )}
          {!isRouteActive && (
            <TouchableOpacity style={styles.headerBtn} onPress={handleCriarRota}>
              <Text style={styles.headerBtnText}>Criar Rota</Text>
            </TouchableOpacity>
          )}
          {!isRouteActive && ordered.length > 0 && (
            <>
              <Animated.View style={{ opacity: pulseAnim }}>
                <TouchableOpacity
                  style={[styles.headerBtn, styles.headerBtnSecondary]}
                  onPress={handleCriarEIniciarRota}
                  disabled={iniciandoRota}
                >
                  <Text style={styles.headerBtnSecondaryText}>
                    {iniciandoRota ? "Iniciando…" : "Criar e iniciar"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity
                style={[styles.headerBtn, styles.headerBtnSecondary]}
                onPress={handleIniciarRota}
                disabled={iniciandoRota}
              >
                <Text style={styles.headerBtnSecondaryText}>
                  {iniciandoRota ? "Iniciando…" : "Iniciar Rota"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.sheetOverlay}>
        <RouteBottomSheet
          disableDrag={isRouteActive}
          activeGroupIndex={activeGroupIndex}
          onStopPress={handleStopPress}
        />
      </View>

      <RouteStopActionSheet
        visible={actionSheetGroup != null}
        group={actionSheetGroup}
        stopIndex={actionSheetStopIndex}
        totalStops={groupedStops.length}
        disableMutations={isRouteActive}
        onClose={() => setActionSheetGroup(null)}
        onNavegar={() => actionSheetGroup && handleNavegarGroup(actionSheetGroup)}
        onVerPedidos={() => {
          if (actionSheetGroup) {
            setPedidosGroup(actionSheetGroup);
            setShowPedidosModal(true);
          }
        }}
        onEditarEndereco={(d) => setEditDelivery(d)}
        onAlterarPosicao={(toIndex) => {
          moveGroupedStopToIndex(actionSheetStopIndex - 1, toIndex);
        }}
        onMoverInicio={() => moveGroupedStopToStart(actionSheetStopIndex - 1)}
        onMoverFim={() => moveGroupedStopToEnd(actionSheetStopIndex - 1)}
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
        mode={scanMode}
        totalStops={groupedStops.length}
        totalPedidos={headerStats.pedidoCount}
        cargoScannedCount={cargoScannedIds.size}
        onFindByCodigo={(codigo) => {
          const found = findInRouteByCodigo(codigo);
          if (!found) return null;
          return {
            stopIndex: found.stopIndex,
            delivery: found.delivery,
            totalStops: groupedStops.length,
          };
        }}
        onCargoScan={handleCargoScan}
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
        <View style={[styles.cardOverlay, { paddingBottom: 24 + Math.max(0, insets.bottom) }]}>
          <RouteMarkerCard
            delivery={selectedDelivery}
            status={selectedStatus}
            orderNumber={selectedOrderNumber}
            canMarkDelivery={isRouteActive}
            onClose={handleCloseCard}
            onMarcarEntregue={handleMarcarEntregue}
            onMarcarAusente={openAusenteModal}
            onNavegar={openNavegarModal}
          />
        </View>
      )}

      <Modal visible={showAusenteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Motivo da ausência</Text>
            {motivos.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.radio, motivoId === m.id && styles.radioActive]}
                onPress={() => setMotivoId(m.id)}
              >
                <Text style={styles.radioText}>{m.descricao}</Text>
              </TouchableOpacity>
            ))}
            {motivoId !== null &&
              motivos.find((m) => m.id === motivoId)?.descricao.trim().toLowerCase() === "outro" && (
                <TextInput
                  style={styles.input}
                  placeholder="Observação (obrigatório)"
                  placeholderTextColor={colors.placeholder}
                  value={observacao}
                  onChangeText={setObservacao}
                  multiline
                />
              )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setShowAusenteModal(false);
                  setDeliveryForAusente(null);
                }}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnOk}
                onPress={handleConfirmarAusente}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.modalBtnOkText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNavegarModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowNavegarModal(false);
            setDeliveryForNavegar(null);
          }}
        >
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Navegar com:</Text>
            {deliveryForNavegar?.latitude != null && deliveryForNavegar?.longitude != null && (
              <>
                <TouchableOpacity
                  style={styles.navOption}
                  onPress={() =>
                    handleNavegarWith(
                      getGoogleMapsUrl(deliveryForNavegar.latitude!, deliveryForNavegar.longitude!)
                    )
                  }
                >
                  <Text style={styles.navOptionText}>Google Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navOption}
                  onPress={() =>
                    handleNavegarWith(
                      getWazeUrl(deliveryForNavegar.latitude!, deliveryForNavegar.longitude!)
                    )
                  }
                >
                  <Text style={styles.navOptionText}>Waze</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.modalBtnCancel}
              onPress={() => {
                setShowNavegarModal(false);
                setDeliveryForNavegar(null);
              }}
            >
              <Text style={styles.modalBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {modalRotaFinalizada}
      <FormEntregaConcluida
        visible={pendingEntregueIds != null && pendingEntregueIds.length > 0}
        idSaida={pendingEntregueIds?.[0] ?? 0}
        destinatarioPreenchido={selectedDelivery?.cliente ?? undefined}
        requiredFields={selectedDelivery?.campos_obrigatorios_entregue || []}
        onConfirm={handleConfirmarEntregueBatch}
        onClose={() => setPendingEntregueIds(null)}
        onSuccess={() => {}}
      />
    </View>
  );
}
