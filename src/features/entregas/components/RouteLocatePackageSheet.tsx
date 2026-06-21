import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import { getStopAddressLine } from "../utils/routeUtils";
import type { EntregaListItem } from "../types";
import { useScannerTorch } from "../hooks/useScannerTorch";
import ScannerTorchButton from "./ScannerTorchButton";

const SCAN_DEBOUNCE_MS = 1500;
const BARCODE_TYPES: import("expo-camera").BarcodeType[] = ["qr"];

interface LocateResult {
  stopIndex: number;
  delivery: EntregaListItem;
  sameStopDeliveries: EntregaListItem[];
  totalStops: number;
  ambiguousMatches?: LocateResult[];
}

interface RouteLocatePackageSheetProps {
  visible: boolean;
  totalStops: number;
  onFindByQuery: (query: string) => LocateResult | null;
  onViewStop: (stopIndex: number) => void;
  onNavigate: (stopIndex: number) => void;
  onEditAddress: (delivery: EntregaListItem) => void;
  onChangePosition: (stopIndex: number) => void;
  onClose: () => void;
}

export default function RouteLocatePackageSheet({
  visible,
  totalStops,
  onFindByQuery,
  onViewStop,
  onNavigate,
  onEditAddress,
  onChangePosition,
  onClose,
}: RouteLocatePackageSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<LocateResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const lastScanRef = useRef(0);
  const torch = useScannerTorch(visible && !!permission?.granted);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        scroll: { flex: 1 },
        scrollContent: { padding: 16, paddingBottom: 32 },
        hint: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
        searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
        searchInput: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: colors.text,
          backgroundColor: colors.inputBackground,
        },
        searchBtn: {
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: colors.primary,
          justifyContent: "center",
          alignItems: "center",
        },
        camera: {
          width: "100%",
          height: Dimensions.get("window").height * 0.32,
          borderRadius: 12,
          overflow: "hidden",
        },
        cameraWrap: {
          position: "relative",
          width: "100%",
          height: Dimensions.get("window").height * 0.32,
          marginBottom: 16,
        },
        resultBox: {
          padding: 20,
          borderRadius: 12,
          backgroundColor: colors.success + "18",
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.success + "40",
        },
        stopMeta: {
          fontSize: 14,
          fontWeight: "700",
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: 4,
        },
        heroNumber: {
          fontSize: 56,
          fontWeight: "900",
          color: colors.primary,
          textAlign: "center",
          lineHeight: 62,
        },
        annotateHint: {
          fontSize: 13,
          color: colors.textSecondary,
          textAlign: "center",
          fontStyle: "italic",
          marginTop: 8,
          marginBottom: 8,
        },
        pedidosMeta: {
          fontSize: 15,
          fontWeight: "600",
          color: colors.text,
          textAlign: "center",
          marginBottom: 12,
        },
        codigoItem: {
          fontSize: 17,
          fontWeight: "800",
          color: colors.primary,
          textAlign: "center",
          marginBottom: 8,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        },
        codigoItemHighlight: {
          backgroundColor: colors.primary + "15",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 8,
          overflow: "hidden",
        },
        addressLine: {
          fontSize: 15,
          color: colors.text,
          textAlign: "center",
          marginTop: 8,
          lineHeight: 22,
        },
        actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
        actionBtn: {
          flexGrow: 1,
          minWidth: "45%",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 12,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        actionBtnPrimary: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        actionBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
        actionBtnTextPrimary: { color: colors.primaryContrast },
        ambiguousBox: {
          marginTop: 12,
          padding: 12,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
        },
        ambiguousTitle: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 8 },
        ambiguousItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.separator },
        btn: {
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginTop: 8,
        },
        btnText: { fontSize: 15, fontWeight: "600", color: colors.primaryContrast },
        permText: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
      }),
    [colors]
  );

  const applySearch = useCallback(
    (raw: string) => {
      const query = raw.trim();
      if (!query) return;
      const found = onFindByQuery(query);
      if (found) {
        setResult(found);
      } else {
        Alert.alert("Pacote não encontrado", `Nenhum resultado para "${query}" nesta rota.`);
      }
    },
    [onFindByQuery]
  );

  const handleBarcode = useCallback(
    (scan: BarcodeScanningResult) => {
      const now = Date.now();
      if (now - lastScanRef.current < SCAN_DEBOUNCE_MS) return;
      lastScanRef.current = now;
      const parsed = parseCodigoQrRaw(scan.data);
      const codigo = (parsed.codigo || scan.data).trim();
      if (!codigo) return;
      setSearchQuery(codigo);
      applySearch(codigo);
    },
    [applySearch]
  );

  const handleClose = () => {
    setResult(null);
    setSearchQuery("");
    onClose();
  };

  const renderResult = (r: LocateResult, compact?: boolean) => (
    <View style={styles.resultBox} key={r.delivery.id_saida}>
      <Text style={styles.stopMeta}>
        Parada {r.stopIndex + 1} de {r.totalStops}
      </Text>
      <Text style={styles.heroNumber}>{r.stopIndex + 1}</Text>
      <Text style={styles.pedidosMeta}>
        {r.sameStopDeliveries.length} pacote
        {r.sameStopDeliveries.length !== 1 ? "s" : ""}
      </Text>
      {r.sameStopDeliveries.length > 1 ? (
        <Text style={styles.annotateHint}>Anote o número {r.stopIndex + 1} no pacote</Text>
      ) : null}
      {r.sameStopDeliveries.map((d) => {
        const isMatch = d.id_saida === r.delivery.id_saida;
        const codigo = d.codigo?.trim() || "—";
        return (
          <Text
            key={d.id_saida}
            style={[styles.codigoItem, isMatch && styles.codigoItemHighlight]}
          >
            {codigo}
          </Text>
        );
      })}
      <Text style={styles.addressLine}>{getStopAddressLine(r.delivery)}</Text>
      {!compact && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => onViewStop(r.stopIndex)}
          >
            <Ionicons name="location-outline" size={18} color={colors.primaryContrast} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Ver parada</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onNavigate(r.stopIndex)}
          >
            <Ionicons name="navigate-outline" size={18} color={colors.text} />
            <Text style={styles.actionBtnText}>Navegar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onEditAddress(r.delivery)}
          >
            <Ionicons name="create-outline" size={18} color={colors.text} />
            <Text style={styles.actionBtnText}>Editar endereço</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onChangePosition(r.stopIndex)}
          >
            <Ionicons name="swap-vertical-outline" size={18} color={colors.text} />
            <Text style={styles.actionBtnText}>Alterar posição</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.screen} edges={["bottom"]}>
        <ScreenHeaderBar
          title="Localizar pacote"
          onBack={handleClose}
          paddingTop={Math.max(12, insets.top)}
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.hint}>
            Busque pelo código ou pedido, ou escaneie a etiqueta ({totalStops} paradas no total).
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Código ou nº do pedido"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => applySearch(searchQuery)}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={() => applySearch(searchQuery)}>
              <Ionicons name="search" size={20} color={colors.primaryContrast} />
            </TouchableOpacity>
          </View>

          {!permission?.granted ? (
            <>
              <Text style={styles.permText}>Permissão de câmera necessária para escanear etiquetas.</Text>
              <TouchableOpacity style={styles.btn} onPress={requestPermission}>
                <Text style={styles.btnText}>Permitir câmera</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                enableTorch={torch.enableTorch}
                onCameraReady={torch.onCameraReady}
                onBarcodeScanned={handleBarcode}
              />
              <ScannerTorchButton mode={torch.mode} onPress={torch.cycleMode} />
            </View>
          )}

          {result && renderResult(result)}

          {result?.ambiguousMatches && result.ambiguousMatches.length > 0 ? (
            <View style={styles.ambiguousBox}>
              <Text style={styles.ambiguousTitle}>Outros resultados</Text>
              {result.ambiguousMatches.map((m) => (
                <TouchableOpacity
                  key={m.delivery.id_saida}
                  style={styles.ambiguousItem}
                  onPress={() => setResult(m)}
                >
                  <Text style={styles.actionBtnText}>
                    Parada {m.stopIndex + 1} · {m.delivery.codigo ?? m.delivery.id_saida}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
