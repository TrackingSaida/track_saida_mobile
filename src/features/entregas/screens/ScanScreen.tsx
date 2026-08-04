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
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useScannerTorch } from "../hooks/useScannerTorch";
import ScannerTorchButton from "../components/ScannerTorchButton";
import { scanCodigo, assumirEntrega, removerEntrega, getEntrega, confirmarNovaSaidaMesmoEntregador, confirmarReativacaoEncerrado, lancarAvulsoMobile } from "../api";
import { classifyCodigoParaOperacao } from "../../operacao/parseCodigoQr";
import { useScanSessionStore } from "../../../store/scanSessionStore";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { useAuthStore } from "../../../store/authStore";
import { effectivePodeDigitarCodigoManual, effectivePodeLancarAvulso, effectiveAvulsoExigeFoto } from "../../../utils/role";
import { playSound } from "../../../utils/sound";
import { runPostScanRouteFlow } from "../utils/postScanRouteFlow";
import type { EntregaListItem } from "../types";
import AvulsoLancamentoModal from "../../operacao/components/AvulsoLancamentoModal";

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

// Mobile motoboy: leitura por câmera somente via QRCode.
const BARCODE_TYPES: import("expo-camera").BarcodeType[] = [
  "qr",
];

const FRAME_SIZE = Math.min(Dimensions.get("window").width, Dimensions.get("window").height) * 0.52;
const CORNER_LENGTH = 32;
const CORNER_THICKNESS = 4;
const CORNER_COLOR = "#00bfff"; // azul claro visível sobre a câmera
const FEEDBACK_MS = 900;

type FeedbackTipo = "sucesso" | "duplicado" | "erro" | "info";
type ScanConflictLocal = {
  conflito: true;
  motoboy_atual: string;
  id_saida: number;
  status_atual?: string;
};
type ScanSuccessLocal = {
  conflito: false;
  ja_existia?: boolean;
  entrega: { id_saida: number; codigo?: string | null; servico?: string | null };
};

interface FeedbackVisual {
  tipo: FeedbackTipo;
  mensagem: string;
  codigo?: string;
}

type ApiErroDetalhe = {
  code?: string;
  message?: string;
};

