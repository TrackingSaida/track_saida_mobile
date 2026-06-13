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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import { getStopAddressLine } from "../utils/routeUtils";
import type { EntregaListItem } from "../types";

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
  onFindByCodigo: (codigo: string) => LocateResult | null;
  onClose: () => void;
}

export default function RouteLocatePackageSheet({
  visible,
  totalStops,
  onFindByCodigo,
  onClose,
}: RouteLocatePackageSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<LocateResult | null>(null);
  const lastScanRef = useRef(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
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
    onClose();
  };

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
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
