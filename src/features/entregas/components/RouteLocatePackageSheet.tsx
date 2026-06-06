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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useThemeColors } from "../../../theme/colors";
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import { getStopAddressLine, servicoTipo } from "../utils/routeUtils";
import type { EntregaListItem } from "../types";

const SCAN_DEBOUNCE_MS = 1500;
const BARCODE_TYPES: import("expo-camera").BarcodeType[] = ["qr"];

interface LocateResult {
  stopIndex: number;
  delivery: EntregaListItem;
  totalStops: number;
}

interface RouteLocatePackageSheetProps {
  visible: boolean;
  totalStops: number;
  onFindByCodigo: (codigo: string) => LocateResult | null;
  onGoToStop: (idSaida: number) => void;
  onClose: () => void;
}

export default function RouteLocatePackageSheet({
  visible,
  totalStops,
  onFindByCodigo,
  onGoToStop,
  onClose,
}: RouteLocatePackageSheetProps) {
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<LocateResult | null>(null);
  const lastScanRef = useRef(0);

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
          padding: 16,
          borderRadius: 10,
          backgroundColor: colors.success + "20",
          marginBottom: 12,
        },
        heroLabel: {
          fontSize: 14,
          fontWeight: "700",
          color: colors.textSecondary,
          textAlign: "center",
          letterSpacing: 2,
          marginBottom: 4,
        },
        heroNumber: {
          fontSize: 64,
          fontWeight: "900",
          color: colors.primary,
          textAlign: "center",
          lineHeight: 72,
        },
        heroCodigo: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          textAlign: "center",
          marginTop: 8,
        },
        heroMeta: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: 4,
          lineHeight: 20,
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
              <Text style={styles.heroLabel}>PARADA</Text>
              <Text style={styles.heroNumber}>{result.stopIndex + 1}</Text>
              <Text style={styles.heroCodigo}>{result.delivery.codigo || "—"}</Text>
              <Text style={styles.heroMeta}>
                {result.delivery.cliente || "—"}
                {"\n"}
                {getStopAddressLine(result.delivery)}
                {"\n"}
                {servicoTipo(result.delivery.servico)}
              </Text>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => {
                  onGoToStop(result.delivery.id_saida);
                  handleClose();
                }}
              >
                <Text style={styles.btnText}>Ir para parada</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
