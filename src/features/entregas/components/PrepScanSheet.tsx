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
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import type { EntregaListItem } from "../types";

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
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanRef = useRef(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          maxHeight: "90%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
        camera: {
          width: "100%",
          height: Dimensions.get("window").height * 0.45,
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 12,
        },
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
        <View style={styles.box}>
          <Text style={styles.title}>Adicionar endereço por QR Code</Text>
          <Text style={styles.hint}>
            Leia o QR Code do pacote para localizá-lo e preencher o endereço.
          </Text>
          {!permission?.granted ? (
            <TouchableOpacity style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Permitir câmera</Text>
            </TouchableOpacity>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={handleBarcode}
            />
          )}
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
