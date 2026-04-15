import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";
import { scanCodigo, assumirEntrega, desatribuirEntrega, getEntrega } from "../api";
import { classifyCodigoParaOperacao } from "../../operacao/parseCodigoQr";
import { useScanSessionStore } from "../../../store/scanSessionStore";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { playSound } from "../../../utils/sound";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

function classifyServico(serv?: string | null): "Shopee" | "Flex" | "Avulso" {
  const s = (serv || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("mercado") || s.includes("ml") || s.includes("flex")) return "Flex";
  return "Avulso";
}

// Debounce: evita processar o mesmo código várias vezes (performance igual/superior ao painel web)
const SCAN_DEBOUNCE_MS = 1500;
const recentCodes = new Map<string, number>();
const DUPLICATE_ALERT_THROTTLE_MS = 2800;
const duplicateAlertAt = new Map<string, number>();

function isRecentlyScanned(data: string): boolean {
  const key = String(data || "").trim();
  if (!key) return true;
  const ts = recentCodes.get(key) ?? 0;
  return Date.now() - ts < SCAN_DEBOUNCE_MS;
}

function markScanned(data: string): void {
  const key = String(data || "").trim();
  if (key) recentCodes.set(key, Date.now());
}

function shouldNotifyDuplicate(key: string): boolean {
  const k = String(key || "").trim();
  if (!k) return true;
  const now = Date.now();
  const last = duplicateAlertAt.get(k) ?? 0;
  if (now - last < DUPLICATE_ALERT_THROTTLE_MS) return false;
  duplicateAlertAt.set(k, now);
  return true;
}

// Formatos compatíveis com leituras de saídas (painel web)
const BARCODE_TYPES: import("expo-camera").BarcodeType[] = [
  "qr",
  "ean13",
  "ean8",
  "code128",
  "code39",
  "code93",
  "itf14",
  "codabar",
  "upc_a",
  "upc_e",
  "pdf417",
  "datamatrix",
  "aztec",
];

const FRAME_SIZE = Math.min(Dimensions.get("window").width, Dimensions.get("window").height) * 0.65;
const CORNER_LENGTH = 40;
const CORNER_THICKNESS = 5;
const CORNER_COLOR = "#00bfff"; // azul claro visível sobre a câmera
const FEEDBACK_MS = 1100;

type FeedbackTipo = "sucesso" | "duplicado" | "erro" | "info";

interface FeedbackVisual {
  tipo: FeedbackTipo;
  mensagem: string;
  codigo?: string;
}

function ScanFrameOverlay({ wrapStyle }: { wrapStyle: ViewStyle }) {
  const cornerStyle = {
    position: "absolute" as const,
    width: CORNER_LENGTH,
    height: CORNER_LENGTH,
    borderColor: CORNER_COLOR,
    shadowColor: CORNER_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  };
  return (
    <View style={[wrapStyle, { width: FRAME_SIZE, height: FRAME_SIZE }]} pointerEvents="none">
      {/* Top-left L */}
      <View style={[cornerStyle, { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS }]} />
      {/* Top-right L */}
      <View style={[cornerStyle, { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS }]} />
      {/* Bottom-left L */}
      <View style={[cornerStyle, { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS }]} />
      {/* Bottom-right L */}
      <View style={[cornerStyle, { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS }]} />
    </View>
  );
}

