import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useThemeColors } from "../../../theme/colors";
import { formatApiError } from "../../../utils/formatApiError";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useAuthStore } from "../../../store/authStore";
import {
  effectivePodeDigitarCodigoManual,
  effectivePodeLancarAvulso,
  effectivePodeLerColeta,
  isStaffOperacaoRole,
} from "../../../utils/role";
import { playSound } from "../../../utils/sound";
import { enviarColetaUnica, lancarAvulsoColeta, type ServicoColeta } from "../coletasApi";
import { listarBasesAtivas, type BaseItem } from "../basesApi";
import * as Haptics from "expo-haptics";
import { ScanFrameOverlay } from "../components/ScanFrameOverlay";
import AvulsoLancamentoModal from "../components/AvulsoLancamentoModal";
import PhysicalScannerInput from "../components/PhysicalScannerInput";
import { classifyCodigoParaOperacao, type ClassifyCodigoOperacaoResult } from "../parseCodigoQr";
import {
  getNavigationOptions,
  openNavigationByAddress,
  type NavigationApp,
} from "../../entregas/utils/externalNavigation";

type StatusLeitura = "pendente" | "enviado" | "duplicado" | "erro";

interface ColetaItemLocal {
  codigo: string;
  servico: ServicoColeta;
  status: StatusLeitura;
  qr_payload_raw?: string;
  is_grande?: boolean;
}

type FeedbackTipo = "sucesso" | "duplicado" | "erro" | "info";

interface FeedbackVisual {
  tipo: FeedbackTipo;
  mensagem: string;
  codigo?: string;
}

const BARCODE_TYPES: import("expo-camera").BarcodeType[] = [
  "qr",
];

const SCAN_DEBOUNCE_MS = 1500;
const recentCodes = new Map<string, number>();
const FEEDBACK_MS = 1100;
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

interface ClassifyResult {
  ok: boolean;
  servico?: ServicoColeta;
  codigo?: string;
  qr_payload_raw?: string;
  motivo?: string;
}

function classifyCodigo(rawInput: string): ClassifyResult {
  const r: ClassifyCodigoOperacaoResult = classifyCodigoParaOperacao(rawInput);
  if (!r.ok) {
    return { ok: false, motivo: r.motivo };
  }
  const serv = r.servico as ServicoColeta;
  if (serv !== "Shopee" && serv !== "Mercado Livre" && serv !== "Avulso") {
    return { ok: true, servico: "Avulso", codigo: r.codigo, qr_payload_raw: r.qr_payload_raw };
  }
  return { ok: true, servico: serv, codigo: r.codigo, qr_payload_raw: r.qr_payload_raw };
}

