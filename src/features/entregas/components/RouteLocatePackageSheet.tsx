import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useThemeColors } from "../../../theme/colors";
import { copyToClipboard } from "../../../utils/clipboard";
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

export type RouteScanMode = "locate" | "cargo";

interface RouteLocatePackageSheetProps {
  visible: boolean;
  mode?: RouteScanMode;
  totalStops: number;
  totalPedidos?: number;
  cargoScannedCount?: number;
  onFindByCodigo: (codigo: string) => LocateResult | null;
  onCargoScan?: (codigo: string, inRoute: boolean, idSaida?: number) => void;
  onGoToStop: (idSaida: number) => void;
  onClose: () => void;
}

export default function RouteLocatePackageSheet({
  visible,
  mode = "locate",
  totalStops,
  totalPedidos = 0,
  cargoScannedCount = 0,
  onFindByCodigo,
  onCargoScan,
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
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          maxHeight: "85%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        camera: {
          width: "100%",
          height: Dimensions.get("window").height * 0.4,
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
        resultText: { fontSize: 15, color: colors.text, lineHeight: 22 },
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
        btnOutline: {
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.primary,
          marginBottom: 8,
        },
        btnOutlineText: { fontSize: 15, fontWeight: "600", color: colors.primary },
        btn: {
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginBottom: 8,
        },
        btnText: { fontSize: 15, fontWeight: "600", color: colors.primaryContrast },
        close: { alignItems: "center", paddingVertical: 12 },
        closeText: { fontSize: 16, color: colors.textSecondary },
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
      if (mode === "cargo") {
        const found = onFindByCodigo(codigo);
        if (found) {
          onCargoScan?.(codigo, true, found.delivery.id_saida);
          Alert.alert("✓ Na rota", `Pacote ${codigo} conferido.`);
        } else {
          onCargoScan?.(codigo, false);
          Alert.alert("⚠ Fora da rota", `O código ${codigo} não está nesta rota.`);
        }
        return;
      }
      const found = onFindByCodigo(codigo);
      if (found) {
        setResult(found);
      } else {
        Alert.alert("Pacote não encontrado", `O código ${codigo} não está nesta rota.`);
      }
    },
    [onFindByCodigo, mode, onCargoScan]
  );

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>
            {mode === "cargo" ? "Conferir carga" : "Localizar pacote"}
          </Text>
          {mode === "cargo" && totalPedidos > 0 && (
            <Text style={styles.permText}>
              {cargoScannedCount} de {totalPedidos} pacotes conferidos
            </Text>
          )}
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
          {result && mode === "locate" && (
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
                style={[styles.btn, { marginTop: 16 }]}
                onPress={() => {
                  onGoToStop(result.delivery.id_saida);
                  handleClose();
                }}
              >
                <Text style={styles.btnText}>Ir para parada</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={async () => {
                  const copied = await copyToClipboard(String(result.stopIndex + 1));
                  if (copied) {
                    Alert.alert("Copiado", `Número da parada ${result.stopIndex + 1} copiado.`);
                  }
                }}
              >
                <Text style={styles.btnOutlineText}>Copiar número</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.close} onPress={handleClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