function extrairErroApi(error: unknown): { code?: string; message: string } {
  const fallback = "Não foi possível remover a leitura.";
  if (!error || typeof error !== "object") {
    return { message: fallback };
  }
  const maybe = error as {
    response?: {
      data?: {
        detail?: string | ApiErroDetalhe;
        code?: string;
      };
    };
  };
  const data = maybe.response?.data;
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return { message: detail };
  }
  if (detail && typeof detail === "object") {
    const code = typeof detail.code === "string" ? detail.code : data?.code;
    const message = typeof detail.message === "string" && detail.message.trim() ? detail.message : fallback;
    return { code, message };
  }
  if (data?.code) {
    return { code: data.code, message: fallback };
  }
  return { message: fallback };
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
        backTextWhite: { fontSize: 15, color: "#fff", marginBottom: 4, fontWeight: "600" },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        titleWhite: { fontSize: 20, fontWeight: "700", color: "#fff" },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
        subtitleWhite: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },
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
        linkManualWhite: { paddingVertical: 8, alignItems: "center" },
        linkManualTextWhite: { fontSize: 14, color: "rgba(255,255,255,0.92)" },
        btnAvulsoFooter: {
          marginTop: 4,
          backgroundColor: colors.primary,
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: "center",
        },
        btnAvulsoFooterText: { color: colors.primaryContrast, fontSize: 15, fontWeight: "600" },
        permissionText: { fontSize: 16, color: colors.text, textAlign: "center", marginBottom: 24 },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 5,
        },
        loadingText: { color: "#fff", marginTop: 12, fontSize: 16 },
        processingChip: {
          position: "absolute",
          alignSelf: "center",
          top: "58%",
          zIndex: 8,
          backgroundColor: "rgba(0,0,0,0.55)",
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 16,
        },
        processingChipText: { color: "#fff", fontSize: 13, fontWeight: "600" },
        footerOverlay: {
          position: "absolute",
          bottom: 0,
          left: 12,
          right: 12,
          zIndex: 10,
          maxHeight: "42%",
        },
        scanFrameContainer: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 88,
          zIndex: 5,
        },
        scanFrameWrap: { position: "relative" as const },
        contadorRow: {
          flexDirection: "row",
          justifyContent: "space-around",
          marginBottom: 6,
          gap: 6,
        },
        contadorBadge: {
          flex: 1,
          paddingVertical: 6,
          paddingHorizontal: 6,
          borderRadius: 8,
          alignItems: "center",
        },
        badgeShopee: { backgroundColor: "rgba(238,77,45,0.9)" },
        badgeFlex: { backgroundColor: "rgba(255,224,102,0.9)" },
        badgeAvulso: { backgroundColor: "rgba(99,102,241,0.9)" },
        contadorNum: { fontSize: 18, fontWeight: "700", color: "#fff" },
        contadorLabel: { fontSize: 11, color: "rgba(255,255,255,0.95)" },
        btnComecarEntregar: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 4,
        },
        btnComecarEntregarText: { color: colors.primaryContrast, fontSize: 17, fontWeight: "600" },
        verListaBtn: {
          paddingVertical: 6,
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.45)",
          borderRadius: 8,
          marginBottom: 4,
        },
        verListaText: { color: "#fff", fontSize: 13 },
        secondaryActionsRow: {
          flexDirection: "row",
          gap: 8,
          marginTop: 4,
        },
        secondaryActionBtn: {
          flex: 1,
          minHeight: 44,
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: "rgba(255,255,255,0.55)",
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
        },
        secondaryActionBtnDisabled: { opacity: 0.5 },
        secondaryActionBtnText: {
          fontSize: 14,
          color: "#fff",
          fontWeight: "700",
          textAlign: "center",
        },
        listaLeituras: {
          maxHeight: 160,
          backgroundColor: "rgba(0,0,0,0.75)",
          borderRadius: 8,
          marginBottom: 6,
          overflow: "hidden",
        },
        listaScroll: { maxHeight: 160 },
        listaItem: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.2)",
        },
        listaItemInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
        listaItemCodigo: { color: "#fff", fontSize: 14, fontWeight: "600", flexShrink: 1 },
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
        modalHelp: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, marginTop: -4 },
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
  const setLeiturasStore = useScanSessionStore((s) => s.setLeituras);
  const removeLeituraStore = useScanSessionStore((s) => s.removeLeitura);
  const clearLeituras = useScanSessionStore((s) => s.clearLeituras);
  const setRotaIniciada = useScanSessionStore((s) => s.setRotaIniciada);
  const clearSessionIfRotaIniciada = useScanSessionStore((s) => s.clearSessionIfRotaIniciada);

  const [modoManual, setModoManual] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [showAvulsoModal, setShowAvulsoModal] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Só para bip de câmera: chip leve, sem pausar o scanner nem overlay cheio. */
  const [cameraBusy, setCameraBusy] = useState(false);
  const [conflito, setConflito] = useState<{
    motoboy_atual: string;
    id_saida: number;
    status_atual?: string;
  } | null>(null);
  const [conflitoDiaAnterior, setConflitoDiaAnterior] = useState<{
    id_saida: number;
    data_operacional_anterior: string;
    motoboy_nome: string;
    codigo: string;
  } | null>(null);
  const [conflitoEncerrado, setConflitoEncerrado] = useState<{
    id_saida: number;
    codigo: string;
  } | null>(null);
  const [assumindo, setAssumindo] = useState(false);
  const [confirmandoDiaAnterior, setConfirmandoDiaAnterior] = useState(false);
  const [confirmandoEncerrado, setConfirmandoEncerrado] = useState(false);
  const [iniciandoRota, setIniciandoRota] = useState(false);
  const [listaExpandida, setListaExpandida] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);
  const [showPrepararRotaModal, setShowPrepararRotaModal] = useState(false);
  const [feedbackVisual, setFeedbackVisual] = useState<FeedbackVisual | null>(null);
  const scanLocked = useRef(false);
  const feedbackClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRoute = useDeliveryStore((s) => s.startRoute);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const currentUser = useAuthStore((s) => s.currentUser);
  const podeDigitarManual = effectivePodeDigitarCodigoManual(currentUser);
  const podeLancarAvulso = effectivePodeLancarAvulso(currentUser);
  const avulsoExigeFoto = effectiveAvulsoExigeFoto(currentUser);
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const torch = useScannerTorch(isFocused && !!permission?.granted && !modoManual);
  const sessionHadNewScanRef = useRef(false);

  // Ao sair do scanner, uma única sincronização dos pendentes (não a cada bip).
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (sessionHadNewScanRef.current) {
          sessionHadNewScanRef.current = false;
          void useDeliveryStore.getState().loadDeliveries();
        }
      };
    }, [])
  );

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

  const handlePostScanDelivery = useCallback(
    (idSaida: number, delivery?: EntregaListItem | null) => {
      if (delivery) sessionHadNewScanRef.current = true;
      runPostScanRouteFlow(idSaida, navigation, { delivery });
    },
    [navigation]
  );

  const removerLeitura = useCallback(async (id_saida: number) => {
    const snapshot = leiturasSession;
    setRemovendoId(id_saida);
    removeLeituraStore(id_saida); // atualização otimista para refletir no contador na hora
    try {
      await removerEntrega(id_saida);
    } catch (error: unknown) {
      setLeiturasStore(snapshot); // rollback se a API falhar
      const apiErro = extrairErroApi(error);
      if (apiErro.code === "DELETE_WINDOW_EXPIRED") {
        Alert.alert("Exclusão indisponível", "Esse registro passou da janela de 24h e não pode ser removido.");
      } else {
        Alert.alert("Erro", apiErro.message);
      }
    } finally {
      setRemovendoId(null);
    }
  }, [leiturasSession, removeLeituraStore, setLeiturasStore]);

  const contadores = useMemo(() => {
    let Shopee = 0;
    let Flex = 0;
    let Avulso = 0;
    for (const l of leiturasSession) {
      const s = classifyServico(l.servico);
      if (s === "Shopee") Shopee += 1;
      else if (s === "Flex") Flex += 1;
      else Avulso += 1;
    }
    return { Shopee, Flex, Avulso };
  }, [leiturasSession]);

  const codigosLidosSessao = useMemo(() => {
    const set = new Set<string>();
    leiturasSession.forEach((l) => {
      const code = String(l.codigo || "").trim().toUpperCase();
      if (code) set.add(code);
    });
    return set;
  }, [leiturasSession]);

  const scannerAtivo =
    isFocused &&
    !listaExpandida &&
    !modoManual &&
    !showAvulsoModal &&
    !conflito &&
    !conflitoDiaAnterior &&
    !conflitoEncerrado;

  const processarCodigo = useCallback(
    async (raw: string, origem: "camera" | "manual" = "camera") => {
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
      // Câmera: não usa loading global (pausava o scanner e cobria a tela).
      if (origem === "manual") setLoading(true);
      else setCameraBusy(true);
      setConflito(null);
      setConflitoDiaAnterior(null);
      setConflitoEncerrado(null);

      try {
        const result = await scanCodigo(codigoParaApi, origem);
        if ((result as { code?: string }).code === "STATUS_FINALIZADO") {
          const statusAtual = String((result as { status_atual?: string }).status_atual ?? "FINALIZADO");
          playSound("warn");
          pushFeedback("erro", `Pedido bloqueado: status ${statusAtual}.`, c);
          setTimeout(() => (scanLocked.current = false), 400);
          return;
        }
        if ((result as { code?: string }).code === "LEITURA_DIA_ANTERIOR") {
          const r = result as {
            id_saida: number;
            data_operacional_anterior: string;
            motoboy_nome?: string | null;
          };
          setConflitoDiaAnterior({
            id_saida: Number(r.id_saida ?? 0),
            data_operacional_anterior: String(r.data_operacional_anterior ?? ""),
            motoboy_nome: String(r.motoboy_nome ?? "Motoboy"),
            codigo: c,
          });
          playSound("warn");
          pushFeedback("info", "Pedido já lido em data anterior. Confirme saída hoje.", c);
          return;
        }
        if ((result as { code?: string }).code === "LEITURA_ENCERRADO_SISTEMA") {
          const r = result as { id_saida: number };
          setConflitoEncerrado({
            id_saida: Number(r.id_saida ?? 0),
            codigo: c,
          });
          playSound("warn");
          pushFeedback("info", "Pedido encerrado. Confirme para abrir nova saída.", c);
          return;
        }
        if ((result as { conflito?: boolean }).conflito) {
          const conflitoResult = result as ScanConflictLocal;
          playSound("warn");
          pushFeedback("info", "Conflito de atribuição detectado", c);
          const nomeMotoboy = String(conflitoResult.motoboy_atual || "").trim();
          setConflito({
            motoboy_atual: nomeMotoboy || "outro motoboy",
            id_saida: conflitoResult.id_saida ?? 0,
            status_atual: (conflitoResult as { status_atual?: string }).status_atual,
          });
        } else if ((result as ScanSuccessLocal).entrega) {
          const sucessoResult = result as ScanSuccessLocal;
          if (sucessoResult.ja_existia) {
            playSound("warn");
            pushFeedback("duplicado", "Código já registrado anteriormente", c);
            setCodigo("");
            setTimeout(() => (scanLocked.current = false), 250);
            return;
          }
          addLeitura(sucessoResult.entrega);
          setCodigo("");
          playSound("success");
          pushFeedback("sucesso", "Leitura registrada", c);
          handlePostScanDelivery(sucessoResult.entrega.id_saida, sucessoResult.entrega);
          setTimeout(() => (scanLocked.current = false), 400);
        }
      } catch (e: unknown) {
        const ax = e as {
          response?: { status?: number; data?: { detail?: string | ApiErroDetalhe; code?: string } };
        };
        const apiErro = extrairErroApi(e);
        if (apiErro.code === "BLOQUEADO_AUSENCIAS") {
          playSound("error");
          pushFeedback("erro", "Limite de tentativas atingido.", c);
          Alert.alert(
            "Limite de tentativas",
            "Limite de tentativas atingido. Solicite liberação à operação."
          );
          setTimeout(() => (scanLocked.current = false), 500);
          return;
        }
        const dataCode =
          typeof ax?.response?.data === "object" && ax?.response?.data
            ? String((ax.response.data as { code?: string }).code || "")
            : "";
        if (apiErro.code === "ENTRADA_OBRIGATORIA" || dataCode === "ENTRADA_OBRIGATORIA") {
          const msgEntrada = "Este pacote ainda não teve entrada na base.";
          playSound("error");
          pushFeedback("erro", msgEntrada, c);
          Alert.alert("Entrada necessária", msgEntrada);
          setTimeout(() => (scanLocked.current = false), 500);
          return;
        }
        const msg =
          ax?.response?.data?.detail ?? apiErro.message ?? "Código não encontrado ou erro ao processar.";
        playSound("error");
        pushFeedback("erro", typeof msg === "string" ? msg : "Erro ao processar leitura", c);
        Alert.alert("Erro", typeof msg === "string" ? msg : String(msg));
        setTimeout(() => (scanLocked.current = false), 500);
      } finally {
        if (origem === "manual") setLoading(false);
        else setCameraBusy(false);
      }
    },
    [addLeitura, codigosLidosSessao, pushFeedback, handlePostScanDelivery]
  );

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult | { nativeEvent: BarcodeScanningResult }) => {
      const result = "nativeEvent" in event ? event.nativeEvent : event;
      const type = String(result?.type || "").toLowerCase();
      if (type && type !== "qr") return;
      const data = result?.data ?? "";
      if (data && !scanLocked.current) {
        processarCodigo(data, "camera");
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
    await processarCodigo(c, "manual");
  };

  const handleLancarAvulso = useCallback(
    async (payload: {
      identificacao: string | null;
      quantidade: number;
      fotoObjectKeys: string[];
      photoIds: string[];
    }) => {
      setLoading(true);
      try {
        const res = await lancarAvulsoMobile({
          identificacao: payload.identificacao,
          quantidade: payload.quantidade,
          ...(payload.fotoObjectKeys.length
            ? {
                foto_object_keys: payload.fotoObjectKeys,
                photo_ids: payload.photoIds,
                foto_object_key: payload.fotoObjectKeys[0],
                photo_id: payload.photoIds[0],
              }
            : {}),
        });
        (res.saidas ?? []).forEach((s) => {
          addLeitura({ id_saida: s.id_saida, codigo: s.codigo, servico: "Avulso" });
        });
        playSound("success");
        pushFeedback("sucesso", res.mensagem || "Avulsos lançados com sucesso.");
        setShowAvulsoModal(false);
        setModoManual(false);
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { detail?: string } } };
        const msg =
          ax?.response?.data?.detail ??
          (e instanceof Error ? e.message : "Erro ao lançar avulso.");
        playSound("error");
        Alert.alert("Erro", String(msg));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [addLeitura, pushFeedback]
  );

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
      const eraEntregue = String(conflito.status_atual ?? "")
        .toLowerCase()
        .includes("entregue");
      pushFeedback(
        "sucesso",
        eraEntregue ? "Reatribuído — Em rota" : "Leitura assumida",
        entrega.codigo ?? String(conflito.id_saida)
      );
      handlePostScanDelivery(conflito.id_saida, entrega);
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

  const formatDatePtBr = useCallback((iso: string) => {
    const p = String(iso || "").split("-");
    if (p.length !== 3) return iso;
    return `${p[2]}/${p[1]}/${p[0]}`;
  }, []);

  const handleConfirmarDiaAnterior = useCallback(async () => {
    if (!conflitoDiaAnterior) return;
    const idSaida = conflitoDiaAnterior.id_saida;
    setConfirmandoDiaAnterior(true);
    try {
      await confirmarNovaSaidaMesmoEntregador(idSaida);
      const entrega = await getEntrega(idSaida);
      addLeitura(entrega);
      playSound("success");
      pushFeedback("sucesso", "Nova saída confirmada", entrega.codigo ?? conflitoDiaAnterior.codigo);
      setConflitoDiaAnterior(null);
      scanLocked.current = false;
      handlePostScanDelivery(idSaida, entrega);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string; message?: string } } };
      const msg = ax?.response?.data?.detail ?? ax?.response?.data?.message ?? "Erro ao confirmar nova saída.";
      playSound("error");
      pushFeedback("erro", typeof msg === "string" ? msg : "Erro ao confirmar nova saída", conflitoDiaAnterior.codigo);
      Alert.alert("Erro", typeof msg === "string" ? msg : String(msg));
    } finally {
      setConfirmandoDiaAnterior(false);
    }
  }, [addLeitura, conflitoDiaAnterior, pushFeedback, handlePostScanDelivery]);

  const handleCancelarDiaAnterior = useCallback(() => {
    setConflitoDiaAnterior(null);
    scanLocked.current = false;
  }, []);

  const handleConfirmarEncerrado = useCallback(async () => {
    if (!conflitoEncerrado) return;
    const idSaida = conflitoEncerrado.id_saida;
    setConfirmandoEncerrado(true);
    try {
      await confirmarReativacaoEncerrado(idSaida);
      const entrega = await getEntrega(idSaida);
      addLeitura(entrega);
      playSound("success");
      pushFeedback("sucesso", "Nova saída confirmada", entrega.codigo ?? conflitoEncerrado.codigo);
      setConflitoEncerrado(null);
      scanLocked.current = false;
      handlePostScanDelivery(idSaida, entrega);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string; message?: string } } };
      const msg =
        ax?.response?.data?.detail ?? ax?.response?.data?.message ?? "Erro ao confirmar nova saída.";
      playSound("error");
      pushFeedback(
        "erro",
        typeof msg === "string" ? msg : "Erro ao confirmar nova saída",
        conflitoEncerrado.codigo
      );
      Alert.alert("Erro", typeof msg === "string" ? msg : String(msg));
    } finally {
      setConfirmandoEncerrado(false);
    }
  }, [addLeitura, conflitoEncerrado, pushFeedback, handlePostScanDelivery]);

  const handleCancelarEncerrado = useCallback(() => {
    setConflitoEncerrado(null);
    scanLocked.current = false;
  }, []);

  const handleComecarEntregar = async () => {
    if (leiturasSession.length === 0) return;
    const deliveryIds = leiturasSession.map((l) => l.id_saida);
    setIniciandoRota(true);
    try {
      await startRoute(deliveryIds);
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

  const avulsoModal = (
    <AvulsoLancamentoModal
      visible={showAvulsoModal}
      loading={loading}
      exigeFoto={avulsoExigeFoto}
      onClose={() => setShowAvulsoModal(false)}
      onConfirm={handleLancarAvulso}
    />
  );

  // Modo manual: digitação como opção secundária (somente com permissão)
  if (modoManual && podeDigitarManual) {
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
              <Text style={styles.modalTitle}>
                {String(conflito?.status_atual ?? "").toLowerCase().includes("entregue")
                  ? "Pedido já entregue"
                  : "Conflito"}
              </Text>
              <Text style={styles.modalMessage}>
                {String(conflito?.status_atual ?? "").toLowerCase().includes("entregue")
                  ? `Pedido já entregue pelo motoboy ${conflito?.motoboy_atual}. Deseja reassumir e colocar Em rota?`
                  : `Pedido já atribuído ao motoboy ${conflito?.motoboy_atual}. Deseja assumir?`}
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
        {avulsoModal}
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
        {podeLancarAvulso ? (
          <TouchableOpacity
            style={[styles.btnScan, loading && styles.btnDisabled, { marginTop: 10, backgroundColor: colors.primary }]}
            onPress={() => setShowAvulsoModal(true)}
            disabled={loading}
          >
            <Text style={styles.btnScanText}>Lançar Avulso</Text>
          </TouchableOpacity>
        ) : null}
        {podeDigitarManual ? (
          <TouchableOpacity style={styles.linkManual} onPress={() => setModoManual(true)}>
            <Text style={styles.linkManualText}>Digitar código manualmente</Text>
          </TouchableOpacity>
        ) : null}
        {avulsoModal}
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
        <Text style={styles.subtitleWhite}>Aponte para o QRCode da etiqueta</Text>
      </View>

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: BARCODE_TYPES,
        }}
        enableTorch={torch.enableTorch}
        onCameraReady={torch.onCameraReady}
        onBarcodeScanned={scannerAtivo ? handleBarcodeScanned : undefined}
      />

      <ScannerTorchButton
        mode={torch.mode}
        onPress={torch.cycleMode}
        style={{ top: insets.top + 56, right: 16 }}
      />

      {renderFeedback()}

      <View style={styles.scanFrameContainer} pointerEvents="none">
        <ScanFrameOverlay wrapStyle={styles.scanFrameWrap} />
      </View>

      {cameraBusy ? (
        <View style={[styles.processingChip, { top: insets.top + 120 }]} pointerEvents="none">
          <Text style={styles.processingChipText}>Lendo…</Text>
        </View>
      ) : null}

      <View style={[styles.footerOverlay, { paddingBottom: Math.max(16, insets.bottom) }]}>
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
                    <Text
                      style={styles.listaItemCodigo}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {l.codigo || "—"}
                    </Text>
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

        <View style={styles.secondaryActionsRow}>
          {podeLancarAvulso ? (
            <TouchableOpacity
              style={[styles.secondaryActionBtn, (cameraBusy || loading) && styles.secondaryActionBtnDisabled]}
              onPress={() => setShowAvulsoModal(true)}
              disabled={cameraBusy || loading}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryActionBtnText}>Lançar Avulso</Text>
            </TouchableOpacity>
          ) : null}
          {podeDigitarManual ? (
            <TouchableOpacity
              style={[styles.secondaryActionBtn, (cameraBusy || loading) && styles.secondaryActionBtnDisabled]}
              onPress={() => setModoManual(true)}
              disabled={cameraBusy || loading}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryActionBtnText}>Digitar código</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {avulsoModal}

      <Modal visible={!!conflito} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {String(conflito?.status_atual ?? "").toLowerCase().includes("entregue")
                ? "Pedido já entregue"
                : "Conflito"}
            </Text>
            <Text style={styles.modalMessage}>
              {String(conflito?.status_atual ?? "").toLowerCase().includes("entregue")
                ? `Pedido já entregue pelo motoboy ${conflito?.motoboy_atual}. Deseja reassumir e colocar Em rota?`
                : `Pedido já atribuído ao motoboy ${conflito?.motoboy_atual}. Deseja assumir?`}
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

      <Modal visible={!!conflitoDiaAnterior} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Pedido já lido em data anterior</Text>
            <Text style={styles.modalMessage}>
              Este pedido já foi lido em {formatDatePtBr(conflitoDiaAnterior?.data_operacional_anterior ?? "")} para o motoboy{" "}
              {conflitoDiaAnterior?.motoboy_nome ?? "Motoboy"}.
              {"\n\n"}
              Deseja confirmar que ele está saindo novamente para entrega hoje?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={handleCancelarDiaAnterior} disabled={confirmandoDiaAnterior}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnOk} onPress={handleConfirmarDiaAnterior} disabled={confirmandoDiaAnterior}>
                {confirmandoDiaAnterior ? (
                  <ActivityIndicator color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.modalBtnOkText}>Confirmar saída hoje</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!conflitoEncerrado} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Pedido encerrado</Text>
            <Text style={styles.modalMessage}>
              Este pedido foi encerrado pelo sistema e não está mais na lista de pendentes.
              {"\n\n"}
              Deseja confirmar uma nova saída para entrega?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={handleCancelarEncerrado}
                disabled={confirmandoEncerrado}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnOk}
                onPress={handleConfirmarEncerrado}
                disabled={confirmandoEncerrado}
              >
                {confirmandoEncerrado ? (
                  <ActivityIndicator color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.modalBtnOkText}>Confirmar saída</Text>
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
