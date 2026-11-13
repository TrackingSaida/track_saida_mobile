import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { ScanFrameOverlay } from "../../operacao/components/ScanFrameOverlay";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { resolvePendingDeliveryByScan } from "../utils/resolvePendingDeliveryByScan";
import { useScannerTorch } from "../hooks/useScannerTorch";
import ScannerTorchButton from "../components/ScannerTorchButton";
import { usePhotoCaptureStore } from "../../../store/photoCaptureStore";

type Props = NativeStackScreenProps<RootStackParamList, "DeliverScan">;

const SCAN_UNLOCK_MS = 800;

export default function DeliverScanScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  const [scanEnabled, setScanEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const scanLockedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const photoCaptureActive = usePhotoCaptureStore((s) => s.hardwareBusy);
  const cameraGranted = !!cameraPermission?.granted;
  const torch = useScannerTorch(scanEnabled && cameraGranted && !photoCaptureActive);

  const pendingDeliveries = useDeliveryStore((s) => s.pendingDeliveries);
  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const loadDeliveries = useDeliveryStore((s) => s.loadDeliveries);
  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);

  const scanList = useMemo(() => {
    if ((pendingDeliveries?.length ?? 0) > 0) return pendingDeliveries ?? [];
    return routeDeliveries ?? [];
  }, [pendingDeliveries, routeDeliveries]);

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
        noCameraPane: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 28,
          backgroundColor: "#111",
        },
        noCameraTitle: {
          color: "#fff",
          fontSize: 16,
          fontWeight: "700",
          textAlign: "center",
          marginBottom: 8,
        },
        noCameraText: {
          color: "#d5e6ff",
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
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
          bottom: Math.max(14, insets.bottom + 8),
          zIndex: 2,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: "rgba(0,0,0,0.55)",
          gap: 8,
        },
        searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
        searchInput: {
          flex: 1,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: "#fff",
          backgroundColor: "rgba(0,0,0,0.35)",
        },
        searchBtn: {
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: "#2f80ed",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 42,
        },
        scannerFooterText: { color: "#fff", fontSize: 12, lineHeight: 17, textAlign: "center" as const },
      }),
    [insets.bottom]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setScanEnabled(true);
      scanLockedRef.current = false;
      setBooting(true);

      (async () => {
        if (!cameraPermission?.granted) {
          await requestCameraPermission();
        }

        try {
          await loadDeliveries({ onlyToday: somenteHojePendentes });
        } catch {
          const cached =
            useDeliveryStore.getState().pendingDeliveries.length +
            useDeliveryStore.getState().routeDeliveries.length;
          if (!cancelled && cached === 0) {
            Alert.alert(
              "Sem conexão",
              "Não foi possível atualizar a lista. Você ainda pode buscar pacotes já carregados no aparelho."
            );
          }
        } finally {
          if (!cancelled) setBooting(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [
      cameraPermission?.granted,
      loadDeliveries,
      requestCameraPermission,
      somenteHojePendentes,
    ])
  );

  const openDelivery = useCallback(
    (raw: string) => {
      const result = resolvePendingDeliveryByScan(raw, scanList);
      if (!result.ok) {
        Alert.alert(result.title, result.message);
        return false;
      }
      Keyboard.dismiss();
      navigation.replace("EntregaDetail", { idSaida: result.item.id_saida });
      return true;
    },
    [navigation, scanList]
  );

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult) => {
      if (scanLockedRef.current || booting || !cameraGranted) return;
      const data = String(event.data ?? "").trim();
      if (!data) return;

      scanLockedRef.current = true;
      setScanEnabled(false);

      const ok = openDelivery(data);
      if (!ok) {
        setTimeout(() => {
          scanLockedRef.current = false;
          setScanEnabled(true);
        }, SCAN_UNLOCK_MS);
      }
    },
    [booting, cameraGranted, openDelivery]
  );

  const handleSearch = useCallback(() => {
    const query = searchQuery.trim();
    if (!query) {
      Alert.alert("Atenção", "Informe um código válido.");
      return;
    }
    openDelivery(query);
  }, [openDelivery, searchQuery]);

  if (booting) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loaderText}>Preparando busca…</Text>
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
        <Text style={styles.scannerSubtitle}>
          {cameraGranted
            ? "Aponte para o QR Code ou digite o código"
            : "Digite o código do pacote para abrir a entrega"}
        </Text>
      </View>

      {cameraGranted ? (
        <>
          {photoCaptureActive ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
          ) : (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              enableTorch={torch.enableTorch}
              onCameraReady={torch.onCameraReady}
              onBarcodeScanned={scanEnabled ? handleBarcodeScanned : undefined}
            />
          )}

          <ScannerTorchButton
            mode={torch.mode}
            onPress={torch.cycleMode}
            style={{ top: insets.top + 72, right: 16 }}
          />

          <View style={styles.cameraOverlay}>
            <ScanFrameOverlay wrapStyle={{}} />
          </View>
        </>
      ) : (
        <View style={styles.noCameraPane}>
          <Text style={styles.noCameraTitle}>Câmera indisponível</Text>
          <Text style={styles.noCameraText}>
            Sem permissão de câmera você ainda pode digitar o código do pacote abaixo, inclusive avulsos
            sem QR.
          </Text>
        </View>
      )}

      <View style={[styles.scannerFooter, { bottom: Math.max(14, insets.bottom) }]}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Código ou nº do pedido"
            placeholderTextColor="rgba(255,255,255,0.55)"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} accessibilityLabel="Buscar">
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.scannerFooterText}>
          Escaneie ou digite um código pendente para abrir a entrega
        </Text>
      </View>
    </View>
  );
}
