import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useAuthStore } from "../../../store/authStore";
import { effectiveEntradaObrigatoria, effectivePodeDigitarCodigoManual } from "../../../utils/role";
import { playSound } from "../../../utils/sound";
import { ScanFrameOverlay } from "../components/ScanFrameOverlay";
import { classifyCodigoParaOperacao } from "../parseCodigoQr";
import { lerEntrada, mensagemErroEntrada } from "../entradasApi";

type FeedbackTipo = "sucesso" | "duplicado" | "erro" | "info";

const SCAN_DEBOUNCE_MS = 1500;
const recentCodes = new Map<string, number>();

function isRecentlyScanned(data: string): boolean {
  const key = String(data || "").trim();
  if (!key) return true;
  return Date.now() - (recentCodes.get(key) ?? 0) < SCAN_DEBOUNCE_MS;
}

function markScanned(data: string): void {
  const key = String(data || "").trim();
  if (key) recentCodes.set(key, Date.now());
}

export default function LeituraEntradasScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const habilitada = effectiveEntradaObrigatoria(currentUser);
  const podeManual = effectivePodeDigitarCodigoManual(currentUser);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalOk, setTotalOk] = useState(0);
  const [feedback, setFeedback] = useState<{ tipo: FeedbackTipo; msg: string; codigo?: string } | null>(
    null
  );
  const scanLocked = useRef(false);
  const feedbackClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: { padding: 16, paddingBottom: 40 },
        hint: { fontSize: 14, color: colors.textSecondary, marginBottom: 16, lineHeight: 20 },
        cameraCta: {
          flexDirection: "row",
          gap: 10,
          paddingVertical: 16,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        },
        cameraCtaText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "700" },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.text,
          marginBottom: 10,
        },
        btnManual: {
          backgroundColor: colors.primarySoft,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
          marginBottom: 16,
        },
        btnManualText: { color: colors.primary, fontWeight: "700" },
        counter: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        counterNum: { fontSize: 28, fontWeight: "800", color: colors.primary },
        counterLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
        feedbackStrip: {
          marginBottom: 12,
          borderRadius: 10,
          borderWidth: 1,
          padding: 12,
        },
        feedbackTitulo: { fontWeight: "700", fontSize: 14 },
        feedbackCodigo: { marginTop: 4, fontSize: 12 },
        cameraModalOverlay: { flex: 1, backgroundColor: "#000" },
        cameraHeader: {
          position: "absolute",
          top: insets.top + 12,
          left: 16,
          right: 16,
          zIndex: 10,
        },
        cameraBackText: { fontSize: 16, color: "#fff", marginBottom: 6, fontWeight: "600" },
        cameraTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
        disabledBox: {
          padding: 16,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.border,
        },
      }),
    [colors, insets.top]
  );

  const pushFeedback = useCallback((tipo: FeedbackTipo, msg: string, codigo?: string) => {
    if (feedbackClearRef.current) clearTimeout(feedbackClearRef.current);
    setFeedback({ tipo, msg, codigo });
    feedbackClearRef.current = setTimeout(() => setFeedback(null), 1200);
  }, []);

  const processar = useCallback(
    async (raw: string, origem: "camera" | "manual") => {
      const classified = classifyCodigoParaOperacao(raw);
      if (!classified.ok || !classified.codigo) {
        playSound("error");
        pushFeedback("erro", classified.motivo || "Código inválido");
        return;
      }
      const c = classified.codigo.trim().toUpperCase();
      if (isRecentlyScanned(c)) {
        playSound("warn");
        pushFeedback("duplicado", "Aguarde um momento", c);
        return;
      }
      markScanned(c);
      setLoading(true);
      try {
        await lerEntrada({
          codigo: classified.qr_payload_raw || classified.codigo,
          origem,
          qr_payload_raw: classified.qr_payload_raw,
        });
        setTotalOk((n) => n + 1);
        playSound("success");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        pushFeedback("sucesso", "Entrada registrada", c);
        setCodigoManual("");
      } catch (err) {
        const ax = err as { response?: { status?: number; data?: { code?: string } } };
        if (ax.response?.status === 409 || ax.response?.data?.code === "JA_NA_BASE") {
          playSound("warn");
          pushFeedback("duplicado", "Já teve entrada na base", c);
        } else {
          playSound("error");
          pushFeedback("erro", mensagemErroEntrada(err), c);
        }
      } finally {
        setLoading(false);
        setTimeout(() => {
          scanLocked.current = false;
        }, 400);
      }
    },
    [pushFeedback]
  );

  const onBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanLocked.current || loading) return;
      const raw = String(result.data || "").trim();
      if (!raw) return;
      scanLocked.current = true;
      void processar(raw, "camera");
    },
    [loading, processar]
  );

  if (!habilitada) {
    return (
      <View style={styles.container}>
        <ScreenHeaderBar title="Registrar entrada" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <View style={styles.disabledBox}>
            <Text style={{ color: colors.text }}>
              Registrar entrada não está habilitado para esta base.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const fbColor =
    feedback?.tipo === "sucesso"
      ? { bg: "rgba(25,135,84,0.16)", border: "rgba(25,135,84,0.4)", fg: "#198754" }
      : feedback?.tipo === "duplicado"
        ? { bg: "rgba(255,193,7,0.18)", border: "rgba(200,150,0,0.4)", fg: "#856404" }
        : feedback?.tipo === "erro"
          ? { bg: "rgba(220,53,69,0.16)", border: "rgba(220,53,69,0.4)", fg: "#dc3545" }
          : { bg: "rgba(13,110,253,0.16)", border: "rgba(13,110,253,0.36)", fg: "#0d6efd" };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Registrar entrada" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Bipe o pacote para registrar a entrada na base. Não é necessário informar seller.
        </Text>
        {feedback ? (
          <View style={[styles.feedbackStrip, { backgroundColor: fbColor.bg, borderColor: fbColor.border }]}>
            <Text style={[styles.feedbackTitulo, { color: fbColor.fg }]}>{feedback.msg}</Text>
            {feedback.codigo ? (
              <Text style={[styles.feedbackCodigo, { color: fbColor.fg }]}>{feedback.codigo}</Text>
            ) : null}
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.cameraCta}
          onPress={async () => {
            if (!permission?.granted) {
              const res = await requestPermission();
              if (!res.granted) {
                Alert.alert("Câmera", "Permissão de câmera necessária.");
                return;
              }
            }
            setCameraOpen(true);
          }}
        >
          <Ionicons name="scan-outline" size={22} color={colors.primaryContrast} />
          <Text style={styles.cameraCtaText}>Abrir scanner</Text>
        </TouchableOpacity>
        {podeManual ? (
          <>
            <TextInput
              style={styles.input}
              value={codigoManual}
              onChangeText={setCodigoManual}
              placeholder="Digitar código"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.btnManual}
              disabled={loading || !codigoManual.trim()}
              onPress={() => void processar(codigoManual, "manual")}
            >
              {loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.btnManualText}>Registrar entrada</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
        <View style={styles.counter}>
          <Text style={styles.counterNum}>{totalOk}</Text>
          <Text style={styles.counterLabel}>entradas nesta sessão</Text>
        </View>
      </ScrollView>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraModalOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setCameraOpen(false)}>
              <Text style={styles.cameraBackText}>{"< Fechar"}</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Entrada na base</Text>
          </View>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onBarcode}
            />
          ) : null}
          <ScanFrameOverlay />
        </View>
      </Modal>
    </View>
  );
}
