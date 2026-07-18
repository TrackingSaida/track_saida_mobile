import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  Platform,
  Pressable,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import type { AxiosError } from "axios";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import OperacaoEmptyState from "../components/OperacaoEmptyState";
import { useAuthStore } from "../../../store/authStore";
import { playSound } from "../../../utils/sound";
import * as Haptics from "expo-haptics";
import { formatApiError } from "../../../utils/formatApiError";
import { effectivePodeDigitarCodigoManual, effectivePodeLerSaida, isStaffOperacaoRole } from "../../../utils/role";
import {
  lerSaidaAdmin,
  lancarAvulso,
  listMotoboysOperacao,
  updateSaidaAdmin,
  confirmarNovaSaidaMesmoEntregadorAdmin,
  type MotoboyItem,
} from "../saidasApi";
import { classifyCodigoParaOperacao, inferServicoSaida } from "../parseCodigoQr";
import {
  AVULSO_IDENT_AJUDA,
  AVULSO_IDENT_MAX,
  AVULSO_QTD_MAX,
  validarLancamentoAvulso,
} from "../utils/avulsoLancamento";

const FRAME_SIZE = Math.min(Dimensions.get("window").width, Dimensions.get("window").height) * 0.65;
const CORNER_LENGTH = 40;
const CORNER_THICKNESS = 5;
const CORNER_COLOR = "#00bfff";
const FEEDBACK_MS = 1100;
const LISTA_RECENTES_MAX = 12;

type StatusLeituraSaida = "sucesso" | "nao_coletado" | "erro" | "alterado";

type FeedbackTipo = "sucesso" | "nao_coletado" | "alterado" | "erro" | "duplicado" | "info";

interface LeituraSaidaItem {
  codigo: string;
  servico?: string | null;
  entregador: string;
  /** Motoboy para o qual a leitura foi contada (igual à web: duplicidade por entregador+código). */
  motoboyId: number;
  status: StatusLeituraSaida;
}

interface FeedbackVisual {
  tipo: FeedbackTipo;
  mensagem: string;
  codigo?: string;
}

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

