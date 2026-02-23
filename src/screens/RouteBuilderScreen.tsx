import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Linking } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useThemeColors } from "../theme/colors";
import DeliveryMap from "../components/DeliveryMap";
import RouteBottomSheet from "../components/RouteBottomSheet";
import RouteMarkerCard from "../components/RouteMarkerCard";
import { useDeliveryStore } from "../store/deliveryStore";
import { getMotivosAusencia } from "../features/entregas/api";
import { getOrderedRouteDeliveries, computeRouteStats } from "../features/entregas/utils/routeUtils";
import type { EntregaListItem, MotivoAusencia } from "../features/entregas/types";

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
  const optimizeRoute = useDeliveryStore((s) => s.optimizeRoute);
  const activeRouteId = useDeliveryStore((s) => s.activeRouteId);
  const activeStopIndex = useDeliveryStore((s) => s.activeStopIndex);
  const startActiveRoute = useDeliveryStore((s) => s.startActiveRoute);
  const completeStop = useDeliveryStore((s) => s.completeStop);
  const finishRoute = useDeliveryStore((s) => s.finishRoute);

  const isRouteActive = activeRouteId != null;

  const [showToast, setShowToast] = useState(false);
  const [showRotaFinalizadaModal, setShowRotaFinalizadaModal] = useState(false);
  const [centerOnStopId, setCenterOnStopId] = useState<number | null>(null);
  const [iniciandoRota, setIniciandoRota] = useState(false);

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );
  const routeStats = useMemo(() => computeRouteStats(ordered), [ordered]);
  const isPartialRoute = deliveriesWithoutAddress.length > 0;

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 2000);
    return () => clearTimeout(t);
  }, [showToast]);

  const handleOtimizar = useCallback(() => {
    optimizeRoute();
    setShowToast(true);
  }, [optimizeRoute]);

  const handleCriarRota = useCallback(() => {
    if (deliveriesWithAddress.length === 0) {
      Alert.alert("Atenção", "Nenhuma entrega possui endereço válido.");
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
            onPress: () => setRouteDeliveries(deliveriesWithAddress),
          },
          {
            text: "Adicionar endereços",
            onPress: () => navigation.navigate("PrepareDeliveries"),
          },
        ]
      );
    } else {
      setRouteDeliveries(deliveriesWithAddress);
    }
  }, [deliveriesWithAddress, deliveriesWithoutAddress.length, setRouteDeliveries, navigation]);

  const handleMarkerPress = useCallback((d: EntregaListItem) => {
    setSelectedDelivery(d);
  }, []);

  const handleCloseCard = useCallback(() => {
    setSelectedDelivery(null);
  }, []);

  const handleMarcarEntregue = useCallback(async () => {
    if (!selectedDelivery) return;
    const id = selectedDelivery.id_saida;
    try {
      await markDelivered(id, {});
      setSelectedDelivery(null);
      if (isRouteActive && activeRouteId) {
        await completeStop();
        const nextIdx = useDeliveryStore.getState().activeStopIndex;
        const order = useDeliveryStore.getState().routeOrder;
        if (nextIdx < order.length) {
          setCenterOnStopId(order[nextIdx]);
        } else {
          await finishRoute();
          setShowRotaFinalizadaModal(true);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao marcar entregue.";
      Alert.alert("Erro", msg);
    }
  }, [selectedDelivery, markDelivered, isRouteActive, activeRouteId, completeStop, finishRoute]);

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
    setSaving(true);
    try {
      await markAbsent(deliveryForAusente.id_saida, motivoId, observacao.trim() || undefined);
      setShowAusenteModal(false);
      setDeliveryForAusente(null);
      setSelectedDelivery(null);
      const active = useDeliveryStore.getState().activeRouteId;
      if (active) {
        await completeStop();
        const nextIdx = useDeliveryStore.getState().activeStopIndex;
        const order = useDeliveryStore.getState().routeOrder;
        if (nextIdx < order.length) {
          setCenterOnStopId(order[nextIdx]);
        } else {
          await finishRoute();
          setShowRotaFinalizadaModal(true);
        }
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Erro ao salvar.";
      Alert.alert("Erro", String(msg));
    } finally {
      setSaving(false);
    }
  }, [deliveryForAusente, motivoId, motivos, observacao, markAbsent, completeStop, finishRoute]);

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao iniciar rota.";
      Alert.alert("Erro", msg);
    } finally {
      setIniciandoRota(false);
    }
  }, [ordered.length, startActiveRoute]);

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
        headerButtons: { flexDirection: "row", gap: 8, alignItems: "center" },
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
        toast: {
          position: "absolute",
          bottom: 120,
          left: 24,
          right: 24,
          zIndex: 20,
          backgroundColor: colors.primary,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          alignItems: "center",
        },
        toastText: { fontSize: 14, fontWeight: "600", color: colors.primaryContrast },
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

  const selectedStatus = selectedDelivery
    ? (routeDeliveryStatus[selectedDelivery.id_saida] ?? "pendente")
    : "pendente";

  const modalRotaFinalizada = (
    <Modal visible={showRotaFinalizadaModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Rota finalizada</Text>
          <Text style={styles.modalBtnCancelText}>Parabéns! Você concluiu todas as paradas.</Text>
          <TouchableOpacity
            style={[styles.modalBtnOk, { marginTop: 16 }]}
            onPress={handleFecharRotaFinalizada}
          >
            <Text style={styles.modalBtnOkText}>OK</Text>
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
        />
      </View>

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerStats}>
          <Text style={styles.statText}>
            <Text style={styles.statValue}>{ordered.length}</Text> parada{ordered.length !== 1 ? "s" : ""}
          </Text>
          {isRouteActive ? (
            <Text style={styles.statText}>
              Parada <Text style={styles.statValue}>{activeStopIndex + 1}</Text> de <Text style={styles.statValue}>{routeOrder.length}</Text>
            </Text>
          ) : (
            <>
              <Text style={styles.statText}>
                <Text style={styles.statValue}>{routeStats.distanceKm.toFixed(1)}</Text> km
              </Text>
              <Text style={styles.statText}>
                ~<Text style={styles.statValue}>{routeStats.estimatedMinutes}</Text> min
              </Text>
            </>
          )}
        </View>
        {!isRouteActive && (
        <View style={[styles.badgeRota, { backgroundColor: isPartialRoute ? colors.warning + "30" : colors.success + "30" }]}>
          <Text>{isPartialRoute ? "🟡" : "🟢"}</Text>
          <Text style={styles.badgeRotaText}>
            {isPartialRoute ? "Rota parcial" : "Rota completa"}
          </Text>
        </View>
        )}
        <View style={styles.headerButtons}>
          {!isRouteActive && (
            <>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleOtimizar}
            disabled={ordered.length < 2}
          >
            <Text style={styles.headerBtnText}>Otimizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleCriarRota}>
            <Text style={styles.headerBtnText}>Criar Rota</Text>
          </TouchableOpacity>
          {isPartialRoute && (
            <TouchableOpacity
              style={styles.headerBtnSecondary}
              onPress={() => navigation.navigate("PrepareDeliveries")}
            >
              <Text style={styles.headerBtnSecondaryText}>Adicionar Endereços</Text>
            </TouchableOpacity>
          )}
            </>
          )}
          {!isRouteActive && ordered.length > 0 && (
            <TouchableOpacity
              style={[styles.headerBtn, styles.headerBtnSecondary]}
              onPress={handleIniciarRota}
              disabled={iniciandoRota}
            >
              <Text style={styles.headerBtnSecondaryText}>
                {iniciandoRota ? "Iniciando…" : "Iniciar Rota"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>Rota otimizada com sucesso.</Text>
        </View>
      )}

      <View style={styles.sheetOverlay}>
        <RouteBottomSheet disableDrag={isRouteActive} />
      </View>

      {selectedDelivery && (
        <View style={[styles.cardOverlay, { paddingBottom: 24 + Math.max(0, insets.bottom) }]}>
          <RouteMarkerCard
            delivery={selectedDelivery}
            status={selectedStatus}
            orderNumber={selectedOrderNumber}
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
    </View>
  );
}
