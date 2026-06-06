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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useThemeColors } from "../../../theme/colors";
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import { getStopAddressLine } from "../utils/routeUtils";
import type { EntregaListItem } from "../types";
import {
  getDestinationLabel,
  getNavigationOptions,
  openNavigationToStop,
  resolveNavigationTarget,
  type GeocodedCoordsMap,
  type NavigationApp,
} from "../utils/externalNavigation";

const SCAN_DEBOUNCE_MS = 1500;
const BARCODE_TYPES: import("expo-camera").BarcodeType[] = ["qr"];

interface LocateResult {
  stopIndex: number;
  delivery: EntregaListItem;
  sameStopDeliveries: EntregaListItem[];
  totalStops: number;
}

interface RouteLocatePackageSheetProps {
  visible: boolean;
  totalStops: number;
  geocodedCoords?: GeocodedCoordsMap;
  onFindByCodigo: (codigo: string) => LocateResult | null;
  onGoToStop: (idSaida: number) => void;
  onClose: () => void;
}

export default function RouteLocatePackageSheet({
  visible,
  totalStops,
  geocodedCoords = {},
  onFindByCodigo,
  onGoToStop,
  onClose,
}: RouteLocatePackageSheetProps) {
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<LocateResult | null>(null);
  const [showNavOptions, setShowNavOptions] = useState(false);
  const lastScanRef = useRef(0);
  const navOptions = useMemo(() => getNavigationOptions(), []);
  const navTarget = result
    ? resolveNavigationTarget(result.delivery, geocodedCoords)
    : null;
  const destinationLabel = navTarget ? getDestinationLabel(navTarget) : null;
  const canNavigate =
    navTarget &&
    (navTarget.mode === "coords" || (navTarget.mode === "address" && navTarget.address));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        backText: { fontSize: 16, color: colors.primary, fontWeight: "600" },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginLeft: 12, flex: 1 },
        scroll: { flex: 1 },
        scrollContent: { padding: 16, paddingBottom: 32 },
        hint: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
        camera: {
          width: "100%",
          height: Dimensions.get("window").height * 0.38,
          borderRadius: 12,
          overflow: "hidden",
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
        divider: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          letterSpacing: 3,
          marginVertical: 6,
        },
        heroLabel: {
          fontSize: 16,
          fontWeight: "800",
          color: colors.textSecondary,
          textAlign: "center",
          letterSpacing: 4,
        },
        heroNumber: {
          fontSize: 72,
          fontWeight: "900",
          color: colors.primary,
          textAlign: "center",
          lineHeight: 80,
        },
        pedidosMeta: {
          fontSize: 16,
          fontWeight: "600",
          color: colors.text,
          textAlign: "center",
          marginTop: 8,
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
          marginTop: 12,
          lineHeight: 22,
        },
        btn: {
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginTop: 16,
        },
        btnText: { fontSize: 15, fontWeight: "600", color: colors.primaryContrast },
        btnSecondary: {
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.inputBackground,
          marginTop: 8,
          borderWidth: 1,
          borderColor: colors.separator,
        },
        btnSecondaryText: { fontSize: 14, fontWeight: "600", color: colors.text },
        destLabel: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.primary,
          textAlign: "center",
          marginTop: 8,
        },
        permText: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
      }),
    [colors]
  );

  const handleBarcode = useCallback(
    (scan: BarcodeScanningResult) => {
      const now = Date.now();
      if (now - lastScanRef.current < SCAN_DEBOUNCE_MS) return;
      lastScanRef.current = now;
      const parsed = parseCodigoQrRaw(scan.data);
      const codigo = (parsed.codigo || scan.data).trim();
      if (!codigo) return;
      const found = onFindByCodigo(codigo);
      if (found) {
        setResult(found);
      } else {
        Alert.alert("Pacote não encontrado", `O código ${codigo} não está nesta rota.`);
      }
    },
    [onFindByCodigo]
  );

  const handleClose = () => {
    setResult(null);
    setShowNavOptions(false);
    onClose();
  };

  const handleNav = useCallback(
    async (app: NavigationApp) => {
      if (!result) return;
      const needsConfirm =
        navTarget?.mode === "address" ||
        (navTarget?.mode === "coords" && navTarget.precision === "geocoded");
      await openNavigationToStop(result.delivery, app, {
        geocodedCoords,
        skipApproximateConfirm: !needsConfirm,
      });
      setShowNavOptions(false);
    },
    [result, navTarget, geocodedCoords]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Localizar pacote</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.hint}>
            Escaneie a etiqueta para ver em qual parada ({totalStops} no total) o pacote está.
          </Text>

          {!permission?.granted ? (
            <>
              <Text style={styles.permText}>Permissão de câmera necessária para escanear etiquetas.</Text>
              <TouchableOpacity style={styles.btn} onPress={requestPermission}>
                <Text style={styles.btnText}>Permitir câmera</Text>
              </TouchableOpacity>
            </>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={handleBarcode}
            />
          )}

          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.divider}>━━━━━━━━━━</Text>
              <Text style={styles.heroLabel}>PARADA</Text>
              <Text style={styles.heroNumber}>{result.stopIndex + 1}</Text>
              <Text style={styles.divider}>━━━━━━━━━━</Text>
              <Text style={styles.pedidosMeta}>
                📦 {result.sameStopDeliveries.length} pedido
                {result.sameStopDeliveries.length !== 1 ? "s" : ""}
              </Text>
              {result.sameStopDeliveries.map((d) => {
                const isScanned = d.id_saida === result.delivery.id_saida;
                const codigo = d.codigo?.trim() || "—";
                return (
                  <Text
                    key={d.id_saida}
                    style={[
                      styles.codigoItem,
                      isScanned && styles.codigoItemHighlight,
                    ]}
                  >
                    {codigo}
                  </Text>
                );
              })}
              <Text style={styles.addressLine}>{getStopAddressLine(result.delivery)}</Text>
              <Text style={styles.divider}>━━━━━━━━━━</Text>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => {
                  onGoToStop(result.delivery.id_saida);
                  handleClose();
                }}
              >
                <Text style={styles.btnText}>Ir para parada no mapa</Text>
              </TouchableOpacity>
              {canNavigate && (
                <>
                  <TouchableOpacity
                    style={styles.btnSecondary}
                    onPress={() => setShowNavOptions((v) => !v)}
                  >
                    <Text style={styles.btnSecondaryText}>Navegar</Text>
                  </TouchableOpacity>
                  {showNavOptions && (
                    <>
                      {destinationLabel && (
                        <Text style={styles.destLabel}>{destinationLabel}</Text>
                      )}
                      {navOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.id}
                          style={styles.btnSecondary}
                          onPress={() => void handleNav(opt.id)}
                        >
                          <Text style={styles.btnSecondaryText}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