const BARCODE_TYPES: import("expo-camera").BarcodeType[] = [
  "qr",
];

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
      <View
        style={[
          cornerStyle,
          { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
        ]}
      />
      <View
        style={[
          cornerStyle,
          { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
        ]}
      />
      <View
        style={[
          cornerStyle,
          { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
        ]}
      />
      <View
        style={[
          cornerStyle,
          { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
        ]}
      />
    </View>
  );
}

interface ConflitoTrocaEntregador {
  codigo: string;
  idSaida: number;
  entregadorAtual: string;
  usuarioRegistro: string;
  novoEntregador: string;
  motoboyId: number;
}

interface ConflitoLeituraDiaAnterior {
  codigo: string;
  idSaida: number;
  dataAnterior: string;
  motoboyNome: string;
  novoEntregador: string;
  motoboyId: number;
}

function labelResumoStatus(status: StatusLeituraSaida): string {
  switch (status) {
    case "sucesso":
      return "Registrado com sucesso";
    case "nao_coletado":
      return "Código não coletado";
    case "alterado":
      return "Entregador alterado";
    case "erro":
      return "Erro ao registrar";
    default:
      return "—";
  }
}

function labelBadgeLista(status: StatusLeituraSaida): string {
  switch (status) {
    case "sucesso":
      return "Sucesso";
    case "nao_coletado":
      return "Não coletado";
    case "alterado":
      return "Alterado";
    case "erro":
      return "Erro";
    default:
      return "—";
  }
}

function coresFeedback(tipo: FeedbackTipo): { bg: string; border: string; fg: string } {
  switch (tipo) {
    case "sucesso":
      return { bg: "rgba(25,135,84,0.2)", border: "rgba(25,135,84,0.55)", fg: "#b8f5d0" };
    case "nao_coletado":
    case "duplicado":
      return { bg: "rgba(255,193,7,0.22)", border: "rgba(255,193,7,0.55)", fg: "#fff3cd" };
    case "alterado":
      return { bg: "rgba(13,110,253,0.25)", border: "rgba(13,110,253,0.55)", fg: "#cfe2ff" };
    case "erro":
      return { bg: "rgba(220,53,69,0.25)", border: "rgba(220,53,69,0.55)", fg: "#f8d7da" };
    default:
      return { bg: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.35)", fg: "#fff" };
  }
}

function coresBadgeServicoLabel(servico: string): { bg: string; fg: string } {
  const s = servico.trim().toLowerCase();
  if (s.includes("shopee")) return { bg: "rgba(238,77,45,0.15)", fg: "#ee4d2d" };
  if (s.includes("mercado") || s.includes("livre")) return { bg: "rgba(255,230,0,0.35)", fg: "#2d3277" };
  if (!s || s === "—") return { bg: "rgba(108,117,125,0.15)", fg: "#6c757d" };
  return { bg: "rgba(13,110,253,0.12)", fg: "#0d6efd" };
}

function coresFeedbackMain(tipo: FeedbackTipo, colors: ReturnType<typeof useThemeColors>) {
  switch (tipo) {
    case "sucesso":
      return { bg: "rgba(25,135,84,0.12)", border: "rgba(25,135,84,0.35)", fg: "#198754" };
    case "nao_coletado":
    case "duplicado":
      return { bg: "rgba(255,193,7,0.15)", border: "rgba(200,150,0,0.4)", fg: "#856404" };
    case "alterado":
      return { bg: "rgba(13,110,253,0.12)", border: "rgba(13,110,253,0.35)", fg: "#0d6efd" };
    case "erro":
      return { bg: "rgba(220,53,69,0.12)", border: "rgba(220,53,69,0.35)", fg: "#dc3545" };
    default:
      return { bg: colors.primarySoft, border: colors.inputBorder, fg: colors.text };
  }
}

export default function LeituraSaidasScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [permission, requestPermission] = useCameraPermissions();
  const [motoboys, setMotoboys] = useState<MotoboyItem[]>([]);
  const [motoboyId, setMotoboyId] = useState<number | null>(null);
  const [motoboyNome, setMotoboyNome] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [leituras, setLeituras] = useState<LeituraSaidaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [carregandoMotoboys, setCarregandoMotoboys] = useState(false);
  const [conflito, setConflito] = useState<ConflitoTrocaEntregador | null>(null);
  const [conflitoDiaAnterior, setConflitoDiaAnterior] = useState<ConflitoLeituraDiaAnterior | null>(null);
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);
  const [confirmandoDiaAnterior, setConfirmandoDiaAnterior] = useState(false);
  const [modalSelecaoMotoboyVisible, setModalSelecaoMotoboyVisible] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [avulsoModalVisible, setAvulsoModalVisible] = useState(false);
  const [avulsoIdentificacao, setAvulsoIdentificacao] = useState("");
  const [avulsoQuantidade, setAvulsoQuantidade] = useState("1");
  const [feedbackVisual, setFeedbackVisual] = useState<FeedbackVisual | null>(null);

  const scanLocked = useRef(false);
  const suppressAutoCameraRef = useRef(false);
  const feedbackClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushFeedback = useCallback((tipo: FeedbackTipo, mensagem: string, codigo?: string) => {
    if (feedbackClearRef.current) {
      clearTimeout(feedbackClearRef.current);
      feedbackClearRef.current = null;
    }
    setFeedbackVisual({ tipo, mensagem, codigo });
    feedbackClearRef.current = setTimeout(() => {
      setFeedbackVisual(null);
      feedbackClearRef.current = null;
    }, FEEDBACK_MS);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 20, paddingBottom: 48 },
        feedbackStrip: {
          borderRadius: 12,
          borderWidth: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 14,
        },
        feedbackTitulo: { fontSize: 14, fontWeight: "700" },
        feedbackCodigo: { fontSize: 13, fontWeight: "600", marginTop: 4 },
        motoboyBlock: {
          borderRadius: 14,
          padding: 16,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginBottom: 16,
        },
        motoboyBadge: {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: colors.primarySoft,
          marginBottom: 10,
        },
        motoboyBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primary, textTransform: "uppercase" },
        motoboyLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: "600" },
        motoboyNome: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 12 },
        motoboyCta: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: colors.primarySoft,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        motoboyCtaText: { fontSize: 15, fontWeight: "600", color: colors.primary, flex: 1 },
        bloqueioText: {
          fontSize: 14,
          color: colors.textSecondary,
          marginTop: 10,
          lineHeight: 20,
        },
        resumoCard: {
          borderRadius: 14,
          padding: 18,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginBottom: 16,
        },
        sessaoTitulo: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          marginBottom: 12,
        },
        totalGigante: {
          fontSize: 44,
          fontWeight: "800",
          color: colors.text,
          textAlign: "center",
          marginBottom: 4,
        },
        totalLegenda: {
          fontSize: 13,
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: 16,
        },
        contadoresRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
        contadorItem: {
          flex: 1,
          minWidth: "45%",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: colors.inputBackground,
        },
        contadorChip: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: colors.inputBackground,
        },
        contadorChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
        contadorItemText: { fontSize: 13, color: colors.text, fontWeight: "600", flex: 1 },
        servicoBadgesRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
          justifyContent: "center",
        },
        servicoBadge: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
        },
        servicoBadgeText: { fontSize: 12, fontWeight: "700" },
        ultimaCard: {
          marginTop: 4,
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        ultimaTitulo: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
        ultimaCodigo: { fontSize: 17, fontWeight: "700", color: colors.text },
        ultimaStatus: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },
        vazioText: { fontSize: 14, color: colors.textSecondary, textAlign: "center", paddingVertical: 8 },
        manualToggle: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          paddingHorizontal: 4,
        },
        manualToggleText: { fontSize: 15, fontWeight: "600", color: colors.primary, flex: 1 },
        input: {
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          color: colors.text,
          marginBottom: 10,
        },
        btnPrimary: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        btnSecondary: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        btnOutline: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: colors.primary,
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
        },
        btnTextPrimary: { color: colors.primaryContrast, fontSize: 15, fontWeight: "600" },
        btnTextSecondary: { color: colors.text, fontSize: 14, fontWeight: "500" },
        btnTextOutline: { color: colors.primary, fontSize: 15, fontWeight: "600" },
        cameraCta: {
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        },
        cameraCtaText: { color: colors.primaryContrast, fontSize: 15, fontWeight: "700" },
        listaContainer: {
          marginTop: 8,
          borderRadius: 14,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          maxHeight: 280,
          overflow: "hidden",
        },
        listaHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        listaHeaderText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
        listaItem: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        listaCodigo: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 },
        listaSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
        statusBadge: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          marginLeft: 8,
        },
        statusText: { fontSize: 10, fontWeight: "700" },
        statusSucesso: { backgroundColor: "rgba(25,135,84,0.18)" },
        statusSucessoText: { color: "#198754" },
        statusAlterado: { backgroundColor: "rgba(13,110,253,0.18)" },
        statusAlteradoText: { color: "#0d6efd" },
        statusNaoColetado: { backgroundColor: "rgba(255,193,7,0.22)" },
        statusNaoColetadoText: { color: "#856404" },
        statusErro: { backgroundColor: "rgba(220,53,69,0.18)" },
        statusErroText: { color: "#dc3545" },
        badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
        badge: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        badgeText: { fontSize: 12, color: colors.textSecondary },
        pickerOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        },
        pickerSheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: Platform.OS === "ios" ? 28 : 18,
          maxHeight: "72%",
        },
        pickerTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 12 },
        pickerItem: {
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 12,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
        },
        pickerItemActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primarySoft,
        },
        pickerItemText: { fontSize: 16, color: colors.text, fontWeight: "600" },
        pickerItemSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        pickerClose: { alignSelf: "center", paddingVertical: 12 },
        pickerCloseText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 20,
        },
        loadingText: { color: "#fff", marginTop: 8, fontSize: 15 },
        cameraModalOverlay: {
          flex: 1,
          backgroundColor: "#000",
        },
        cameraHeader: {
          position: "absolute",
          top: insets.top + 10,
          left: 14,
          right: 14,
          zIndex: 12,
        },
        cameraHeaderRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        },
        cameraBackText: { fontSize: 16, color: "#fff", fontWeight: "600" },
        cameraMeta: { flex: 1, alignItems: "flex-end" },
        cameraMetaLine: { fontSize: 13, color: "rgba(255,255,255,0.92)", fontWeight: "600", textAlign: "right" },
        cameraMetaMuted: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2, textAlign: "right" },
        cameraFooter: {
          position: "absolute",
          bottom: Math.max(20, insets.bottom + 6),
          left: 14,
          right: 14,
          zIndex: 12,
        },
        cameraFooterBox: {
          backgroundColor: "rgba(0,0,0,0.55)",
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)",
        },
        cameraFooterLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginBottom: 4 },
        cameraFooterCodigo: { fontSize: 16, fontWeight: "700", color: "#fff" },
        cameraFooterStatus: { fontSize: 13, color: "rgba(255,255,255,0.88)", marginTop: 4 },
        cameraFeedbackAbs: {
          position: "absolute",
          top: insets.top + 72,
          left: 14,
          right: 14,
          zIndex: 15,
          borderRadius: 12,
          borderWidth: 1,
          padding: 12,
        },
        cameraSending: {
          position: "absolute",
          top: insets.top + 56,
          right: 14,
          zIndex: 14,
        },
        permissionText: {
          fontSize: 16,
          color: colors.text,
          textAlign: "center",
          marginBottom: 16,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 22,
        },
        modalCard: {
          width: "100%",
          borderRadius: 16,
          padding: 20,
          backgroundColor: colors.backgroundCard,
        },
        modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 },
        modalCodigoBox: {
          alignSelf: "stretch",
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBackground,
          marginBottom: 14,
        },
        modalCodigoLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
        modalCodigoValor: { fontSize: 20, fontWeight: "800", color: colors.text },
        modalRow: { marginBottom: 10 },
        modalRowLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
        modalRowValue: { fontSize: 15, fontWeight: "600", color: colors.text },
        modalHint: { fontSize: 14, color: colors.textSecondary, marginTop: 8, marginBottom: 18, lineHeight: 20 },
        modalActions: { flexDirection: "row", gap: 10 },
        modalBtnCancel: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          alignItems: "center",
        },
        modalBtnCancelText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
        modalBtnPrimary: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
        },
        modalBtnPrimaryText: { fontSize: 15, fontWeight: "700", color: colors.primaryContrast },
        modalMessage: { fontSize: 14, color: colors.textSecondary, marginBottom: 10 },
        modalHelp: { fontSize: 12, color: colors.textSecondary, marginBottom: 10, marginTop: -4 },
      }),
    [colors, insets.bottom, insets.top]
  );

  const podeLerSaida = effectivePodeLerSaida(currentUser);
  const podeDigitarManual = effectivePodeDigitarCodigoManual(currentUser);
  const username = currentUser?.username ?? "";
  const hideStaffBadges = isStaffOperacaoRole(currentUser?.role);

  const leiturasDoMotoboy = useMemo(() => {
    if (motoboyId == null) return [];
    return leituras.filter((l) => l.motoboyId === motoboyId);
  }, [leituras, motoboyId]);

  const totalSucesso = useMemo(
    () => leiturasDoMotoboy.filter((l) => l.status === "sucesso").length,
    [leiturasDoMotoboy]
  );
  const totalAlterado = useMemo(
    () => leiturasDoMotoboy.filter((l) => l.status === "alterado").length,
    [leiturasDoMotoboy]
  );
  const totalNaoColetado = useMemo(
    () => leiturasDoMotoboy.filter((l) => l.status === "nao_coletado").length,
    [leiturasDoMotoboy]
  );
  const totalErros = useMemo(
    () => leiturasDoMotoboy.filter((l) => l.status === "erro").length,
    [leiturasDoMotoboy]
  );
  const totalValidas = useMemo(
    () => totalSucesso + totalAlterado + totalNaoColetado,
    [totalSucesso, totalAlterado, totalNaoColetado]
  );
  const contagensPorServico = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leiturasDoMotoboy) {
      if (l.status === "erro") continue;
      const label = String(l.servico ?? "").trim() || "Sem serviço";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [leiturasDoMotoboy]);

  const ultimaLeitura = useMemo(
    () => (leiturasDoMotoboy.length ? leiturasDoMotoboy[leiturasDoMotoboy.length - 1] : undefined),
    [leiturasDoMotoboy]
  );
  const listaRecentes = useMemo(() => {
    const slice = leiturasDoMotoboy.slice(-LISTA_RECENTES_MAX);
    const start = Math.max(0, leiturasDoMotoboy.length - slice.length);
    return slice
      .map((item, i) => ({
        item,
        key: `${start + i}-${item.codigo}-${item.status}-${item.motoboyId}`,
      }))
      .reverse();
  }, [leiturasDoMotoboy]);

  const fetchMotoboys = useCallback(async () => {
    setCarregandoMotoboys(true);
    try {
      const data = await listMotoboysOperacao();
      setMotoboys(data);
    } catch {
      Alert.alert("Erro", "Falha ao carregar lista de motoboys.");
    } finally {
      setCarregandoMotoboys(false);
    }
  }, []);

  useEffect(() => {
    void fetchMotoboys();
  }, [fetchMotoboys]);

  useEffect(() => {
    return () => {
      if (feedbackClearRef.current) {
        clearTimeout(feedbackClearRef.current);
        feedbackClearRef.current = null;
      }
    };
  }, []);

  const ensurePermissionAndOpenCamera = useCallback(async () => {
    if (!permission) {
      const { granted } = await requestPermission();
      if (!granted) return;
      setCameraAtiva(true);
      return;
    }
    if (!permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    setCameraAtiva(true);
  }, [permission, requestPermission]);

  const fecharCamera = useCallback(() => {
    suppressAutoCameraRef.current = true;
    setCameraAtiva(false);
  }, []);

  const abrirCameraExplicito = useCallback(() => {
    suppressAutoCameraRef.current = false;
    void ensurePermissionAndOpenCamera();
  }, [ensurePermissionAndOpenCamera]);

  const aplicarMotoboySelecionado = useCallback(
    (item: MotoboyItem) => {
      setMotoboyId(item.id_motoboy);
      setMotoboyNome(item.nome);
      setModalSelecaoMotoboyVisible(false);
      suppressAutoCameraRef.current = false;
      setTimeout(() => {
        void ensurePermissionAndOpenCamera();
      }, 0);
    },
    [ensurePermissionAndOpenCamera]
  );
  const codigosLidosSessaoMotoboy = useMemo(() => {
    const set = new Set<string>();
    if (!motoboyId) return set;
    leituras.forEach((l) => {
      if (l.motoboyId !== motoboyId || l.status === "erro") return;
      const code = String(l.codigo || "").trim().toUpperCase();
      if (code) set.add(code);
    });
    return set;
  }, [leituras, motoboyId]);

  const processarLeitura = useCallback(
    async (raw: string, origem: "camera" | "manual") => {
      if (!podeLerSaida) {
        pushFeedback("info", "Sem permissão para leitura de saídas.");
        return;
      }
      if (!motoboyId || !motoboyNome) {
        pushFeedback("info", "Selecione um motoboy para iniciar as leituras.");
        return;
      }

      const rawStr = String(raw || "").trim();
      if (!rawStr || scanLocked.current) return;

      const cls = classifyCodigoParaOperacao(rawStr);
      if (!cls.ok) {
        playSound("error");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        pushFeedback("erro", cls.motivo, rawStr.slice(0, 80));
        return;
      }
      const c = cls.codigo;
      if (!c) return;
      const codeKey = String(c).trim().toUpperCase();

      if (codigosLidosSessaoMotoboy.has(codeKey)) {
        if (shouldNotifyDuplicate(`sess:${motoboyId}:${codeKey}`)) {
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("duplicado", "Já registrado para este motoboy nesta sessão.", codeKey);
        }
        return;
      }

      if (isRecentlyScanned(rawStr) || isRecentlyScanned(c)) {
        if (shouldNotifyDuplicate(`frame:${motoboyId}:${codeKey}`)) {
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("duplicado", "Código já está em processamento.", codeKey);
        }
        return;
      }

      markScanned(rawStr);
      markScanned(c);
      scanLocked.current = true;

      const jaLidoPorEsteMotoboy = leituras.some(
        (l) => l.motoboyId === motoboyId && l.codigo === c && l.status !== "erro"
      );
      if (jaLidoPorEsteMotoboy) {
        scanLocked.current = false;
        playSound("warn");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        pushFeedback("duplicado", "Já registrado para este motoboy nesta sessão.", c);
        return;
      }

      if (origem === "manual") {
        setCodigoInput("");
      }

      setLoading(true);
      try {
        const res = await lerSaidaAdmin({
          motoboy_id: motoboyId,
          entregador: motoboyNome,
          codigo: c,
          servico: cls.servico,
          qr_payload_raw: cls.qr_payload_raw,
        });

        const inferido = inferServicoSaida(c);
        const servicoEfetivo =
          (res.servico != null && String(res.servico).trim() !== "" ? String(res.servico).trim() : null) ||
          inferido ||
          null;

        const apiMb = res.motoboy_id;
        if (apiMb != null && Number(apiMb) !== Number(motoboyId)) {
          setConflito({
            codigo: c,
            idSaida: res.id_saida ?? 0,
            entregadorAtual: res.entregador ?? "—",
            usuarioRegistro: res.username ?? "—",
            novoEntregador: motoboyNome,
            motoboyId,
          });
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("info", "Já saiu com outro motoboy. Confirme a troca.", c);
          return;
        }

        const statusBackend = res?.status ?? "Saiu para entrega";
        const item: LeituraSaidaItem = {
          codigo: c,
          servico: servicoEfetivo,
          entregador: motoboyNome,
          motoboyId,
          status: statusBackend === "Não Coletado" ? "nao_coletado" : "sucesso",
        };

        setLeituras((prev) => [...prev, item]);
        if (item.status === "nao_coletado") {
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("nao_coletado", "Código não coletado", c);
        } else {
          playSound("success");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          pushFeedback("sucesso", "Registrado com sucesso", c);
        }
      } catch (err) {
        const ax = err as AxiosError<{
          code?: string;
          detail?: { code?: string; [key: string]: unknown } | string;
          id_saida?: number;
          data_operacional_anterior?: string;
          motoboy_nome?: string;
          status_atual?: string;
          data?: { id_saida?: number; entregador_atual?: string; username?: string };
          entregador_atual?: string;
          username?: string;
        }>;
        const status = ax.response?.status;
        const body = ax.response?.data;
        const detailObj =
          body && typeof body.detail === "object" && body.detail
            ? (body.detail as { code?: string })
            : null;
        const code = body?.code ?? detailObj?.code;

        if (status === 409 && code === "TROCA_ENTREGADOR") {
          const data = (body?.data as { id_saida?: number; entregador_atual?: string; username?: string }) ?? {};
          const idSaida = data.id_saida ?? body?.id_saida ?? 0;
          const entregadorAtual = data.entregador_atual ?? body?.entregador_atual ?? "Desconhecido";
          const usuarioRegistro = data.username ?? body?.username ?? "Desconhecido";
          setConflito({
            codigo: c,
            idSaida,
            entregadorAtual,
            usuarioRegistro,
            novoEntregador: motoboyNome,
            motoboyId,
          });
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("info", "Já saiu com outro motoboy. Confirme a troca.", c);
          return;
        }

        if (status === 409 && code === "LEITURA_DIA_ANTERIOR") {
          const idSaida = Number(body?.id_saida ?? 0);
          const dataAnterior = String(body?.data_operacional_anterior ?? "").trim();
          const motoboyNomeAnterior = String(body?.motoboy_nome ?? motoboyNome ?? "Motoboy");
          if (idSaida > 0 && dataAnterior) {
            setConflitoDiaAnterior({
              codigo: c,
              idSaida,
              dataAnterior,
              motoboyNome: motoboyNomeAnterior,
              novoEntregador: motoboyNome,
              motoboyId,
            });
            playSound("warn");
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            pushFeedback("info", "Pedido já lido em data anterior. Confirme saída hoje.", c);
            return;
          }
        }

        if (status === 409 && code === "DUPLICATE_SAIDA") {
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("duplicado", "Código já registrado.", c);
          return;
        }

        if (status === 422 && code === "NAO_COLETADO") {
          const srvNc = inferServicoSaida(c);
          setLeituras((prev) => [
            ...prev,
            {
              codigo: c,
              servico: srvNc || null,
              entregador: motoboyNome,
              motoboyId,
              status: "nao_coletado",
            },
          ]);
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("nao_coletado", "Código não coletado", c);
        } else if (status === 422 && code === "STATUS_FINALIZADO") {
          const statusAtual = String(body?.status_atual ?? "FINALIZADO");
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("erro", `Pedido bloqueado: status ${statusAtual}.`, c);
        } else {
          setLeituras((prev) => [
            ...prev,
            { codigo: c, servico: null, entregador: motoboyNome, motoboyId, status: "erro" },
          ]);
          playSound("error");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          pushFeedback("erro", formatApiError(err, "Erro ao registrar"), c);
        }
      } finally {
        setLoading(false);
        setTimeout(() => {
          scanLocked.current = false;
        }, 400);
      }
    },
    [codigosLidosSessaoMotoboy, leituras, motoboyId, motoboyNome, podeLerSaida, pushFeedback]
  );

  const handleRegistrarManual = useCallback(async () => {
    const c = codigoInput.trim();
    if (!c) {
      pushFeedback("info", "Digite um código para registrar.");
      return;
    }
    await processarLeitura(c, "manual");
  }, [codigoInput, processarLeitura]);

  const handleLancarAvulso = useCallback(async () => {
    if (!motoboyId || !motoboyNome) {
      pushFeedback("info", "Selecione um motoboy.");
      return;
    }
    const validacao = validarLancamentoAvulso(avulsoIdentificacao, avulsoQuantidade);
    if (!validacao.ok) {
      pushFeedback("erro", validacao.message);
      return;
    }
    setLoading(true);
    try {
      const res = await lancarAvulso({
        identificacao: validacao.identificacao,
        quantidade: validacao.quantidade,
        motoboy_id: motoboyId,
      });
      const novos = (res.saidas ?? []).map((s) => ({
        codigo: String(s.codigo ?? ""),
        servico: String(s.servico ?? "Avulso"),
        entregador: motoboyNome,
        motoboyId,
        status: "sucesso" as StatusLeituraSaida,
      }));
      if (novos.length > 0) {
        setLeituras((prev) => [...prev, ...novos]);
      }
      pushFeedback("sucesso", res.mensagem || "Avulsos lançados com sucesso.");
      setAvulsoModalVisible(false);
      setAvulsoIdentificacao("");
      setAvulsoQuantidade("1");
      abrirCameraExplicito();
    } catch (err) {
      pushFeedback("erro", formatApiError(err, "Erro ao lançar avulso."));
    } finally {
      setLoading(false);
    }
  }, [motoboyId, motoboyNome, avulsoQuantidade, avulsoIdentificacao, pushFeedback, abrirCameraExplicito]);

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult | { nativeEvent: BarcodeScanningResult }) => {
      if (loading) return;
      if (!motoboyId) return;
      const result = "nativeEvent" in event ? event.nativeEvent : event;
      const type = String(result?.type || "").toLowerCase();
      if (type && type !== "qr") return;
      const data = result?.data ?? "";
      if (data && !scanLocked.current) {
        void processarLeitura(data, "camera");
      }
    },
    [loading, motoboyId, processarLeitura]
  );

  const handleConfirmarTroca = useCallback(async () => {
    if (!conflito) return;
    const codigoRef = conflito.codigo;
    setConfirmandoTroca(true);
    try {
      await updateSaidaAdmin(conflito.idSaida, {
        status: "Saiu para entrega",
        motoboy_id: conflito.motoboyId,
        entregador: conflito.novoEntregador,
      });
      setLeituras((prev) => [
        ...prev,
        {
          codigo: conflito.codigo,
          servico: null,
          entregador: conflito.novoEntregador,
          motoboyId: conflito.motoboyId,
          status: "alterado",
        },
      ]);
      playSound("success");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConflito(null);
      pushFeedback("alterado", "Entregador alterado", codigoRef);
    } catch (err) {
      const ax = err as AxiosError<{ code?: string; status_atual?: string; detail?: { code?: string; status_atual?: string } | string }>;
      const body = ax.response?.data;
      const detailObj =
        body && typeof body.detail === "object" && body.detail
          ? (body.detail as { code?: string; status_atual?: string })
          : null;
      const code = body?.code ?? detailObj?.code;
      if (ax.response?.status === 422 && code === "STATUS_FINALIZADO") {
        const statusAtual = String(body?.status_atual ?? detailObj?.status_atual ?? "FINALIZADO");
        playSound("warn");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setConflito(null);
        pushFeedback("erro", `Pedido bloqueado: status ${statusAtual}.`, codigoRef);
      } else {
        playSound("error");
        Alert.alert("Erro", formatApiError(err, "Erro ao alterar entregador."));
      }
    } finally {
      setConfirmandoTroca(false);
      scanLocked.current = false;
    }
  }, [conflito, pushFeedback]);

  const handleCancelarTroca = useCallback(() => {
    setConflito(null);
    scanLocked.current = false;
  }, []);

  const formatDatePtBr = useCallback((iso: string) => {
    const p = String(iso || "").split("-");
    if (p.length !== 3) return iso;
    return `${p[2]}/${p[1]}/${p[0]}`;
  }, []);

  const handleConfirmarDiaAnterior = useCallback(async () => {
    if (!conflitoDiaAnterior) return;
    const codigoRef = conflitoDiaAnterior.codigo;
    setConfirmandoDiaAnterior(true);
    try {
      const res = await confirmarNovaSaidaMesmoEntregadorAdmin({
        id_saida: conflitoDiaAnterior.idSaida,
        motoboy_id: conflitoDiaAnterior.motoboyId,
        entregador: conflitoDiaAnterior.novoEntregador,
        origem: "mobile",
      });
      setLeituras((prev) => [
        ...prev,
        {
          codigo: conflitoDiaAnterior.codigo,
          servico: (res.servico ?? null) as string | null,
          entregador: conflitoDiaAnterior.novoEntregador,
          motoboyId: conflitoDiaAnterior.motoboyId,
          status: "sucesso",
        },
      ]);
      playSound("success");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConflitoDiaAnterior(null);
      pushFeedback("sucesso", "Nova saída confirmada para hoje", codigoRef);
    } catch (err) {
      playSound("error");
      Alert.alert("Erro", formatApiError(err, "Erro ao confirmar nova saída."));
    } finally {
      setConfirmandoDiaAnterior(false);
      scanLocked.current = false;
    }
  }, [conflitoDiaAnterior, pushFeedback]);

  const handleCancelarDiaAnterior = useCallback(() => {
    setConflitoDiaAnterior(null);
    scanLocked.current = false;
  }, []);

  const renderFeedbackStrip = (variant: "main" | "camera") => {
    if (!feedbackVisual) return null;
    const c =
      variant === "camera"
        ? coresFeedback(feedbackVisual.tipo)
        : coresFeedbackMain(feedbackVisual.tipo, colors);
    return (
      <View
        style={[
          variant === "camera" ? styles.cameraFeedbackAbs : styles.feedbackStrip,
          { backgroundColor: c.bg, borderColor: c.border },
        ]}
      >
        <Text style={[styles.feedbackTitulo, { color: c.fg }]}>{feedbackVisual.mensagem}</Text>
        {feedbackVisual.codigo ? (
          <Text style={[styles.feedbackCodigo, { color: c.fg }]}>{feedbackVisual.codigo}</Text>
        ) : null}
      </View>
    );
  };

  const statusBadgeStyles = (status: StatusLeituraSaida) => {
    switch (status) {
      case "sucesso":
        return { box: styles.statusSucesso, text: styles.statusSucessoText };
      case "alterado":
        return { box: styles.statusAlterado, text: styles.statusAlteradoText };
      case "nao_coletado":
        return { box: styles.statusNaoColetado, text: styles.statusNaoColetadoText };
      case "erro":
        return { box: styles.statusErro, text: styles.statusErroText };
      default:
        return { box: styles.statusSucesso, text: styles.statusSucessoText };
    }
  };

  const ultimaLeituraCores = (status: StatusLeituraSaida) => {
    switch (status) {
      case "sucesso":
        return { border: "rgba(25,135,84,0.45)", fg: "#198754" };
      case "alterado":
        return { border: "rgba(13,110,253,0.45)", fg: "#0d6efd" };
      case "nao_coletado":
        return { border: "rgba(255,193,7,0.55)", fg: "#856404" };
      case "erro":
        return { border: "rgba(220,53,69,0.45)", fg: "#dc3545" };
      default:
        return { border: colors.inputBorder, fg: colors.textSecondary };
    }
  };

  const motoboySelecionadoOk = Boolean(motoboyId && motoboyNome);

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeaderBar
          title="Leitura de saídas"
          onBack={() => navigation.goBack()}
          paddingTop={Math.max(12, insets.top)}
        />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 48 + insets.bottom }]}
      >
        {!hideStaffBadges ? (
          <View style={styles.badgeRow}>
            {username ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Usuário: {username}</Text>
              </View>
            ) : null}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Leitura: {podeLerSaida ? "Ativa" : "Desativada"}</Text>
            </View>
          </View>
        ) : null}

        {feedbackVisual && !cameraAtiva ? renderFeedbackStrip("main") : null}

        <View style={styles.motoboyBlock}>
          {motoboySelecionadoOk ? (
            <View style={styles.motoboyBadge}>
              <Text style={styles.motoboyBadgeText}>Motoboy selecionado</Text>
            </View>
          ) : null}
          {!motoboySelecionadoOk ? (
            <Text style={styles.motoboyLabel}>Motoboy</Text>
          ) : null}
          {motoboySelecionadoOk ? (
            <Text style={styles.motoboyNome} numberOfLines={2}>
              {motoboyNome}
            </Text>
          ) : (
            <Text style={styles.bloqueioText}>Selecione um motoboy para iniciar as leituras.</Text>
          )}
          <TouchableOpacity
            style={styles.motoboyCta}
            onPress={() => setModalSelecaoMotoboyVisible(true)}
            accessibilityLabel={motoboySelecionadoOk ? "Trocar motoboy" : "Selecionar motoboy"}
            accessibilityRole="button"
          >
            <Text style={styles.motoboyCtaText}>
              {motoboySelecionadoOk ? "Trocar motoboy" : "Selecionar motoboy"}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", marginTop: 10, justifyContent: "flex-end" }}>
            <TouchableOpacity onPress={() => void fetchMotoboys()} disabled={carregandoMotoboys}>
              {carregandoMotoboys ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>Atualizar lista</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {motoboySelecionadoOk && podeLerSaida && !cameraAtiva ? (
          <TouchableOpacity
            style={styles.cameraCta}
            onPress={abrirCameraExplicito}
            activeOpacity={0.88}
            accessibilityLabel="Escanear saída"
          >
            <Text style={styles.cameraCtaText}>Escanear saída</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.resumoCard}>
          <Text style={styles.sessaoTitulo}>Sessão atual</Text>
          <Text style={styles.totalGigante}>{motoboySelecionadoOk ? totalValidas : 0}</Text>
          <Text style={styles.totalLegenda}>Lidos nesta sessão (válidos)</Text>
          <View style={styles.contadoresRow}>
            <View style={styles.contadorItem}>
              <Ionicons name="checkmark-circle" size={18} color="#198754" />
              <Text style={styles.contadorItemText}>Sucesso: {totalSucesso}</Text>
            </View>
            <View style={styles.contadorItem}>
              <Ionicons name="swap-horizontal" size={18} color="#0d6efd" />
              <Text style={styles.contadorItemText}>Troca: {totalAlterado}</Text>
            </View>
            <View style={styles.contadorItem}>
              <Ionicons name="alert-circle" size={18} color="#856404" />
              <Text style={styles.contadorItemText}>Não coletado: {totalNaoColetado}</Text>
            </View>
            {totalErros > 0 ? (
              <View style={styles.contadorItem}>
                <Ionicons name="close-circle" size={18} color="#dc3545" />
                <Text style={styles.contadorItemText}>Erro: {totalErros}</Text>
              </View>
            ) : null}
          </View>
          {motoboySelecionadoOk && contagensPorServico.length > 0 ? (
            <View style={styles.servicoBadgesRow}>
              {contagensPorServico.map(([nome, qtd]) => {
                const cv = coresBadgeServicoLabel(nome);
                return (
                  <View key={nome} style={[styles.servicoBadge, { backgroundColor: cv.bg }]}>
                    <Text style={[styles.servicoBadgeText, { color: cv.fg }]}>
                      {nome}: {qtd}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          <View
            style={[
              styles.ultimaCard,
              ultimaLeitura
                ? { borderColor: ultimaLeituraCores(ultimaLeitura.status).border }
                : null,
            ]}
          >
            <Text style={styles.ultimaTitulo}>Última leitura</Text>
            {ultimaLeitura ? (
              <>
                <Text style={styles.ultimaCodigo}>{ultimaLeitura.codigo}</Text>
                <Text
                  style={[
                    styles.ultimaStatus,
                    { color: ultimaLeituraCores(ultimaLeitura.status).fg, fontWeight: "600" },
                  ]}
                >
                  {labelResumoStatus(ultimaLeitura.status)}
                </Text>
              </>
            ) : (
              <Text style={styles.vazioText}>Aguardando primeira leitura</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btnOutline, { marginBottom: 10 }]}
          onPress={() => setAvulsoModalVisible(true)}
          disabled={loading || !motoboySelecionadoOk || !podeLerSaida}
        >
          <Text style={styles.btnTextOutline}>Lançar Avulso</Text>
        </TouchableOpacity>

        {podeDigitarManual ? (
          <>
            <Pressable
              style={styles.manualToggle}
              onPress={() => setManualExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Digitar código manualmente"
            >
              <Text style={styles.manualToggleText}>Digitar código manualmente</Text>
              <Ionicons name={manualExpanded ? "chevron-up" : "chevron-down"} size={22} color={colors.primary} />
            </Pressable>
            {manualExpanded ? (
              <View style={{ marginBottom: 14 }}>
                <TextInput
                  style={[styles.input, !motoboySelecionadoOk && { opacity: 0.5 }]}
                  placeholder="Código da saída"
                  placeholderTextColor={colors.placeholder}
                  value={codigoInput}
                  onChangeText={setCodigoInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading && motoboySelecionadoOk && podeLerSaida}
                  onSubmitEditing={() => void handleRegistrarManual()}
                />
                <TouchableOpacity
                  style={styles.btnOutline}
                  onPress={() => void handleRegistrarManual()}
                  disabled={loading || !motoboySelecionadoOk || !podeLerSaida}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Text style={styles.btnTextOutline}>Registrar</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.listaContainer}>
          <View style={styles.listaHeader}>
            <Text style={styles.listaHeaderText}>Leituras recentes</Text>
            <Text style={styles.listaHeaderText}>até {LISTA_RECENTES_MAX}</Text>
          </View>
          {listaRecentes.length === 0 ? (
            motoboySelecionadoOk ? (
              <OperacaoEmptyState message="Nenhuma leitura recente nesta sessão." icon="scan-outline" />
            ) : (
              <OperacaoEmptyState message="Selecione um motoboy para ver as leituras." icon="person-outline" />
            )
          ) : (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {listaRecentes.map(({ item: l, key }) => {
                const sb = statusBadgeStyles(l.status);
                return (
                  <View key={key} style={styles.listaItem}>
                    <View style={{ flex: 1, paddingRight: 6, minWidth: 0 }}>
                      <Text style={styles.listaCodigo} numberOfLines={2} ellipsizeMode="tail">
                        {l.codigo}
                      </Text>
                      <Text style={styles.listaSubtitle} numberOfLines={2}>
                        {l.entregador}
                        {l.servico ? ` · ${l.servico}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, sb.box]}>
                      <Text style={[styles.statusText, sb.text]}>{labelBadgeLista(l.status)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {loading && !cameraAtiva ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.loadingText}>Enviando…</Text>
          </View>
        ) : null}
      </ScrollView>
      </View>

      <Modal visible={cameraAtiva} animationType="slide" onRequestClose={fecharCamera}>
        <View style={styles.cameraModalOverlay}>
          <View style={styles.cameraHeader}>
            <View style={styles.cameraHeaderRow}>
              <Pressable onPress={fecharCamera} accessibilityLabel="Fechar câmera">
                <Text style={styles.cameraBackText}>← Fechar</Text>
              </Pressable>
              <View style={styles.cameraMeta}>
                <Text style={styles.cameraMetaLine} numberOfLines={1}>
                  {motoboyNome || "—"}
                </Text>
                <Text style={styles.cameraMetaMuted}>Lidos: {totalValidas}</Text>
              </View>
            </View>
          </View>

          {feedbackVisual ? renderFeedbackStrip("camera") : null}

          {!permission ? (
            <View style={[styles.cameraModalOverlay, { justifyContent: "center", alignItems: "center" }]}>
              <Text style={styles.permissionText}>Carregando permissões…</Text>
            </View>
          ) : !permission.granted ? (
            <View style={[styles.cameraModalOverlay, { justifyContent: "center", alignItems: "center", padding: 24 }]}>
              <Text style={styles.permissionText}>Permita o uso da câmera para escanear.</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => void requestPermission()}>
                <Text style={styles.btnTextPrimary}>Permitir câmera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: BARCODE_TYPES,
                }}
                onBarcodeScanned={loading || !motoboyId ? undefined : handleBarcodeScanned}
              />
              <View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                pointerEvents="none"
              >
                <ScanFrameOverlay wrapStyle={{}} />
              </View>
              {loading ? (
                <View style={styles.cameraSending} pointerEvents="none">
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              ) : null}
              <View style={styles.cameraFooter} pointerEvents="none">
                <View style={styles.cameraFooterBox}>
                  <Text style={styles.cameraFooterLabel}>Última leitura</Text>
                  {ultimaLeitura ? (
                    <>
                      <Text style={styles.cameraFooterCodigo}>{ultimaLeitura.codigo}</Text>
                      <Text style={styles.cameraFooterStatus}>{labelResumoStatus(ultimaLeitura.status)}</Text>
                    </>
                  ) : (
                    <Text style={styles.cameraFooterStatus}>Aguardando primeiro código…</Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      <Modal
        visible={modalSelecaoMotoboyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalSelecaoMotoboyVisible(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setModalSelecaoMotoboyVisible(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Escolher motoboy</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {motoboys.length === 0 ? (
                <Text style={[styles.vazioText, { paddingVertical: 16 }]}>Nenhum motoboy disponível.</Text>
              ) : (
                motoboys.map((m) => {
                  const ativo = motoboyId === m.id_motoboy;
                  return (
                    <TouchableOpacity
                      key={m.id_motoboy}
                      style={[styles.pickerItem, ativo && styles.pickerItemActive]}
                      onPress={() => aplicarMotoboySelecionado(m)}
                      accessibilityState={{ selected: ativo }}
                    >
                      <Text style={styles.pickerItemText}>{m.nome}</Text>
                      {ativo ? <Text style={styles.pickerItemSub}>Selecionado</Text> : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setModalSelecaoMotoboyVisible(false)}>
              <Text style={styles.pickerCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={avulsoModalVisible} transparent animationType="fade" onRequestClose={() => setAvulsoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lançar Avulso</Text>
            <Text style={styles.modalMessage}>Identificação do avulso (opcional)</Text>
            <Text style={styles.modalHelp}>{AVULSO_IDENT_AJUDA}</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Cliente João"
              placeholderTextColor={colors.placeholder}
              value={avulsoIdentificacao}
              onChangeText={setAvulsoIdentificacao}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={AVULSO_IDENT_MAX}
              editable={!loading}
            />
            <Text style={[styles.modalMessage, { marginTop: 8 }]}>Quantidade (máx. {AVULSO_QTD_MAX})</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={colors.placeholder}
              value={avulsoQuantidade}
              onChangeText={setAvulsoQuantidade}
              keyboardType="number-pad"
              maxLength={2}
              editable={!loading}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setAvulsoModalVisible(false)} disabled={loading}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => void handleLancarAvulso()} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!conflito} transparent animationType="fade" onRequestClose={handleCancelarTroca}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Trocar entregador?</Text>
            <View style={styles.modalCodigoBox}>
              <Text style={styles.modalCodigoLabel}>Código</Text>
              <Text style={styles.modalCodigoValor}>{conflito?.codigo ?? "—"}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalRowLabel}>Entregador atual</Text>
              <Text style={styles.modalRowValue}>{conflito?.entregadorAtual ?? "—"}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalRowLabel}>Novo entregador</Text>
              <Text style={styles.modalRowValue}>{conflito?.novoEntregador ?? "—"}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalRowLabel}>Registrado por</Text>
              <Text style={styles.modalRowValue}>{conflito?.usuarioRegistro ?? "—"}</Text>
            </View>
            <Text style={styles.modalHint}>
              A saída já está em rota com outro entregador. Confirme para vincular ao motoboy selecionado.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={handleCancelarTroca}
                disabled={confirmandoTroca}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={() => void handleConfirmarTroca()}
                disabled={confirmandoTroca}
              >
                {confirmandoTroca ? (
                  <ActivityIndicator size="small" color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Trocar entregador</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!conflitoDiaAnterior}
        transparent
        animationType="fade"
        onRequestClose={handleCancelarDiaAnterior}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pedido já lido em data anterior</Text>
            <Text style={styles.modalMessage}>
              Este pedido já foi lido em {formatDatePtBr(conflitoDiaAnterior?.dataAnterior ?? "")} para o motoboy{" "}
              {conflitoDiaAnterior?.motoboyNome ?? "Motoboy"}.
              {"\n\n"}
              Deseja confirmar que ele está saindo novamente para entrega hoje?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={handleCancelarDiaAnterior} disabled={confirmandoDiaAnterior}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleConfirmarDiaAnterior} disabled={confirmandoDiaAnterior}>
                {confirmandoDiaAnterior ? (
                  <ActivityIndicator color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Confirmar saída hoje</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