export default function ScanScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          padding: 24,
          paddingTop: 48,
        },
        containerCamera: { flex: 1, backgroundColor: "#000" },
        header: { marginBottom: 32 },
        headerOverlay: {
          position: "absolute",
          left: 24,
          right: 24,
          zIndex: 10,
        },
        backText: { fontSize: 16, color: colors.primary, marginBottom: 8 },
        backTextWhite: { fontSize: 16, color: "#fff", marginBottom: 8, fontWeight: "600" },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        titleWhite: { fontSize: 22, fontWeight: "700", color: "#fff" },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
        subtitleWhite: { fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 4 },
        input: {
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 12,
          padding: 16,
          fontSize: 18,
          marginBottom: 24,
          color: colors.text,
        },
        btnScan: {
          backgroundColor: colors.success,
          paddingVertical: 18,
          borderRadius: 12,
          alignItems: "center",
        },
        btnDisabled: { opacity: 0.7 },
        btnScanText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "600" },
        linkManual: { marginTop: 24, alignItems: "center" },
        linkManualText: { fontSize: 15, color: colors.primary },
        linkManualWhite: { paddingVertical: 12, alignItems: "center" },
        linkManualTextWhite: { fontSize: 15, color: "rgba(255,255,255,0.95)" },
        permissionText: { fontSize: 16, color: colors.text, textAlign: "center", marginBottom: 24 },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 5,
        },
        loadingText: { color: "#fff", marginTop: 12, fontSize: 16 },
        footerOverlay: {
          position: "absolute",
          bottom: 0,
          left: 16,
          right: 16,
          zIndex: 10,
          maxHeight: "50%",
        },
        scanFrameContainer: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 5,
        },
        scanFrameWrap: { position: "relative" as const },
        contadorRow: {
          flexDirection: "row",
          justifyContent: "space-around",
          marginBottom: 8,
          gap: 8,
        },
        contadorBadge: {
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          alignItems: "center",
        },
        badgeShopee: { backgroundColor: "rgba(238,77,45,0.9)" },
        badgeFlex: { backgroundColor: "rgba(255,224,102,0.9)" },
        badgeAvulso: { backgroundColor: "rgba(99,102,241,0.9)" },
        contadorNum: { fontSize: 20, fontWeight: "700", color: "#fff" },
        contadorLabel: { fontSize: 12, color: "rgba(255,255,255,0.95)" },
        btnComecarEntregar: {
          backgroundColor: colors.primary,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 10,
        },
        btnComecarEntregarText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "600" },
        verListaBtn: {
          paddingVertical: 10,
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          borderRadius: 8,
          marginBottom: 8,
        },
        verListaText: { color: "#fff", fontSize: 14 },
        listaLeituras: {
          maxHeight: 200,
          backgroundColor: "rgba(0,0,0,0.75)",
          borderRadius: 8,
          marginBottom: 8,
          overflow: "hidden",
        },
        listaScroll: { maxHeight: 200 },
        listaItem: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.2)",
        },
        listaItemInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
        listaItemCodigo: { color: "#fff", fontSize: 15, fontWeight: "600" },
        servicoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
        servicoBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
        btnRemover: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 6,
          backgroundColor: "rgba(220,53,69,0.8)",
        },
        btnRemoverText: { color: "#fff", fontSize: 13, fontWeight: "600" },
        modalOverlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          padding: 24,
        },
        modalBox: { backgroundColor: colors.backgroundCard, borderRadius: 12, padding: 24 },
        modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12, color: colors.text },
        modalMessage: { fontSize: 16, color: colors.text, marginBottom: 24 },
        modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
        modalBtnCancel: { paddingVertical: 12, paddingHorizontal: 24 },
        modalBtnCancelText: { color: colors.textSecondary, fontSize: 16 },
        modalBtnOk: {
          backgroundColor: colors.primary,
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 8,
        },
        modalBtnOkText: { color: colors.primaryContrast, fontWeight: "600", fontSize: 16 },
      }),
    [colors]
  );
  const leiturasSession = useScanSessionStore((s) => s.leituras);
  const addLeituraStore = useScanSessionStore((s) => s.addLeitura);
  const removeLeituraStore = useScanSessionStore((s) => s.removeLeitura);
  const clearLeituras = useScanSessionStore((s) => s.clearLeituras);
  const setRotaIniciada = useScanSessionStore((s) => s.setRotaIniciada);
  const clearSessionIfRotaIniciada = useScanSessionStore((s) => s.clearSessionIfRotaIniciada);

  const [modoManual, setModoManual] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [conflito, setConflito] = useState<{ motoboy_atual: string; id_saida: number } | null>(null);
  const [assumindo, setAssumindo] = useState(false);
  const [iniciandoRota, setIniciandoRota] = useState(false);
  const [listaExpandida, setListaExpandida] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);
  const [showPrepararRotaModal, setShowPrepararRotaModal] = useState(false);
  const [feedbackVisual, setFeedbackVisual] = useState<FeedbackVisual | null>(null);
  const scanLocked = useRef(false);
  const feedbackClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRoute = useDeliveryStore((s) => s.startRoute);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const [permission, requestPermission] = useCameraPermissions();

  const pushFeedback = useCallback((tipo: FeedbackTipo, mensagem: string, codigoItem?: string) => {
    if (feedbackClearRef.current) {
      clearTimeout(feedbackClearRef.current);
      feedbackClearRef.current = null;
    }
    setFeedbackVisual({ tipo, mensagem, codigo: codigoItem });
    feedbackClearRef.current = setTimeout(() => {
      setFeedbackVisual(null);
      feedbackClearRef.current = null;
    }, FEEDBACK_MS);
  }, []);

  const feedbackColors = useCallback((tipo: FeedbackTipo) => {
    if (tipo === "sucesso") return { bg: "rgba(25,135,84,0.28)", border: "rgba(25,135,84,0.6)", fg: "#d7ffe7" };
    if (tipo === "duplicado") return { bg: "rgba(255,193,7,0.26)", border: "rgba(255,193,7,0.6)", fg: "#fff3cd" };
    if (tipo === "erro") return { bg: "rgba(220,53,69,0.26)", border: "rgba(220,53,69,0.6)", fg: "#f8d7da" };
    return { bg: "rgba(13,110,253,0.26)", border: "rgba(13,110,253,0.55)", fg: "#cfe2ff" };
  }, []);

  const renderFeedback = useCallback(() => {
    if (!feedbackVisual) return null;
    const c = feedbackColors(feedbackVisual.tipo);
    return (
      <View
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: insets.top + 94,
          zIndex: 12,
          borderRadius: 10,
          borderWidth: 1,
          paddingVertical: 9,
          paddingHorizontal: 12,
          backgroundColor: c.bg,
          borderColor: c.border,
        }}
      >
        <Text style={{ color: c.fg, fontSize: 14, fontWeight: "700" }}>{feedbackVisual.mensagem}</Text>
        {feedbackVisual.codigo ? (
          <Text style={{ color: c.fg, fontSize: 13, marginTop: 2 }}>{feedbackVisual.codigo}</Text>
        ) : null}
      </View>
    );
  }, [feedbackVisual, feedbackColors, insets.top]);

  useFocusEffect(
    useCallback(() => {
      clearSessionIfRotaIniciada();
    }, [clearSessionIfRotaIniciada])
  );

  const addLeitura = useCallback((ent: { id_saida: number; codigo?: string | null; servico?: string | null }) => {
    const serv = classifyServico(ent.servico);
    addLeituraStore({ id_saida: ent.id_saida, codigo: ent.codigo || "", servico: serv });
  }, [addLeituraStore]);

  const removerLeitura = useCallback(async (id_saida: number) => {
    setRemovendoId(id_saida);
    try {
      await desatribuirEntrega(id_saida);
      removeLeituraStore(id_saida);
    } catch {
      Alert.alert("Erro", "Não foi possível remover a leitura.");
    } finally {
      setRemovendoId(null);
    }
  }, [removeLeituraStore]);

  const contadores = {
    Shopee: leiturasSession.filter((l) => l.servico === "Shopee").length,
    Flex: leiturasSession.filter((l) => l.servico === "Flex").length,
    Avulso: leiturasSession.filter((l) => l.servico === "Avulso").length,
  };
  const codigosLidosSessao = useMemo(() => {
    const set = new Set<string>();
    leiturasSession.forEach((l) => {
      const code = String(l.codigo || "").trim().toUpperCase();
      if (code) set.add(code);
    });
    return set;
  }, [leiturasSession]);

  const processarCodigo = useCallback(
    async (raw: string) => {
      const rawTrim = String(raw || "").trim();
      if (!rawTrim || scanLocked.current) return;
      const cls = classifyCodigoParaOperacao(rawTrim);
      if (!cls.ok) {
        playSound("error");
        pushFeedback("erro", "Código inválido", rawTrim.slice(0, 60));
        Alert.alert("Código inválido", cls.motivo);
        return;
      }
      const c = String(cls.codigo || "").trim().toUpperCase();
      if (!c) return;
      const codigoParaApi = cls.qr_payload_raw?.trim() ? cls.qr_payload_raw.trim() : c;
      if (codigosLidosSessao.has(c)) {
        if (shouldNotifyDuplicate(`sess:${c}`)) {
          playSound("warn");
          pushFeedback("duplicado", "Código já lido nesta sessão", c);
        }
        return;
      }
      if (isRecentlyScanned(c) || isRecentlyScanned(rawTrim)) {
        if (shouldNotifyDuplicate(`frame:${c}`)) {
          playSound("warn");
          pushFeedback("duplicado", "Código já está em processamento", c);
        }
        return;
      }
      markScanned(c);
      markScanned(rawTrim);
      scanLocked.current = true;
      setLoading(true);
      setConflito(null);

      try {
        const result = await scanCodigo(codigoParaApi);
        if (result.conflito) {
          playSound("warn");
          pushFeedback("info", "Conflito de atribuição detectado", c);
          setConflito({
            motoboy_atual: result.motoboy_atual ?? "outro motoboy",
            id_saida: result.id_saida ?? 0,
          });
        } else if (result.entrega) {
          addLeitura(result.entrega);
          setCodigo("");
          playSound("success");
          pushFeedback("sucesso", "Leitura registrada", c);
          setTimeout(() => (scanLocked.current = false), 400);
        }
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { detail?: string } } };
        const msg =
          ax?.response?.data?.detail ?? "Código não encontrado ou erro ao processar.";
        playSound("error");
        pushFeedback("erro", typeof msg === "string" ? msg : "Erro ao processar leitura", c);
        Alert.alert("Erro", typeof msg === "string" ? msg : String(msg));
        setTimeout(() => (scanLocked.current = false), 500);
      } finally {
        setLoading(false);
      }
    },
    [addLeitura, codigosLidosSessao, pushFeedback]
  );

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult | { nativeEvent: BarcodeScanningResult }) => {
      const result = "nativeEvent" in event ? event.nativeEvent : event;
      const data = result?.data ?? "";
      if (data && !scanLocked.current) {
        processarCodigo(data);
      }
    },
    [processarCodigo]
  );

  const handleScanManual = async () => {
    const c = codigo.trim();
    if (!c) {
      Alert.alert("Atenção", "Digite o código.");
      return;
    }
    await processarCodigo(c);
  };

  const handleAssumir = async () => {
    if (!conflito) return;
    setAssumindo(true);
    try {
      await assumirEntrega(conflito.id_saida);
      const entrega = await getEntrega(conflito.id_saida);
      addLeitura(entrega);
      setConflito(null);
      scanLocked.current = false;
      playSound("success");
      pushFeedback("sucesso", "Leitura assumida", entrega.codigo ?? String(conflito.id_saida));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      const msg = ax?.response?.data?.detail ?? "Erro ao assumir.";
      playSound("error");
      pushFeedback("erro", typeof msg === "string" ? msg : "Erro ao assumir");
      Alert.alert("Erro", typeof msg === "string" ? msg : String(msg));
    } finally {
      setAssumindo(false);
    }
  };

  const handleComecarEntregar = async () => {
    if (leiturasSession.length === 0) return;
    setIniciandoRota(true);
    try {
      await startRoute();
      clearLeituras();
      setRotaIniciada(true);
      if (roteirizacaoHabilitada) {
        setShowPrepararRotaModal(true);
      } else {
        navigation.navigate("EntregasList");
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      const msg = ax?.response?.data?.detail ?? "Erro ao iniciar rota.";
      playSound("error");
      Alert.alert("Erro", typeof msg === "string" ? msg : String(msg));
    } finally {
      setIniciandoRota(false);
    }
  };

  const handlePrepararRota = () => {
    setShowPrepararRotaModal(false);
    navigation.navigate("PrepareDeliveries");
  };

  const handleIrParaPendentes = () => {
    setShowPrepararRotaModal(false);
    navigation.navigate("EntregasList");
  };

  // Modo manual: digitação como opção secundária
  if (modoManual) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setModoManual(false)}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Digitar código</Text>
          <Text style={styles.subtitle}>Quando a câmera não for possível</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Código"
          placeholderTextColor={colors.placeholder}
          value={codigo}
          onChangeText={setCodigo}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.btnScan, loading && styles.btnDisabled]}
          onPress={handleScanManual}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnScanText}>Confirmar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkManual}
          onPress={() => setModoManual(false)}
          disabled={loading}
        >
          <Text style={styles.linkManualText}>← Usar câmera (padrão)</Text>
        </TouchableOpacity>

        <Modal visible={!!conflito} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Conflito</Text>
              <Text style={styles.modalMessage}>
                Pedido já atribuído ao motoboy {conflito?.motoboy_atual}. Deseja assumir?
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => {
                    setConflito(null);
                    scanLocked.current = false;
                  }}
                  disabled={assumindo}
                >
                  <Text style={styles.modalBtnCancelText}>Não</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnOk, assumindo && styles.btnDisabled]}
                  onPress={handleAssumir}
                  disabled={assumindo}
                >
                  {assumindo ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalBtnOkText}>Sim, assumir</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Modo padrão: câmera em tela cheia
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Carregando permissões...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Precisamos de acesso à câmera para escanear.</Text>
        <TouchableOpacity style={styles.btnScan} onPress={requestPermission}>
          <Text style={styles.btnScanText}>Permitir câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkManual} onPress={() => setModoManual(true)}>
          <Text style={styles.linkManualText}>Digitar código manualmente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.containerCamera}>
      <View style={[styles.headerOverlay, { top: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backTextWhite}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titleWhite}>Escanear</Text>
        <Text style={styles.subtitleWhite}>Aponte para o código de barras ou QR</Text>
      </View>

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: BARCODE_TYPES,
        }}
        onBarcodeScanned={loading ? undefined : handleBarcodeScanned}
      />

      {renderFeedback()}

      <View style={styles.scanFrameContainer} pointerEvents="none">
        <ScanFrameOverlay wrapStyle={styles.scanFrameWrap} />
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadingText}>Processando...</Text>
        </View>
      )}

      <View style={[styles.footerOverlay, { paddingBottom: Math.max(24, insets.bottom) }]}>
        {/* Contador Shopee | Flex | Avulso */}
        <View style={styles.contadorRow}>
          <View style={[styles.contadorBadge, styles.badgeShopee]}>
            <Text style={styles.contadorNum}>{contadores.Shopee}</Text>
            <Text style={styles.contadorLabel}>Shopee</Text>
          </View>
          <View style={[styles.contadorBadge, styles.badgeFlex]}>
            <Text style={styles.contadorNum}>{contadores.Flex}</Text>
            <Text style={styles.contadorLabel}>Flex</Text>
          </View>
          <View style={[styles.contadorBadge, styles.badgeAvulso]}>
            <Text style={styles.contadorNum}>{contadores.Avulso}</Text>
            <Text style={styles.contadorLabel}>Avulso</Text>
          </View>
        </View>

        {leiturasSession.length > 0 && (
          <TouchableOpacity
            style={[styles.btnComecarEntregar, iniciandoRota && styles.btnDisabled]}
            onPress={handleComecarEntregar}
            disabled={iniciandoRota}
          >
            {iniciandoRota ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnComecarEntregarText}>Começar Entrega</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Arrastar para cima = lista de leituras */}
        {leiturasSession.length > 0 && (
          <TouchableOpacity
            style={styles.verListaBtn}
            onPress={() => setListaExpandida((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.verListaText}>
              {listaExpandida ? "▼ Ocultar lista" : "▲ Ver lista (" + leiturasSession.length + " leituras)"}
            </Text>
          </TouchableOpacity>
        )}

        {listaExpandida && leiturasSession.length > 0 && (
          <View style={styles.listaLeituras}>
            <ScrollView style={styles.listaScroll} showsVerticalScrollIndicator>
              {leiturasSession.map((l) => (
                <View key={l.id_saida} style={styles.listaItem}>
                  <View style={styles.listaItemInfo}>
                    <Text style={styles.listaItemCodigo}>{l.codigo || "—"}</Text>
                    <View style={[styles.servicoBadge, l.servico === "Shopee" && styles.badgeShopee, l.servico === "Flex" && styles.badgeFlex, l.servico === "Avulso" && styles.badgeAvulso]}>
                      <Text style={styles.servicoBadgeText}>{l.servico}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.btnRemover}
                    onPress={() => removerLeitura(l.id_saida)}
                    disabled={removendoId === l.id_saida}
                  >
                    {removendoId === l.id_saida ? (
                      <ActivityIndicator size="small" color="#dc3545" />
                    ) : (
                      <Text style={styles.btnRemoverText}>Remover</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={styles.linkManualWhite}
          onPress={() => setModoManual(true)}
          disabled={loading}
        >
          <Text style={styles.linkManualTextWhite}>Digitar código manualmente</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!conflito} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Conflito</Text>
            <Text style={styles.modalMessage}>
              Pedido já atribuído ao motoboy {conflito?.motoboy_atual}. Deseja assumir?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setConflito(null);
                  scanLocked.current = false;
                }}
                disabled={assumindo}
              >
                <Text style={styles.modalBtnCancelText}>Não</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnOk, assumindo && styles.btnDisabled]}
                onPress={handleAssumir}
                disabled={assumindo}
              >
                {assumindo ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnOkText}>Sim, assumir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPrepararRotaModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Preparar rota</Text>
            <Text style={styles.modalMessage}>Você deseja preparar sua rota agora?</Text>
            <View style={[styles.modalActions, { flexDirection: "column", gap: 10 }]}>
              <TouchableOpacity style={styles.modalBtnOk} onPress={handlePrepararRota}>
                <Text style={styles.modalBtnOkText}>Preparar Rota</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={handleIrParaPendentes}>
                <Text style={styles.modalBtnCancelText}>Ir para Pendentes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