export default function LeituraColetasScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [permission, requestPermission] = useCameraPermissions();
  const [bases, setBases] = useState<BaseItem[]>([]);
  const [base, setBase] = useState("");
  const [carregandoBases, setCarregandoBases] = useState(false);
  const [modalBaseVisible, setModalBaseVisible] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [leituras, setLeituras] = useState<ColetaItemLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [modoLeitorFisico, setModoLeitorFisico] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [avulsoModalVisible, setAvulsoModalVisible] = useState(false);
  const [feedbackVisual, setFeedbackVisual] = useState<FeedbackVisual | null>(null);
  const scanLocked = useRef(false);
  const feedbackClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 24, paddingBottom: 48 },
        feedbackStrip: {
          borderRadius: 12,
          borderWidth: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 14,
        },
        feedbackTitulo: { fontSize: 14, fontWeight: "700" },
        feedbackCodigo: { fontSize: 13, fontWeight: "600", marginTop: 4 },
        cameraFeedbackAbs: {
          position: "absolute",
          top: insets.top + 92,
          left: 16,
          right: 16,
          zIndex: 12,
          borderRadius: 12,
          borderWidth: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        description: { fontSize: 15, color: colors.textSecondary, marginBottom: 16 },
        badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
        badge: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: colors.backgroundCard,
        },
        badgeText: { fontSize: 13, color: colors.textSecondary },
        baseBlock: {
          borderRadius: 14,
          padding: 16,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginBottom: 16,
        },
        baseBadge: {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: "rgba(20, 184, 166, 0.14)",
          marginBottom: 10,
        },
        baseBadgeText: {
          fontSize: 11,
          fontWeight: "700",
          color: "#0F766E",
          textTransform: "uppercase",
        },
        baseLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: "600" },
        baseNome: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 12 },
        baseCta: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: "rgba(20, 184, 166, 0.12)",
          borderWidth: 1,
          borderColor: "#14B8A6",
        },
        baseCtaText: { fontSize: 15, fontWeight: "600", color: "#0F766E", flex: 1 },
        baseHint: {
          fontSize: 14,
          color: colors.textSecondary,
          marginBottom: 12,
          lineHeight: 20,
        },
        enderecoTexto: {
          fontSize: 14,
          color: colors.textSecondary,
          lineHeight: 20,
          marginBottom: 10,
        },
        navActionsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 4,
        },
        navActionChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.background,
        },
        navActionChipText: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.primary,
        },
        atualizarLink: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: "600",
        },
        infoCard: {
          marginTop: 8,
          padding: 16,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
        },
        infoTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 4 },
        infoText: { fontSize: 14, color: colors.textSecondary },
        label: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
        input: {
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 16,
          color: colors.text,
          marginBottom: 12,
        },
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
          borderColor: "#14B8A6",
          backgroundColor: "rgba(20, 184, 166, 0.12)",
        },
        pickerItemText: { fontSize: 16, color: colors.text, fontWeight: "600" },
        pickerItemSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        pickerClose: { alignSelf: "center", paddingVertical: 12 },
        pickerCloseText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
        row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
        btnPrimary: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        btnSecondary: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: colors.backgroundCard,
          alignItems: "center",
          justifyContent: "center",
        },
        btnOutline: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: colors.primary,
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
        },
        btnTextPrimary: { color: colors.primaryContrast, fontSize: 15, fontWeight: "600" },
        btnTextSecondary: { color: colors.text, fontSize: 15, fontWeight: "500" },
        btnTextOutline: { color: colors.primary, fontSize: 15, fontWeight: "600" },
        cameraCta: {
          paddingVertical: 16,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        },
        cameraCtaText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "700" },
        scanChoiceRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
        scanChoice: {
          flex: 1,
          minHeight: 82,
          paddingVertical: 14,
          paddingHorizontal: 10,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        scanChoiceOutline: {
          backgroundColor: colors.backgroundCard,
          borderWidth: 1.5,
          borderColor: colors.primary,
        },
        scanChoiceOutlineText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
        filterHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        filterHeaderTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
        resumoCard: {
          borderRadius: 14,
          padding: 16,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginTop: 4,
          marginBottom: 8,
        },
        sessaoTitulo: {
          fontSize: 12,
          fontWeight: "700",
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          marginBottom: 8,
        },
        totalGigante: {
          fontSize: 40,
          fontWeight: "800",
          color: colors.text,
          lineHeight: 44,
        },
        totalLegenda: {
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: 4,
          marginBottom: 14,
        },
        resumoRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 12,
        },
        resumoBadge: {
          flex: 1,
          marginHorizontal: 4,
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: "center",
          backgroundColor: colors.background,
        },
        resumoShopee: {
          borderWidth: 1,
          borderColor: "rgba(238,77,45,0.45)",
        },
        resumoMl: {
          borderWidth: 1,
          borderColor: "rgba(218,165,32,0.55)",
        },
        resumoAvulso: {
          borderWidth: 1,
          borderColor: "rgba(99,102,241,0.45)",
        },
        resumoNum: { fontSize: 18, fontWeight: "700", color: colors.text },
        resumoLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        ultimaLeituraBox: {
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        ultimaLeituraLabel: {
          fontSize: 11,
          fontWeight: "700",
          color: colors.textSecondary,
          textTransform: "uppercase",
          marginBottom: 4,
        },
        ultimaLeituraTexto: { fontSize: 14, color: colors.text, fontWeight: "600" },
        ultimaLeituraSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        listaContainer: {
          marginTop: 12,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
          maxHeight: 260,
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
        listaHeaderText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
        listaItem: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        listaCodigo: { fontSize: 14, fontWeight: "600", color: colors.text },
        listaServicoBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
        },
        listaServicoText: { fontSize: 11, fontWeight: "600", color: "#fff" },
        servShopee: { backgroundColor: "rgba(238,77,45,0.9)" },
        servMl: { backgroundColor: "rgba(255,193,7,0.9)" },
        servAvulso: { backgroundColor: "rgba(99,102,241,0.9)" },
        statusBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          marginLeft: 6,
        },
        statusText: { fontSize: 11, fontWeight: "600" },
        statusPendente: { backgroundColor: "rgba(108,117,125,0.15)" },
        statusEnviado: { backgroundColor: "rgba(25,135,84,0.15)" },
        statusDuplicado: { backgroundColor: "rgba(255,193,7,0.15)" },
        statusErro: { backgroundColor: "rgba(220,53,69,0.15)" },
        statusPendenteText: { color: colors.textSecondary },
        statusEnviadoText: { color: "#198754" },
        statusDuplicadoText: { color: "#856404" },
        statusErroText: { color: "#dc3545" },
        btnRemover: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: "rgba(220,53,69,0.08)",
        },
        btnRemoverText: { fontSize: 12, color: "#dc3545", fontWeight: "600" },
        cameraModalOverlay: {
          flex: 1,
          backgroundColor: "#000",
        },
        cameraHeader: {
          position: "absolute",
          top: insets.top + 12,
          left: 16,
          right: 16,
          zIndex: 10,
        },
        cameraBackText: { fontSize: 16, color: "#fff", marginBottom: 6, fontWeight: "600" },
        cameraTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
        cameraSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 4 },
        cameraFooter: {
          position: "absolute",
          bottom: Math.max(24, insets.bottom + 8),
          left: 16,
          right: 16,
          zIndex: 10,
        },
        permissionText: {
          fontSize: 16,
          color: colors.text,
          textAlign: "center",
          marginBottom: 16,
        },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 20,
        },
        loadingText: { color: "#fff", marginTop: 8, fontSize: 15 },
        modoManualWrap: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: Math.max(20, insets.top),
          paddingHorizontal: 20,
          justifyContent: "center",
        },
        modoManualTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 6 },
        modoManualSubtitle: { color: colors.textSecondary, fontSize: 14, marginBottom: 18 },
        scannerAction: {
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.75)",
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.35)",
          marginTop: 8,
        },
        scannerActionText: { color: "#fff", fontSize: 15, fontWeight: "700" },
      }),
    [colors, insets.bottom, insets.top]
  );

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

  const baseSelecionadaOk = base.trim().length > 0;
  const isOwnerTipoBase = String(currentUser?.tipo_owner || "").toLowerCase() === "base";
  const entidadeLabel = isOwnerTipoBase ? "Seller" : "Base";
  const entidadeLabelLower = isOwnerTipoBase ? "seller" : "base";
  const baseSelecionada = useMemo(
    () => bases.find((b) => b.base === base) ?? null,
    [bases, base]
  );
  const enderecoSelecionado = (baseSelecionada?.endereco_completo || "").trim();
  const navOptions = useMemo(() => getNavigationOptions(), []);

  const carregarBases = useCallback(async () => {
    setCarregandoBases(true);
    try {
      const lista = await listarBasesAtivas();
      setBases(lista);
      setBase((atual) => {
        if (atual && lista.some((b) => b.base === atual)) return atual;
        if (lista.length === 1) return lista[0].base;
        return "";
      });
    } catch (e) {
      Alert.alert(
        "Erro",
        formatApiError(e, `Não foi possível carregar os ${isOwnerTipoBase ? "sellers" : "bases"}.`)
      );
    } finally {
      setCarregandoBases(false);
    }
  }, [isOwnerTipoBase]);

  useEffect(() => {
    void carregarBases();
  }, [carregarBases]);

  const selecionarBase = useCallback((item: BaseItem) => {
    setBase(item.base);
    setModalBaseVisible(false);
  }, []);

  const handleNavEndereco = useCallback(
    async (app: NavigationApp) => {
      if (!enderecoSelecionado) {
        Alert.alert("Atenção", "Endereço indisponível para este cadastro.");
        return;
      }
      await openNavigationByAddress(app, enderecoSelecionado);
    },
    [enderecoSelecionado]
  );

  const feedbackColors = useCallback((tipo: FeedbackTipo) => {
    if (tipo === "sucesso") return { bg: "rgba(25,135,84,0.16)", border: "rgba(25,135,84,0.4)", fg: "#198754" };
    if (tipo === "duplicado") return { bg: "rgba(255,193,7,0.18)", border: "rgba(200,150,0,0.4)", fg: "#856404" };
    if (tipo === "erro") return { bg: "rgba(220,53,69,0.16)", border: "rgba(220,53,69,0.4)", fg: "#dc3545" };
    return { bg: "rgba(13,110,253,0.16)", border: "rgba(13,110,253,0.36)", fg: "#0d6efd" };
  }, []);

  const renderFeedbackStrip = useCallback(
    (variant: "main" | "camera") => {
      if (!feedbackVisual) return null;
      const c = feedbackColors(feedbackVisual.tipo);
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
    },
    [feedbackColors, feedbackVisual, styles.cameraFeedbackAbs, styles.feedbackCodigo, styles.feedbackStrip, styles.feedbackTitulo]
  );

  const podeLerColeta = effectivePodeLerColeta(currentUser);
  const podeManual = effectivePodeDigitarCodigoManual(currentUser);
  const podeLancarAvulso = effectivePodeLancarAvulso(currentUser);
  const subBase = currentUser?.sub_base ?? "";
  const ignorarColeta = Boolean(currentUser?.ignorar_coleta);
  const hideStaffBadges = isStaffOperacaoRole(currentUser?.role);

  const resumo = useMemo(() => {
    const ativos = leituras.filter((l) => l.status !== "duplicado");
    const shopee = ativos.filter((l) => l.servico === "Shopee").length;
    const ml = ativos.filter((l) => l.servico === "Mercado Livre").length;
    const avulso = ativos.filter((l) => l.servico === "Avulso").length;
    const total = ativos.length;
    return { shopee, ml, avulso, total };
  }, [leituras]);
  const ultimaLeitura = useMemo(() => {
    for (let i = leituras.length - 1; i >= 0; i -= 1) {
      const item = leituras[i];
      if (item.status === "enviado" || item.status === "duplicado" || item.status === "erro") {
        return item;
      }
    }
    return null;
  }, [leituras]);
  const codigosLidosSessao = useMemo(() => {
    const set = new Set<string>();
    leituras.forEach((l) => {
      if (l.status === "erro") return;
      const code = String(l.codigo || "").trim().toUpperCase();
      if (code) set.add(code);
    });
    return set;
  }, [leituras]);

  const ensurePermissionAndOpenCamera = useCallback(async () => {
    if (!base.trim()) {
      Alert.alert(
        `${entidadeLabel} obrigatóri${isOwnerTipoBase ? "o" : "a"}`,
        `Selecione ${isOwnerTipoBase ? "o" : "a"} ${entidadeLabelLower} antes de iniciar as leituras.`
      );
      return;
    }
    if (!permission) {
      const { granted } = await requestPermission();
      if (!granted) return;
      setModoLeitorFisico(false);
      setModoManual(false);
      setCameraAtiva(true);
      return;
    }
    if (!permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    setModoLeitorFisico(false);
    setModoManual(false);
    setCameraAtiva(true);
  }, [base, entidadeLabel, entidadeLabelLower, isOwnerTipoBase, permission, requestPermission]);

  const openPhysicalScanner = useCallback(() => {
    if (!base.trim()) {
      Alert.alert(
        `${entidadeLabel} obrigatóri${isOwnerTipoBase ? "o" : "a"}`,
        `Selecione ${isOwnerTipoBase ? "o" : "a"} ${entidadeLabelLower} antes de iniciar as leituras.`
      );
      return;
    }
    if (!podeLerColeta || ignorarColeta) return;
    setModoLeitorFisico(true);
    setModoManual(false);
    setCameraAtiva(true);
  }, [base, entidadeLabel, entidadeLabelLower, ignorarColeta, isOwnerTipoBase, podeLerColeta]);

  const processarLeitura = useCallback(
    async (raw: string, origem: "camera" | "manual" | "leitor") => {
      const baseTrimmed = base.trim();
      if (!podeLerColeta) {
        pushFeedback("info", "Sem permissão para leitura de coletas.");
        Alert.alert("Sem permissão", "Seu usuário não possui permissão para leitura de coletas.");
        return;
      }
      if (ignorarColeta) {
        pushFeedback("info", "Fluxo de coletas desativado para este owner.");
        Alert.alert(
          "Coletas desativadas",
          "Este owner está configurado para não utilizar o fluxo de coletas."
        );
        return;
      }
      if (!baseTrimmed) {
        pushFeedback("info", `Selecione ${isOwnerTipoBase ? "o" : "a"} ${entidadeLabelLower} antes de iniciar.`);
        Alert.alert(
          `${entidadeLabel} obrigatóri${isOwnerTipoBase ? "o" : "a"}`,
          `Selecione ${isOwnerTipoBase ? "o" : "a"} ${entidadeLabelLower} para registrar as coletas.`
        );
        return;
      }

      const c = String(raw || "").trim();
      if (!c || scanLocked.current) return;
      const codeKey = c.toUpperCase();
      if (codigosLidosSessao.has(codeKey)) {
        if (shouldNotifyDuplicate(`sess:${codeKey}`)) {
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("duplicado", "Código já lido nesta sessão.", codeKey);
        }
        return;
      }
      if (isRecentlyScanned(c)) {
        if (shouldNotifyDuplicate(`frame:${codeKey}`)) {
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("duplicado", "Código já está em processamento.", codeKey);
        }
        return;
      }
      markScanned(c);
      scanLocked.current = true;

      const classified = classifyCodigo(c);
      if (!classified.ok || !classified.codigo || !classified.servico) {
        scanLocked.current = false;
        playSound("warn");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        pushFeedback("erro", classified.motivo || "Código não reconhecido", c.slice(0, 80));
        Alert.alert(
          "Código não reconhecido",
          classified.motivo || "Este padrão de código não está configurado para coleta."
        );
        return;
      }

      const codigoNorm = classified.codigo;
      const servico = classified.servico;

      if (leituras.some((l) => l.codigo === codigoNorm && l.status !== "erro")) {
        scanLocked.current = false;
        playSound("warn");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        pushFeedback("duplicado", "Código já lido nesta sessão.", codigoNorm);
        return;
      }

      const novoItem: ColetaItemLocal = {
        codigo: codigoNorm,
        servico,
        status: "pendente",
        qr_payload_raw: classified.qr_payload_raw,
      };

      setLeituras((prev) => [...prev, novoItem]);
      if (origem === "manual") {
        setCodigoInput("");
      }

      setLoading(true);
      try {
        await enviarColetaUnica({
          base: baseTrimmed,
          item: {
            codigo: codigoNorm,
            servico,
            qr_payload_raw: classified.qr_payload_raw,
          },
        });
        setLeituras((prev) =>
          prev.map((l) =>
            l.codigo === codigoNorm ? { ...l, status: "enviado" } : l
          )
        );
        playSound("success");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        pushFeedback("sucesso", "Coleta registrada com sucesso.", codigoNorm);
      } catch (err) {
        const ax = err as {
          response?: { status?: number; data?: { detail?: string } };
        };
        const status = ax.response?.status;
        const detail = ax.response?.data?.detail;

        if (status === 409) {
          setLeituras((prev) =>
            prev.map((l) =>
              l.codigo === codigoNorm ? { ...l, status: "duplicado" } : l
            )
          );
          playSound("warn");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          pushFeedback("duplicado", String(detail || "Código já coletado."), codigoNorm);
        } else {
          setLeituras((prev) =>
            prev.map((l) =>
              l.codigo === codigoNorm ? { ...l, status: "erro" } : l
            )
          );
          playSound("error");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          pushFeedback("erro", typeof detail === "string" && detail ? detail : "Falha ao registrar coleta.", codigoNorm);
          Alert.alert(
            "Erro ao enviar",
            typeof detail === "string" && detail ? detail : "Falha ao registrar a coleta."
          );
        }
      } finally {
        setLoading(false);
        setTimeout(() => {
          scanLocked.current = false;
        }, 400);
      }
    },
    [base, codigosLidosSessao, entidadeLabel, entidadeLabelLower, ignorarColeta, isOwnerTipoBase, leituras, podeLerColeta, pushFeedback]
  );

  const handleRegistrarManual = useCallback(async () => {
    const c = codigoInput.trim();
    if (!c) {
      Alert.alert("Atenção", "Digite o código para registrar.");
      return;
    }
    await processarLeitura(c, "manual");
  }, [codigoInput, processarLeitura]);

  const handleLancarAvulso = useCallback(
    async (payload: {
      identificacao: string | null;
      quantidade: number;
      fotoObjectKeys: string[];
      photoIds: string[];
    }) => {
      const baseTrimmed = base.trim();
      if (!baseTrimmed) {
        throw new Error(
          `Selecione ${isOwnerTipoBase ? "o" : "a"} ${entidadeLabelLower} antes de lançar o avulso.`
        );
      }      setLoading(true);
      try {
        const result = await lancarAvulsoColeta({
          base: baseTrimmed,
          identificacao: payload.identificacao,
          quantidade: payload.quantidade,
        });
        const novos: ColetaItemLocal[] = result.saidas.map((saida) => ({
          codigo: saida.codigo,
          servico: "Avulso",
          status: "enviado",
        }));
        setLeituras((prev) => [...prev, ...novos]);
        setAvulsoModalVisible(false);
        playSound("success");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        pushFeedback("sucesso", result.mensagem, result.codigos.at(-1));
      } catch (error) {
        playSound("error");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const mensagem = formatApiError(error, "Não foi possível lançar o avulso na coleta.");
        pushFeedback("erro", mensagem);
        throw new Error(mensagem);
      } finally {
        setLoading(false);
      }
    },
    [base, entidadeLabelLower, isOwnerTipoBase, pushFeedback]
  );

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult | { nativeEvent: BarcodeScanningResult }) => {
      if (loading) return;
      const result = "nativeEvent" in event ? event.nativeEvent : event;
      const type = String(result?.type || "").toLowerCase();
      if (type && type !== "qr") return;
      const data = result?.data ?? "";
      if (data && !scanLocked.current) {
        void processarLeitura(data, "camera");
      }
    },
    [loading, processarLeitura]
  );

  const handleRemover = useCallback((codigo: string) => {
    setLeituras((prev) => prev.filter((l) => l.codigo !== codigo));
  }, []);

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeaderBar
          title="Leitura de coletas"
          onBack={() => navigation.goBack()}
          paddingTop={Math.max(12, insets.top)}
        />
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 48 + insets.bottom }]}
    >
      {!hideStaffBadges || ignorarColeta ? (
        <View style={styles.badgeRow}>
          {!hideStaffBadges && subBase ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Unidade: {subBase}</Text>
            </View>
          ) : null}
          {!hideStaffBadges ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                Coleta: {podeLerColeta && !ignorarColeta ? "Ativa" : "Desativada"}
              </Text>
            </View>
          ) : null}
          {ignorarColeta ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Coletas desativadas para este owner</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {feedbackVisual && !cameraAtiva ? renderFeedbackStrip("main") : null}

      <View style={styles.baseBlock}>
        {baseSelecionadaOk ? (
          <View style={styles.baseBadge}>
            <Text style={styles.baseBadgeText}>{entidadeLabel} selecionad{isOwnerTipoBase ? "o" : "a"}</Text>
          </View>
        ) : null}
        {!baseSelecionadaOk ? <Text style={styles.baseLabel}>{entidadeLabel}</Text> : null}
        {baseSelecionadaOk ? (
          <Text style={styles.baseNome} numberOfLines={2}>
            {base.trim()}
          </Text>
        ) : (
          <Text style={styles.baseHint}>
            Selecione {isOwnerTipoBase ? "o" : "a"} {entidadeLabelLower} para iniciar as leituras de coleta.
          </Text>
        )}
        {baseSelecionadaOk && enderecoSelecionado ? (
          <>
            <Text style={styles.enderecoTexto}>{enderecoSelecionado}</Text>
            <View style={styles.navActionsRow}>
              {navOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.navActionChip}
                  onPress={() => void handleNavEndereco(opt.id)}
                  accessibilityLabel={opt.label}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={
                      opt.id === "copy"
                        ? "copy-outline"
                        : opt.id === "waze"
                          ? "navigate-outline"
                          : "map-outline"
                    }
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.navActionChipText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
        <TouchableOpacity
          style={[styles.baseCta, baseSelecionadaOk && enderecoSelecionado ? { marginTop: 12 } : null]}
          onPress={() => setModalBaseVisible(true)}
          disabled={loading}
          accessibilityLabel={
            baseSelecionadaOk ? `Trocar ${entidadeLabelLower}` : `Selecionar ${entidadeLabelLower}`
          }
          accessibilityRole="button"
        >
          <Text style={styles.baseCtaText}>
            {baseSelecionadaOk ? `Trocar ${entidadeLabelLower}` : `Selecionar ${entidadeLabelLower}`}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#0F766E" />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", marginTop: 10, justifyContent: "flex-end" }}>
          <TouchableOpacity onPress={() => void carregarBases()} disabled={carregandoBases}>
            {carregandoBases ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.atualizarLink}>Atualizar lista</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {baseSelecionadaOk && podeLerColeta && !ignorarColeta ? (
        <View style={styles.scanChoiceRow}>
          <TouchableOpacity
            style={styles.scanChoice}
            onPress={ensurePermissionAndOpenCamera}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityLabel="Usar câmera para registrar coletas"
          >
            <Ionicons name="camera-outline" size={24} color={colors.primaryContrast} />
            <Text style={styles.cameraCtaText}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanChoice, styles.scanChoiceOutline]}
            onPress={openPhysicalScanner}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityLabel="Usar leitor físico para registrar coletas"
          >
            <Ionicons name="barcode-outline" size={24} color={colors.primary} />
            <Text style={styles.scanChoiceOutlineText}>Leitor físico</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.resumoCard}>
        <Text style={styles.sessaoTitulo}>Nesta sessão</Text>
        <Text style={styles.totalGigante}>{resumo.total}</Text>
        <Text style={styles.totalLegenda}>Pacotes registrados na coleta atual</Text>
        <View style={styles.resumoRow}>
          <View style={[styles.resumoBadge, styles.resumoShopee]}>
            <Text style={styles.resumoNum}>{resumo.shopee}</Text>
            <Text style={styles.resumoLabel}>Shopee</Text>
          </View>
          <View style={[styles.resumoBadge, styles.resumoMl]}>
            <Text style={styles.resumoNum}>{resumo.ml}</Text>
            <Text style={styles.resumoLabel}>Mercado Livre</Text>
          </View>
          <View style={[styles.resumoBadge, styles.resumoAvulso]}>
            <Text style={styles.resumoNum}>{resumo.avulso}</Text>
            <Text style={styles.resumoLabel}>Avulso</Text>
          </View>
        </View>
        <View style={styles.ultimaLeituraBox}>
          <Text style={styles.ultimaLeituraLabel}>Última leitura</Text>
          {ultimaLeitura ? (
            <>
              <Text style={styles.ultimaLeituraTexto}>{ultimaLeitura.codigo}</Text>
              <Text style={styles.ultimaLeituraSub}>
                {ultimaLeitura.servico}
                {ultimaLeitura.status === "enviado"
                  ? " · Registrado"
                  : ultimaLeitura.status === "duplicado"
                    ? " · Duplicado"
                    : ultimaLeitura.status === "erro"
                      ? " · Erro"
                      : ""}
              </Text>
            </>
          ) : (
            <Text style={styles.ultimaLeituraSub}>Aguardando primeira leitura nesta sessão</Text>
          )}
        </View>
      </View>

      {leituras.length > 0 && (
        <View style={styles.listaContainer}>
          <View style={styles.listaHeader}>
            <Text style={styles.listaHeaderText}>Leituras recentes</Text>
            <Text style={styles.listaHeaderText}>{leituras.length} código(s)</Text>
          </View>
          <ScrollView>
            {leituras
              .slice(-200)
              .reverse()
              .map((l) => {
                const servStyle =
                  l.servico === "Shopee"
                    ? styles.servShopee
                    : l.servico === "Mercado Livre"
                    ? styles.servMl
                    : styles.servAvulso;
                let statusStyle = styles.statusPendente;
                let statusTextStyle = styles.statusPendenteText;
                let statusLabel = "Pendente";
                if (l.status === "enviado") {
                  statusStyle = styles.statusEnviado;
                  statusTextStyle = styles.statusEnviadoText;
                  statusLabel = "Enviado";
                } else if (l.status === "duplicado") {
                  statusStyle = styles.statusDuplicado;
                  statusTextStyle = styles.statusDuplicadoText;
                  statusLabel = "Duplicado";
                } else if (l.status === "erro") {
                  statusStyle = styles.statusErro;
                  statusTextStyle = styles.statusErroText;
                  statusLabel = "Erro";
                }
                return (
                  <View key={l.codigo} style={styles.listaItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listaCodigo}>{l.codigo}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <View style={[styles.listaServicoBadge, servStyle]}>
                          <Text style={styles.listaServicoText}>{l.servico}</Text>
                        </View>
                        <View style={[styles.statusBadge, statusStyle]}>
                          <Text style={[styles.statusText, statusTextStyle]}>{statusLabel}</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.btnRemover}
                      onPress={() => handleRemover(l.codigo)}
                    >
                      <Text style={styles.btnRemoverText}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
          </ScrollView>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadingText}>Enviando coleta...</Text>
        </View>
      )}

      <Modal visible={cameraAtiva} animationType="slide" onRequestClose={() => setCameraAtiva(false)}>
        {modoManual && podeManual ? (
          <View style={styles.modoManualWrap}>
            <TouchableOpacity onPress={() => setModoManual(false)} disabled={loading}>
              <Text style={styles.btnTextOutline}>
                ← Voltar para {modoLeitorFisico ? "o leitor físico" : "a câmera"}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modoManualTitle, { marginTop: 28 }]}>Digitar código</Text>
            <Text style={styles.modoManualSubtitle}>
              O código será registrado na coleta da base {base.trim()}.
            </Text>
            {renderFeedbackStrip("main")}
            <TextInput
              style={styles.input}
              placeholder="Código do pacote"
              placeholderTextColor={colors.placeholder}
              value={codigoInput}
              onChangeText={setCodigoInput}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
              autoFocus
              onSubmitEditing={() => void handleRegistrarManual()}
            />
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => void handleRegistrarManual()}
              disabled={loading || !codigoInput.trim()}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={styles.btnTextPrimary}>Registrar coleta</Text>
              )}
            </TouchableOpacity>
            {podeLancarAvulso ? (
              <TouchableOpacity
                style={[styles.btnOutline, { marginTop: 12 }]}
                onPress={() => setAvulsoModalVisible(true)}
                disabled={loading}
              >
                <Text style={styles.btnTextOutline}>Lançar Avulso</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : modoLeitorFisico ? (
          <PhysicalScannerInput
            active={cameraAtiva && modoLeitorFisico && !modoManual && !avulsoModalVisible}
            disabled={loading}
            title="Leitor físico de coletas"
            subtitle={`Base ${base.trim()} · Total nesta sessão: ${resumo.total}`}
            onClose={() => setCameraAtiva(false)}
            onScan={(codigo) => processarLeitura(codigo, "leitor")}
          >
            {feedbackVisual ? renderFeedbackStrip("main") : null}
            {podeLancarAvulso ? (
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => setAvulsoModalVisible(true)}
                disabled={loading}
              >
                <Text style={styles.btnTextOutline}>Lançar Avulso</Text>
              </TouchableOpacity>
            ) : null}
            {podeManual ? (
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => setModoManual(true)}
                disabled={loading}
              >
                <Text style={styles.btnTextOutline}>Digitar código manualmente</Text>
              </TouchableOpacity>
            ) : null}
          </PhysicalScannerInput>
        ) : (
        <View style={styles.cameraModalOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setCameraAtiva(false)}>
              <Text style={styles.cameraBackText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Escanear código de coleta</Text>
            <Text style={styles.cameraSubtitle}>
              Aponte para o QRCode. As leituras serão enviadas em tempo real.
            </Text>
          </View>

          {feedbackVisual ? renderFeedbackStrip("camera") : null}

          {!permission ? (
            <View style={[styles.cameraModalOverlay, { justifyContent: "center", alignItems: "center" }]}>
              <Text style={styles.permissionText}>Carregando permissões da câmera...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={[styles.cameraModalOverlay, { justifyContent: "center", alignItems: "center" }]}>
              <Text style={styles.permissionText}>
                Precisamos de acesso à câmera para escanear os códigos de coleta.
              </Text>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={requestPermission}
                disabled={loading}
              >
                <Text style={styles.btnTextPrimary}>Permitir câmera</Text>
              </TouchableOpacity>
              {podeLancarAvulso ? (
                <TouchableOpacity
                  style={styles.scannerAction}
                  onPress={() => setAvulsoModalVisible(true)}
                  disabled={loading}
                >
                  <Text style={styles.scannerActionText}>Lançar Avulso</Text>
                </TouchableOpacity>
              ) : null}
              {podeManual ? (
                <TouchableOpacity style={styles.scannerAction} onPress={() => setModoManual(true)}>
                  <Text style={styles.scannerActionText}>Digitar código manualmente</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: BARCODE_TYPES,
                }}
                onBarcodeScanned={loading ? undefined : handleBarcodeScanned}
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
              <View style={styles.cameraFooter}>
                <View style={styles.resumoRow}>
                  <View style={[styles.resumoBadge, styles.resumoShopee]}>
                    <Text style={styles.resumoNum}>{resumo.shopee}</Text>
                    <Text style={styles.resumoLabel}>Shopee</Text>
                  </View>
                  <View style={[styles.resumoBadge, styles.resumoMl]}>
                    <Text style={styles.resumoNum}>{resumo.ml}</Text>
                    <Text style={styles.resumoLabel}>Mercado Livre</Text>
                  </View>
                  <View style={[styles.resumoBadge, styles.resumoAvulso]}>
                    <Text style={styles.resumoNum}>{resumo.avulso}</Text>
                    <Text style={styles.resumoLabel}>Avulso</Text>
                  </View>
                </View>
                {podeLancarAvulso ? (
                  <TouchableOpacity
                    style={styles.scannerAction}
                    onPress={() => setAvulsoModalVisible(true)}
                    disabled={loading}
                  >
                    <Text style={styles.scannerActionText}>Lançar Avulso</Text>
                  </TouchableOpacity>
                ) : null}
                {podeManual ? (
                  <TouchableOpacity
                    style={styles.scannerAction}
                    onPress={() => setModoManual(true)}
                    disabled={loading}
                  >
                    <Text style={styles.scannerActionText}>Digitar código manualmente</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )}
        </View>
        )}
      </Modal>

      <Modal
        visible={modalBaseVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalBaseVisible(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setModalBaseVisible(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Escolher {entidadeLabelLower}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {carregandoBases ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
              ) : bases.length === 0 ? (
                <Text style={[styles.infoText, { paddingVertical: 16 }]}>
                  Nenhum{isOwnerTipoBase ? "" : "a"} {entidadeLabelLower} ativ{isOwnerTipoBase ? "o" : "a"} disponível.
                </Text>
              ) : (
                bases.map((item) => {
                  const ativo = base === item.base;
                  return (
                    <TouchableOpacity
                      key={item.id_base}
                      style={[styles.pickerItem, ativo && styles.pickerItemActive]}
                      onPress={() => selecionarBase(item)}
                      accessibilityState={{ selected: ativo }}
                    >
                      <Text style={styles.pickerItemText}>{item.base}</Text>
                      {item.endereco_completo ? (
                        <Text style={styles.pickerItemSub} numberOfLines={2}>
                          {item.endereco_completo}
                        </Text>
                      ) : null}
                      {ativo ? (
                        <Text style={styles.pickerItemSub}>
                          Selecionad{isOwnerTipoBase ? "o" : "a"}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setModalBaseVisible(false)}>
              <Text style={styles.pickerCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <AvulsoLancamentoModal
        visible={avulsoModalVisible}
        loading={loading}
        exigeFoto={false}
        permitirFotos={false}
        onClose={() => setAvulsoModalVisible(false)}
        onConfirm={handleLancarAvulso}
      />
    </ScrollView>
      </View>
    </>
  );
}
