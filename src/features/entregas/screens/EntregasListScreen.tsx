import React, { useCallback, useState, useMemo } from "react";
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
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { getEntregas } from "../api";
import type { EntregaListItem } from "../types";
import { useDeliveryStore } from "../../../store/deliveryStore";

type Props = NativeStackScreenProps<RootStackParamList, "EntregasList">;

type Tab = "pendente" | "finalizadas" | "ausentes";

const TAB_LABELS: Record<Tab, string> = {
  pendente: "Pendentes",
  finalizadas: "Finalizadas",
  ausentes: "Ausentes",
};

function servicoTipo(serv?: string | null): "Shopee" | "Flex" | "Avulso" {
  const s = (serv || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("mercado") || s.includes("ml") || s.includes("flex")) return "Flex";
  return "Avulso";
}

const SERVICO_ORDER: ("Shopee" | "Flex" | "Avulso")[] = ["Shopee", "Flex", "Avulso"];
const SERVICO_COLORS: Record<string, string> = {
  Shopee: "#ee4d2d",
  Flex: "#ffe066",
  Avulso: "#6366f1",
};

const defaultExpanded: Record<string, boolean> = { Shopee: true, Flex: true, Avulso: true };

const DEFAULT_REGION = { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export default function EntregasListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("pendente");
  const [list, setList] = useState<EntregaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedServico, setExpandedServico] = useState<Record<string, boolean>>(defaultExpanded);
  const [saving, setSaving] = useState(false);

  const {
    pendingDeliveries,
    mapMode,
    setMapMode,
    selectedDelivery,
    setSelectedDelivery,
    loadDeliveries,
    markDelivered,
    suggestRoute,
    suggestedOrder,
    loading: storeLoading,
  } = useDeliveryStore();
  const [showNavegarModal, setShowNavegarModal] = useState(false);

  const listForTab = tab === "pendente" ? pendingDeliveries : list;
  const loadingForTab = tab === "pendente" ? storeLoading : loading;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEntregas(tab);
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      if (tab === "pendente") {
        loadDeliveries();
      } else {
        load();
      }
    }, [tab, loadDeliveries, load])
  );

  const badgeColor = (exibicao: string) => {
    if (exibicao === "Pendente") return "#ffc107";
    if (exibicao === "Entregue") return "#198754";
    if (exibicao === "Ausente") return "#dc3545";
    return "#6c757d";
  };

  const contagemPorServico = React.useMemo(() => {
    const c: Record<string, number> = { Shopee: 0, Flex: 0, Avulso: 0 };
    listForTab.forEach((item) => {
      const t = servicoTipo(item.servico);
      c[t]++;
    });
    return c;
  }, [listForTab]);

  const listWithSections: { section: string; data: EntregaListItem[] }[] =
    tab === "pendente"
      ? SERVICO_ORDER.filter((s) => contagemPorServico[s] > 0).map((section) => ({
          section,
          data: orderedPendentes.filter((item) => servicoTipo(item.servico) === section),
        }))
      : [{ section: "", data: listForTab }];

  const entregasComCoords = useMemo(
    () => listForTab.filter((d) => d.latitude != null && d.longitude != null),
    [listForTab]
  );

  const orderedPendentes = useMemo(() => {
    if (tab !== "pendente" || !suggestedOrder || suggestedOrder.length === 0) return listForTab;
    const orderMap = new Map(suggestedOrder.map((id, i) => [id, i]));
    return [...listForTab].sort((a, b) => (orderMap.get(a.id_saida) ?? 999) - (orderMap.get(b.id_saida) ?? 999));
  }, [tab, listForTab, suggestedOrder]);

  const firstDestWithCoords = useMemo(
    () => orderedPendentes.find((d) => d.latitude != null && d.longitude != null),
    [orderedPendentes]
  );

  const handleSugerirRota = useCallback(() => {
    suggestRoute();
    setShowNavegarModal(true);
  }, [suggestRoute]);

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
    if (entregasComCoords.length === 0) return DEFAULT_REGION;
    const lats = entregasComCoords.map((d) => d.latitude!);
    const lons = entregasComCoords.map((d) => d.longitude!);
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
  }, [entregasComCoords]);

  const handleMarcarEntregue = useCallback(
    async (idSaida: number) => {
      setSaving(true);
      try {
        await markDelivered(idSaida);
        setSelectedDelivery(null);
      } finally {
        setSaving(false);
      }
    },
    [markDelivered, setSelectedDelivery]
  );


  const toggleServico = (s: string) => {
    setExpandedServico((prev) => ({ ...prev, [s]: !prev[s] }));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(16, insets.top) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Entregas</Text>
      </View>

      <View style={styles.tabs}>
        {(["pendente", "finalizadas", "ausentes"] as const).map((t) => (
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

      {tab === "pendente" && listForTab.length > 0 && (
        <TouchableOpacity style={styles.btnSugerirRota} onPress={handleSugerirRota}>
          <Text style={styles.btnSugerirRotaText}>🧭 Sugerir Rota</Text>
        </TouchableOpacity>
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

      {tab === "pendente" && !loadingForTab && listForTab.length > 0 && (
        <View style={styles.cardsRow}>
          {SERVICO_ORDER.map((s) => (
            <View key={s} style={[styles.servicoCard, { borderTopColor: SERVICO_COLORS[s] || "#999" }]}>
              <Text style={styles.servicoCardLabel}>{s}</Text>
              <Text style={styles.servicoCardValue}>{contagemPorServico[s] ?? 0}</Text>
            </View>
          ))}
        </View>
      )}

      {loadingForTab ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : tab === "pendente" && mapMode === "map" ? (
        <View style={styles.mapWrap}>
          <MapView style={styles.map} initialRegion={mapRegion} region={mapRegion}>
            {entregasComCoords.map((item) => (
              <Marker
                key={item.id_saida}
                coordinate={{ latitude: item.latitude!, longitude: item.longitude! }}
                pinColor={SERVICO_COLORS[servicoTipo(item.servico)] || "#999"}
                onPress={() => setSelectedDelivery(item)}
              />
            ))}
          </MapView>
          <Modal visible={!!selectedDelivery} transparent animationType="slide">
            <TouchableOpacity
              style={styles.bottomSheetOverlay}
              activeOpacity={1}
              onPress={() => setSelectedDelivery(null)}
            />
            <View style={[styles.bottomSheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
              {selectedDelivery && (
                <>
                  <Text style={styles.bottomSheetTitle}>{selectedDelivery.codigo ?? "—"}</Text>
                  <Text style={styles.bottomSheetCliente}>{selectedDelivery.cliente ?? "—"}</Text>
                  <Text style={styles.bottomSheetEndereco}>
                    {selectedDelivery.endereco_formatado || selectedDelivery.endereco || "—"}
                  </Text>
                  <View style={styles.bottomSheetActions}>
                    <TouchableOpacity
                      style={[styles.bottomSheetBtnEntregue, saving && styles.btnDisabled]}
                      onPress={() => handleMarcarEntregue(selectedDelivery.id_saida)}
                      disabled={saving}
                    >
                      <Text style={styles.bottomSheetBtnText}>Marcar como entregue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.bottomSheetBtnAusente, saving && styles.btnDisabled]}
                      onPress={() => navigation.navigate("EntregaDetail", { idSaida: selectedDelivery.id_saida })}
                      disabled={saving}
                    >
                      <Text style={styles.bottomSheetBtnText}>Marcar como ausente</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.bottomSheetFechar} onPress={() => setSelectedDelivery(null)}>
                    <Text style={styles.bottomSheetFecharText}>Fechar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Modal>

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
                    style={styles.sectionHeaderWrap}
                    onPress={() => toggleServico(section.section)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionHeader}>
                      {isExpanded ? "▼ " : "▶ "}
                      {section.section}
                    </Text>
                    <Text style={styles.sectionCount}>{section.data.length}</Text>
                  </TouchableOpacity>
                ) : null}
                {isExpanded &&
                  section.data.map((item) => (
                    <TouchableOpacity
                      key={item.id_saida}
                      style={styles.item}
                      onPress={() => navigation.navigate("EntregaDetail", { idSaida: item.id_saida })}
                    >
                      <View style={styles.itemRow}>
                        <Text style={styles.itemCodigo}>{item.codigo || "—"}</Text>
                        <View style={styles.badgesRow}>
                          <View style={[styles.servicoBadge, { backgroundColor: SERVICO_COLORS[servicoTipo(item.servico)] || "#999" }]}>
                            <Text style={styles.servicoBadgeText}>{servicoTipo(item.servico)}</Text>
                          </View>
                          <View style={[styles.badge, { backgroundColor: badgeColor(item.exibicao) }]}>
                            <Text style={styles.badgeText}>{item.exibicao}</Text>
                          </View>
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
                    </TouchableOpacity>
                  ))}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  backText: { fontSize: 16, color: "#0d6efd", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#0d6efd" },
  tabText: { fontSize: 14, color: "#666" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  btnSugerirRota: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#198754",
    alignItems: "center",
  },
  btnSugerirRotaText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  toggleRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalBox: { backgroundColor: "#fff", borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  modalMessage: { fontSize: 14, color: "#666", marginBottom: 16 },
  navegarBtn: {
    backgroundColor: "#0d6efd",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  navegarBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  modalBtnCancel: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
  modalBtnCancelText: { color: "#666", fontSize: 16 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8, backgroundColor: "#fff" },
  toggleBtnActive: { backgroundColor: "#0d6efd" },
  toggleText: { fontSize: 14, color: "#666" },
  toggleTextActive: { color: "#fff", fontWeight: "600" },
  loader: { marginTop: 48 },
  listContent: { padding: 16, paddingBottom: 32 },
  mapWrap: { flex: 1, minHeight: Dimensions.get("window").height * 0.5 },
  map: { width: "100%", height: "100%", minHeight: 400 },
  bottomSheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingTop: 16,
  },
  bottomSheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  bottomSheetCliente: { fontSize: 16, color: "#333", marginBottom: 8 },
  bottomSheetEndereco: { fontSize: 14, color: "#666", marginBottom: 16 },
  bottomSheetActions: { flexDirection: "row", gap: 12, marginBottom: 12 },
  bottomSheetBtnEntregue: { flex: 1, backgroundColor: "#198754", paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  bottomSheetBtnAusente: { flex: 1, backgroundColor: "#dc3545", paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  bottomSheetBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  bottomSheetFechar: { alignItems: "center", paddingVertical: 8 },
  bottomSheetFecharText: { color: "#0d6efd", fontSize: 16 },
  cardsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  servicoCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderTopWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  servicoCardLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
  servicoCardValue: { fontSize: 20, fontWeight: "700", color: "#333" },
  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  sectionCount: { fontSize: 13, color: "#666" },
  badgesRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  servicoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  servicoBadgeText: { fontSize: 11, color: "#fff", fontWeight: "600" },
  item: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemCodigo: { fontSize: 16, fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  itemCliente: { fontSize: 14, color: "#333" },
  itemRow2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  itemBairro: { fontSize: 13, color: "#666" },
  enderecoOk: { fontSize: 12, color: "#198754", fontWeight: "500" },
  enderecoFalta: { fontSize: 12, color: "#dc3545" },
});
