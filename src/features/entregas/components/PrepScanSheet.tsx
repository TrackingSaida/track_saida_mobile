import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useThemeColors } from "../../../theme/colors";
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import type { EntregaListItem } from "../types";
import { useScannerTorch } from "../hooks/useScannerTorch";
import ScannerTorchButton from "./ScannerTorchButton";

const SCAN_DEBOUNCE_MS = 1500;
const BARCODE_TYPES: import("expo-camera").BarcodeType[] = ["qr"];

interface PrepScanSheetProps {
  visible: boolean;
  pendingDeliveries: EntregaListItem[];
  onFound: (delivery: EntregaListItem) => void;
  onClose: () => void;
}

function findByCodigo(
  codigo: string,
  list: EntregaListItem[]
): EntregaListItem | null {
  const normalized = codigo.trim().toLowerCase();
  if (!normalized) return null;
  return (
    list.find((d) => (d.codigo ?? "").trim().toLowerCase() === normalized) ?? null
  );
}

export default function PrepScanSheet({
  visible,
  pendingDeliveries,
  onFound,
  onClose,
}: PrepScanSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanRef = useRef(0);
  const torch = useScannerTorch(visible && !!permission?.granted);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 16,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 8,
          gap: 12,
        },
        headerTextWrap: { flex: 1 },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
        hint: { fontSize: 13, color: colors.textSecondary },
        closeBtn: {
          minHeight: 36,
          justifyContent: "center",
          paddingHorizontal: 4,
        },
        closeText: { fontSize: 16, color: colors.primary, fontWeight: "600" },
        camera: {
          width: "100%",
          height: Dimensions.get("window").height * 0.45,
          borderRadius: 12,
          overflow: "hidden",
        },
        cameraWrap: {
          position: "relative",
          width: "100%",
          height: Dimensions.get("window").height * 0.45,
          marginBottom: 0,
        },
        btn: {
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginTop: 12,
        },
        btnText: { fontSize: 15, fontWeight: "600", color: colors.primaryContrast },
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
      const found = findByCodigo(codigo, pendingDeliveries);
      if (found) {
        onFound(found);
      } else {
        Alert.alert(
          "Pacote não encontrado",
          "Este pacote não está na lista de entregas deste motoboy.",
          [{ text: "OK" }]
        );
      }
    },
    [pendingDeliveries, onFound]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.box, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Adicionar endereço por QR Code</Text>
              <Text style={styles.hint}>
                Leia o QR Code do pacote para localizá-lo e preencher o endereço.
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Fechar">
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
          {!permission?.granted ? (
            <TouchableOpacity style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Permitir câmera</Text>
            </TouchableOpacity>
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
        </View>
      </View>
    </Modal>
  );
}
