import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { ScanFrameOverlay } from "../../operacao/components/ScanFrameOverlay";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { resolvePendingDeliveryByScan } from "../utils/resolvePendingDeliveryByScan";
import { useScannerTorch } from "../hooks/useScannerTorch";
import ScannerTorchButton from "../components/ScannerTorchButton";

type Props = NativeStackScreenProps<RootStackParamList, "DeliverScan">;

const SCAN_UNLOCK_MS = 800;

export default function DeliverScanScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [scanEnabled, setScanEnabled] = useState(true);
  const scanLockedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const torch = useScannerTorch(
    scanEnabled && !loading && !!cameraPermission?.granted
  );

  const pendingDeliveries = useDeliveryStore((s) => s.pendingDeliveries);
  const loadDeliveries = useDeliveryStore((s) => s.loadDeliveries);
  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: "#000" },
        loader: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000",
        },
        loaderText: { color: "#fff", marginTop: 12, fontSize: 14 },
        cameraOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.25)",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        },
        scannerHeader: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          paddingHorizontal: 16,
          backgroundColor: "rgba(0,0,0,0.35)",
        },
        scannerClose: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
        scannerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
        scannerSubtitle: { color: "#d5e6ff", fontSize: 13, marginTop: 2, marginBottom: 10 },
        scannerFooter: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 14,
          zIndex: 2,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: "rgba(0,0,0,0.4)",
        },
        scannerFooterText: { color: "#fff", fontSize: 13, textAlign: "center" as const },
      }),
    []
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setScanEnabled(true);
      scanLockedRef.current = false;

      (async () => {
        if (!cameraPermission?.granted) {
          const res = await requestCameraPermission();
          if (!res.granted) {
            if (!cancelled) {
              Alert.alert("Permissão", "Permita acesso à câmera para escanear.", [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            }
            return;
          }
        }

        try {
          await loadDeliveries({ onlyToday: somenteHojePendentes });
        } catch {
          if (!cancelled) {
            Alert.alert("Erro", "Não foi possível carregar os pendentes.", [
              { text: "OK", onPress: () => navigation.goBack() },
            ]);
          }
          return;
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [cameraPermission?.granted, loadDeliveries, navigation, requestCameraPermission, somenteHojePendentes])
  );

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult) => {
      if (scanLockedRef.current || loading) return;
      const data = String(event.data ?? "").trim();
      if (!data) return;

      scanLockedRef.current = true;
      setScanEnabled(false);

      const result = resolvePendingDeliveryByScan(data, pendingDeliveries ?? []);
      if (!result.ok) {
        Alert.alert(result.title, result.message);
        setTimeout(() => {
          scanLockedRef.current = false;
          setScanEnabled(true);
        }, SCAN_UNLOCK_MS);
        return;
      }

      navigation.replace("EntregaDetail", { idSaida: result.item.id_saida });
    },
    [loading, navigation, pendingDeliveries]
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loaderText}>Carregando pendentes…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.scannerHeader, { paddingTop: Math.max(14, insets.top), paddingBottom: 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.scannerClose}>← Fechar</Text>
        </TouchableOpacity>
        <Text style={styles.scannerTitle}>Escanear para entregar</Text>
        <Text style={styles.scannerSubtitle}>Aponte para o QR Code da etiqueta</Text>
      </View>

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        enableTorch={torch.enableTorch}
        onCameraReady={torch.onCameraReady}
        onBarcodeScanned={scanEnabled ? handleBarcodeScanned : undefined}
      />

      <ScannerTorchButton
        mode={torch.mode}
        onPress={torch.cycleMode}
        style={{ top: insets.top + 72, right: 16 }}
      />

      <View style={styles.cameraOverlay}>
        <ScanFrameOverlay wrapStyle={{}} />
      </View>

      <View style={[styles.scannerFooter, { bottom: Math.max(14, insets.bottom) }]}>
        <Text style={styles.scannerFooterText}>
          Escaneie um código pendente para abrir a entrega
        </Text>
      </View>
    </View>
  );
}
