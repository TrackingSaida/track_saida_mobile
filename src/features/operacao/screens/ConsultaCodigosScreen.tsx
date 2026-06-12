import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Platform,
  KeyboardAvoidingView,
  Pressable,
  StatusBar,
  Image,
} from "react-native";
import type { AxiosError } from "axios";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VoiceConsultaModalProps } from "../components/VoiceConsultaModal";
import { ScanFrameOverlay } from "../components/ScanFrameOverlay";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useThemeColors } from "../../../theme/colors";
import { useAuthStore } from "../../../store/authStore";
import { effectivePodeLerSaida, isAdminRole, isMotoboyRole } from "../../../utils/role";
import { formatApiError } from "../../../utils/formatApiError";
import {
  gerarEtiquetaArquivo,
  listSaidas,
  searchCodigosCascade,
  listMotoboysOperacao,
  lerSaidaAdmin,
  updateSaidaAdmin,
  type ListSaidasParams,
  type SaidaListItem,
  type SearchCodigosMode,
  getSaidaDetail,
  getSaidaHistorico,
  type SaidaDetail,
  type SaidaHistoricoItem,
  type MotoboyItem,
} from "../saidasApi";
import { parseCodigoQrRaw, inferServicoSaida, classifyCodigoParaOperacao } from "../parseCodigoQr";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import OperacaoFilterButton from "../components/OperacaoFilterButton";
import ConsultaCodigoCard from "../components/ConsultaCodigoCard";
import ConsultaPacoteDetailModal from "../components/ConsultaPacoteDetailModal";
import OperacaoEmptyState from "../components/OperacaoEmptyState";

/** Consulta por câmera: apenas QR (moldura central), como na leitura de coleta. */
const CONSULTA_BARCODE_TYPES: import("expo-camera").BarcodeType[] = ["qr"];

const SCAN_DEBOUNCE_MS = 1200;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += BASE64_ALPHABET[a >>> 2];
    out += BASE64_ALPHABET[((a & 3) << 4) | (b >>> 4)];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[((b & 15) << 2) | (c >>> 6)] : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET[c & 63] : "=";
  }
  return out;
}

function getPeriodRange(period: "none" | "today" | "7d"): { de?: string; ate?: string } {
  if (period === "none") return {};
  const today = new Date();
  const end = formatYmd(today);
  if (period === "today") return { de: end, ate: end };
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  return { de: formatYmd(start), ate: end };
}

/** Resolve id numérico para GET /saidas/{id_saida} */
function getIdSaidaFromItem(item: SaidaListItem): number | null {
  const raw = item.id_saida ?? item.id;
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getIdSaidaFromDetail(detail: SaidaDetail | null): number | null {
  if (!detail) return null;
  const raw = (detail.id_saida as number | string | undefined) ?? detail.id;
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Reforço no cliente: GET /saidas/listar já filtra por JWT; descarta linhas com sub_base estranha. */
function filtrarSaidasPelaSubBaseDoUsuario(
  rows: SaidaListItem[],
  userSubBase: string | undefined
): SaidaListItem[] {
  const u = userSubBase?.trim();
  if (!u) return rows;
  return rows.filter((r) => {
    const sb = r.sub_base;
    if (sb == null || sb === "") return true;
    return sb === u;
  });
}

type StatusFilterUi = "" | "Saiu para entrega" | "Entregue";

type ConflitoTroca = {
  codigo: string;
  idSaida: number;
  entregadorAtual: string;
  usuarioRegistro: string;
  novoEntregador: string;
  motoboyId: number;
};

export default function ConsultaCodigosScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topInsetCamera = Math.max(insets.top, StatusBar.currentHeight ?? 0);
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const podeLerSaida = effectivePodeLerSaida(currentUser);
  const role = currentUser?.role as number | undefined;
  const podeGerarEtiqueta = role === 0 || role === 1 || role === 2;
  const podeCancelarSaida = isAdminRole(role);
  /** Ditar por voz só no perfil entregador; operador/admin usam texto e câmera. */
  const mostrarVozConsulta = isMotoboyRole(currentUser?.role as number | undefined);

  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<SaidaListItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inFlightRef = useRef(false);
  const lastScanRef = useRef(0);
  const lastCodigoConsultaRef = useRef<string | null>(null);
  const lastRawLeituraRef = useRef<string | null>(null);

  const [appliedStatus, setAppliedStatus] = useState<StatusFilterUi>("");
  const [appliedPeriod, setAppliedPeriod] = useState<"none" | "today" | "7d">("none");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [draftStatus, setDraftStatus] = useState<StatusFilterUi>("");
  const [draftPeriod, setDraftPeriod] = useState<"none" | "today" | "7d">("none");

  const [motoboys, setMotoboys] = useState<MotoboyItem[]>([]);
  const [motoboyId, setMotoboyId] = useState<number | null>(null);
  const [motoboyNome, setMotoboyNome] = useState("");
  const [lerLoading, setLerLoading] = useState(false);

  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [voiceModalComp, setVoiceModalComp] = useState<React.ComponentType<VoiceConsultaModalProps> | null>(
    null
  );
  /** Aviso não bloqueante (voz / permissões); não usa Alert. */
  const [voiceBanner, setVoiceBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!voiceBanner) return;
    const t = setTimeout(() => setVoiceBanner(null), 8000);
    return () => clearTimeout(t);
  }, [voiceBanner]);

  const [registrarLeituraVisible, setRegistrarLeituraVisible] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<SaidaDetail | null>(null);
  const [selectedHistorico, setSelectedHistorico] = useState<SaidaHistoricoItem[]>([]);
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [cancelandoSaida, setCancelandoSaida] = useState(false);
  const [gerandoEtiqueta, setGerandoEtiqueta] = useState(false);
  const [etiquetaUri, setEtiquetaUri] = useState<string | null>(null);
  const [etiquetaCodigo, setEtiquetaCodigo] = useState("");
  const [previewEtiquetaVisible, setPreviewEtiquetaVisible] = useState(false);

  const [conflito, setConflito] = useState<ConflitoTroca | null>(null);
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);
  const [pendingNaoColetado, setPendingNaoColetado] = useState<{ codigo: string; rawScan?: string } | null>(
    null
  );
  /** Modo da última busca por código. */
  const [searchMode, setSearchMode] = useState<SearchCodigosMode>("none");
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [partialHint, setPartialHint] = useState<string | null>(null);
  const buscaComCodigoExato = searchMode === "exact" && results.length <= 1;

  useEffect(() => {
    return () => {
      if (etiquetaUri) {
        void FileSystem.deleteAsync(etiquetaUri, { idempotent: true });
      }
    };
  }, [etiquetaUri]);

  const filterActiveCount = useMemo(() => {
    let count = 0;
    if (appliedStatus) count += 1;
    if (appliedPeriod !== "none") count += 1;
    return count;
  }, [appliedStatus, appliedPeriod]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 20, paddingBottom: 48 },
        hint: { fontSize: 14, color: colors.textSecondary, marginBottom: 14 },
        voiceBanner: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: "rgba(220,53,69,0.12)",
          borderWidth: 1,
          borderColor: "rgba(220,53,69,0.35)",
          marginBottom: 12,
        },
        voiceBannerText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
        searchRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        },
        searchInput: {
          flex: 1,
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: Platform.OS === "ios" ? 14 : 10,
          fontSize: 17,
          color: colors.text,
          minHeight: 52,
        },
        iconBtn: {
          width: 52,
          height: 52,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        chipScroll: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        chipText: { fontSize: 14, color: colors.textSecondary },
        chipTextSel: { color: colors.primary, fontWeight: "600" },
        heroCard: {
          borderRadius: 14,
          padding: 16,
          backgroundColor: colors.backgroundCard,
          borderWidth: 2,
          borderColor: colors.primary,
          marginBottom: 12,
        },
        card: {
          borderRadius: 12,
          padding: 12,
          backgroundColor: colors.backgroundCard,
          marginBottom: 8,
        },
        cardCodigo: { fontSize: 17, fontWeight: "700", color: colors.text },
        cardRowTop: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        },
        metaPill: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: colors.chipBackground,
          marginRight: 6,
          marginTop: 4,
        },
        metaPillText: { fontSize: 12, color: colors.textSecondary },
        metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
        servicoBadge: {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          marginRight: 6,
          marginTop: 4,
        },
        servicoBadgeText: { fontSize: 13, fontWeight: "700" },
        heroTapHint: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.inputBorder,
        },
        heroTapHintText: { fontSize: 13, color: colors.primary, fontWeight: "600", flex: 1 },
        notFoundBox: {
          padding: 16,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
          marginTop: 8,
        },
        notFoundTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 8 },
        btnPrimary: {
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
          marginTop: 10,
        },
        btnTextPrimary: { color: colors.primaryContrast, fontSize: 16, fontWeight: "700" },
        btnOutline: {
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: colors.primary,
          alignItems: "center",
          marginTop: 8,
        },
        btnOutlineText: { color: colors.primary, fontSize: 15, fontWeight: "600" },
        resultsHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 8,
          marginBottom: 6,
        },
        resultsHeaderText: { fontSize: 13, color: colors.textSecondary },
        loadMoreBtn: { marginTop: 8, alignItems: "center", paddingVertical: 8 },
        loadMoreText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
        skeleton: {
          height: 88,
          borderRadius: 12,
          backgroundColor: colors.inputBackground,
          marginBottom: 8,
        },
        sheetOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: 20,
          paddingBottom: Platform.OS === "ios" ? 32 : 20,
        },
        sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 14 },
        pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
        pill: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        pillText: { fontSize: 14, color: colors.textSecondary },
        pillTextActive: { color: colors.primary, fontWeight: "600" },
        sheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
        sheetBtnSecondary: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          alignItems: "center",
        },
        detailModalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: 20,
        },
        detailCard: {
          maxHeight: "88%",
          borderRadius: 16,
          padding: 18,
          backgroundColor: colors.backgroundCard,
        },
        detailActionsRow: {
          flexDirection: "row",
          gap: 10,
          marginTop: 14,
        },
        detailActionBtn: {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
        },
        detailActionPrimary: {
          backgroundColor: colors.primary,
        },
        detailActionDanger: {
          backgroundColor: "#dc3545",
        },
        detailActionDangerOutline: {
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: "#dc3545",
        },
        detailActionText: {
          color: colors.primaryContrast,
          fontSize: 14,
          fontWeight: "700",
        },
        previewCard: {
          flex: 1,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: colors.backgroundCard,
          marginTop: 24,
          marginBottom: 24,
        },
        previewHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.inputBorder,
        },
        previewTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
        previewFooter: {
          flexDirection: "row",
          gap: 10,
          padding: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.inputBorder,
        },
        detailTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.1)",
          justifyContent: "center",
          alignItems: "center",
        },
        cameraModalOverlay: {
          flex: 1,
          backgroundColor: "#000",
        },
        cameraHeader: {
          position: "absolute",
          top: topInsetCamera + 12,
          left: 16,
          right: 16,
          zIndex: 10,
        },
        cameraBackText: { fontSize: 16, color: "#fff", marginBottom: 6, fontWeight: "600" },
        cameraTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
        cameraSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 4 },
        permissionText: {
          fontSize: 16,
          color: "#fff",
          textAlign: "center",
          marginBottom: 16,
        },
      }),
    [colors, insets.top, insets.bottom, topInsetCamera]
  );

  const buildParams = useCallback(
    (override?: Partial<ListSaidasParams> & { codigoOverride?: string }): ListSaidasParams => {
      const range = getPeriodRange(appliedPeriod);
      const { codigoOverride, ...rest } = override ?? {};
      const raw = codigoOverride !== undefined ? codigoOverride : searchInput;
      const parsed = parseCodigoQrRaw(String(raw || ""));
      const codigoTrim = parsed.codigo.trim() || undefined;
      return {
        status: appliedStatus || undefined,
        de: range.de,
        ate: range.ate,
        limit: 50,
        offset: 0,
        sort: "recentes",
        ...rest,
        codigo: codigoTrim,
        codigoExato: codigoTrim ? true : undefined,
      };
    },
    [searchInput, appliedStatus, appliedPeriod]
  );

  const executarBusca = useCallback(
    async (nextOffset = 0, opts?: { codigoOverride?: string; forceExact?: boolean }) => {
      if (!podeLerSaida) {
        Alert.alert("Sem permissão", "Sem permissão para consultar saídas.");
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (nextOffset === 0) setLoading(true);
      else setLoadingMore(true);
      setNotFound(false);
      setPartialHint(null);
      try {
        const range = getPeriodRange(appliedPeriod);
        const baseParams: Omit<ListSaidasParams, "codigo" | "codigoExato" | "localizar"> = {
          status: appliedStatus || undefined,
          de: range.de,
          ate: range.ate,
          sort: "recentes",
        };
        const raw = opts?.codigoOverride !== undefined ? opts.codigoOverride : searchInput;
        const parsed = parseCodigoQrRaw(String(raw || ""));
        const codigoTrim = parsed.codigo.trim();

        if (nextOffset > 0) {
          const params = buildParams({ offset: nextOffset, codigoOverride: opts?.codigoOverride });
          const res = await listSaidas(params);
          let rows = filtrarSaidasPelaSubBaseDoUsuario(res.rows ?? [], currentUser?.sub_base);
          setResults((prev) => [...prev, ...rows]);
          setTotal(res.total ?? null);
          setHasMore(res.hasMore);
          setOffset(nextOffset);
          return;
        }

        if (!codigoTrim) {
          const params = buildParams({ offset: 0 });
          const res = await listSaidas(params);
          let rows = filtrarSaidasPelaSubBaseDoUsuario(res.rows ?? [], currentUser?.sub_base);
          setSearchMode("none");
          setSearchTruncated(false);
          setResults(rows);
          setNotFound(false);
          setTotal(res.total ?? null);
          setHasMore(res.hasMore);
          setOffset(0);
          return;
        }

        lastCodigoConsultaRef.current = codigoTrim;
        const cascade = await searchCodigosCascade(baseParams, codigoTrim, {
          forceExact: opts?.forceExact,
        });
        let rows = filtrarSaidasPelaSubBaseDoUsuario(cascade.rows ?? [], currentUser?.sub_base);

        if (cascade.mode === "exact" && cascade.rows.length === 1 && opts?.forceExact !== true) {
          const want = codigoTrim.toLowerCase();
          rows = rows.filter((r) => String(r.codigo || "").trim().toLowerCase() === want);
        }

        setSearchMode(cascade.mode);
        setSearchTruncated(cascade.truncated);
        setResults(rows);
        setNotFound(rows.length === 0 && Boolean(codigoTrim));
        if (rows.length === 0 && codigoTrim.length > 0 && codigoTrim.length < 4 && !opts?.forceExact) {
          setPartialHint("Digite pelo menos 4 caracteres para busca parcial.");
        }
        setTotal(cascade.total ?? rows.length);
        setHasMore(false);
        setOffset(0);

        void Haptics.notificationAsync(
          rows.length > 0
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        );
        if (rows.length > 0 && cascade.mode === "exact") {
          setTimeout(() => {
            lastRawLeituraRef.current = null;
            setSearchInput("");
          }, 400);
        }
      } catch {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Erro", "Falha ao buscar registros.");
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildParams, podeLerSaida, currentUser?.sub_base, searchInput, appliedStatus, appliedPeriod]
  );

  const handleVoiceNotice = useCallback((message: string) => {
    setVoiceBanner(message);
  }, []);

  const handleVoiceCancel = useCallback(() => {
    setVoiceVisible(false);
    setVoiceModalComp(null);
  }, []);

  const handleVoiceDone = useCallback(
    (text: string) => {
      setVoiceVisible(false);
      setVoiceModalComp(null);
      const t = text.replace(/\s+/g, " ").trim();
      if (t) {
        lastRawLeituraRef.current = null;
        setSearchInput(t);
        void executarBusca(0, { codigoOverride: t });
      }
    },
    [executarBusca]
  );

  const handleSearchInputChange = useCallback((value: string) => {
    lastRawLeituraRef.current = null;
    setSearchInput(value);
  }, []);

  const handleSubmitSearch = useCallback(() => {
    void executarBusca(0);
  }, [executarBusca]);

  const handleCarregarMais = useCallback(() => {
    if (buscaComCodigoExato || !hasMore || loadingMore) return;
    void executarBusca(offset + 50);
  }, [buscaComCodigoExato, hasMore, loadingMore, executarBusca, offset]);

  const carregarDetalhe = useCallback(async (idNum: number) => {
    setDetailLoading(true);
    setSelectedDetailId(idNum);
    setSelectedDetail(null);
    setSelectedHistorico([]);
    try {
      const [detail, historico] = await Promise.all([getSaidaDetail(idNum), getSaidaHistorico(idNum)]);
      setSelectedDetail(detail);
      setSelectedHistorico(historico);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro", "Falha ao carregar detalhes do registro.");
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleAbrirDetalhe = useCallback(
    async (item: SaidaListItem) => {
      const idNum = getIdSaidaFromItem(item);
      if (idNum == null) {
        Alert.alert("Indisponível", "Registro sem identificador (id_saida). Não é possível abrir o detalhe.");
        return;
      }
      setDetailVisible(true);
      await carregarDetalhe(idNum);
    },
    [carregarDetalhe]
  );

  const handleFecharDetalhe = useCallback(() => {
    setDetailVisible(false);
    setSelectedDetail(null);
    setSelectedHistorico([]);
    setSelectedDetailId(null);
  }, []);

  const fecharPreviewEtiqueta = useCallback(() => {
    setPreviewEtiquetaVisible(false);
  }, []);

  const handleGerarEtiqueta = useCallback(async () => {
    const codigo = String(selectedDetail?.codigo ?? "").trim();
    const idSaida = selectedDetailId ?? getIdSaidaFromDetail(selectedDetail);
    if (!podeGerarEtiqueta) {
      Alert.alert("Sem permissão", "Seu perfil não possui acesso para gerar etiqueta.");
      return;
    }
    if (!codigo) {
      Alert.alert("Código inválido", "Não foi possível identificar o código deste registro.");
      return;
    }
    setGerandoEtiqueta(true);
    try {
      const resp = await gerarEtiquetaArquivo({
        codigo,
        id_saida: idSaida ?? undefined,
        servico: (selectedDetail?.servico as string | null | undefined) ?? undefined,
        formato: "png",
      });
      const dir = FileSystem.cacheDirectory;
      if (!dir) throw new Error("cache-indisponivel");
      const safeCodigo = codigo.replace(/[^a-zA-Z0-9_-]/g, "_");
      const ext = resp.contentType.includes("png") ? "png" : "pdf";
      const path = `${dir}etiqueta_${safeCodigo}_${Date.now()}.${ext}`;
      await FileSystem.writeAsStringAsync(path, uint8ToBase64(resp.bytes), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (etiquetaUri && etiquetaUri !== path) {
        await FileSystem.deleteAsync(etiquetaUri, { idempotent: true });
      }
      setEtiquetaUri(path);
      setEtiquetaCodigo(codigo);
      setPreviewEtiquetaVisible(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro", formatApiError(err, "Não foi possível gerar a etiqueta."));
    } finally {
      setGerandoEtiqueta(false);
    }
  }, [etiquetaUri, podeGerarEtiqueta, selectedDetail, selectedDetailId]);

  const handleCompartilharEtiqueta = useCallback(async () => {
    if (!etiquetaUri) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert("Indisponível", "Compartilhamento não está disponível neste dispositivo.");
      return;
    }
    try {
      const isPng = etiquetaUri.toLowerCase().endsWith(".png");
      await Sharing.shareAsync(etiquetaUri, {
        mimeType: isPng ? "image/png" : "application/pdf",
        dialogTitle: etiquetaCodigo ? `Etiqueta ${etiquetaCodigo}` : "Etiqueta",
      });
    } catch (err) {
      Alert.alert("Erro", formatApiError(err, "Falha ao compartilhar a etiqueta."));
    }
  }, [etiquetaUri, etiquetaCodigo]);

  const performCancelarSaida = useCallback(async () => {
    if (!selectedDetailId) return;
    setCancelandoSaida(true);
    try {
      await updateSaidaAdmin(selectedDetailId, { status: "cancelado" });
      await carregarDetalhe(selectedDetailId);
      const codigoAtual = String(selectedDetail?.codigo ?? "").trim();
      await executarBusca(0, codigoAtual ? { codigoOverride: codigoAtual } : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sucesso", "Registro atualizado para cancelado.");
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
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Bloqueado", `Pedido com status final (${statusAtual}).`);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Erro", formatApiError(err, "Não foi possível cancelar este registro."));
      }
    } finally {
      setCancelandoSaida(false);
    }
  }, [carregarDetalhe, executarBusca, selectedDetail?.codigo, selectedDetailId]);

  const handleCancelarSaida = useCallback(() => {
    if (!podeCancelarSaida) {
      Alert.alert("Sem permissão", "Apenas admin pode cancelar um registro.");
      return;
    }
    if (!selectedDetailId) {
      Alert.alert("Indisponível", "Não foi possível identificar este registro.");
      return;
    }
    Alert.alert("Cancelar pacote", "Deseja alterar o status para cancelado?", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Confirmar",
        style: "destructive",
        onPress: () => {
          void performCancelarSaida();
        },
      },
    ]);
  }, [podeCancelarSaida, performCancelarSaida, selectedDetailId]);

  const parseLerError = (err: unknown) => {
    const ax = err as AxiosError<{
      code?: string;
      detail?: { code?: string } | string;
      data?: { id_saida?: number; entregador_atual?: string; username?: string };
      id_saida?: number;
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
    return { status, code, body };
  };

  const processarLer = useCallback(
    async (
      rawCodigo: string,
      opts?: { registrarNaoColetado?: boolean; motoboy?: { id: number; nome: string }; rawScan?: string }
    ) => {
      const rawPreferencial = String(opts?.rawScan ?? rawCodigo ?? "").trim();
      const rawFallback = String(rawCodigo ?? "").trim();
      let cls = classifyCodigoParaOperacao(rawPreferencial);
      if (!cls.ok && rawFallback && rawFallback !== rawPreferencial) {
        cls = classifyCodigoParaOperacao(rawFallback);
      }
      if (!cls.ok) {
        Alert.alert("Código inválido", cls.motivo);
        return;
      }
      const c = cls.codigo.trim();
      if (!c || !podeLerSaida) return;

      let mb = opts?.motoboy;
      if (!mb) {
        try {
          let list = motoboys;
          if (list.length === 0) {
            list = await listMotoboysOperacao();
            setMotoboys(list);
          }
          if (!list.length) {
            Alert.alert("Motoboy", "Não há entregadores disponíveis para registrar leitura.");
            return;
          }
          const id =
            motoboyId != null && list.some((m) => m.id_motoboy === motoboyId)
              ? motoboyId
              : list[0].id_motoboy;
          const nome = list.find((m) => m.id_motoboy === id)!.nome;
          mb = { id, nome };
        } catch {
          Alert.alert("Erro", "Não foi possível carregar entregadores.");
          return;
        }
      }

      setLerLoading(true);
      try {
        await lerSaidaAdmin({
          motoboy_id: mb.id,
          entregador: mb.nome,
          codigo: c,
          servico: cls.servico,
          registrar_nao_coletado: opts?.registrarNaoColetado,
          qr_payload_raw: cls.qr_payload_raw,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Sucesso", "Leitura registrada.");
        setPendingNaoColetado(null);
        void executarBusca(0, { codigoOverride: c });
      } catch (err) {
        const { status, code, body } = parseLerError(err);
        if (status === 409 && code === "TROCA_ENTREGADOR") {
          const b = body as {
            id_saida?: number;
            entregador_atual?: string;
            username?: string;
            data?: { id_saida?: number; entregador_atual?: string; username?: string };
          };
          const idSaida = b.id_saida ?? b.data?.id_saida ?? 0;
          const entregadorAtual = b.entregador_atual ?? b.data?.entregador_atual ?? "—";
          const usuarioRegistro = b.username ?? b.data?.username ?? "—";
          setConflito({
            codigo: c,
            idSaida,
            entregadorAtual,
            usuarioRegistro,
            novoEntregador: mb.nome,
            motoboyId: mb.id,
          });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
        if (status === 422 && code === "NAO_COLETADO") {
          setPendingNaoColetado({
            codigo: c,
            rawScan: opts?.rawScan && opts.rawScan.trim() ? opts.rawScan.trim() : undefined,
          });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Erro", formatApiError(err, "Falha ao registrar leitura."));
      } finally {
        setLerLoading(false);
      }
    },
    [motoboys, motoboyId, podeLerSaida, executarBusca]
  );

  const handleConfirmarTroca = useCallback(async () => {
    if (!conflito) return;
    setConfirmandoTroca(true);
    try {
      await updateSaidaAdmin(conflito.idSaida, {
        status: "Saiu para entrega",
        motoboy_id: conflito.motoboyId,
        entregador: conflito.novoEntregador,
      });
      setConflito(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void executarBusca(0, { codigoOverride: conflito.codigo });
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
        setConflito(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Bloqueado", `Pedido com status final (${statusAtual}).`);
      } else {
        Alert.alert("Erro", formatApiError(err, "Erro ao trocar entregador."));
      }
    } finally {
      setConfirmandoTroca(false);
    }
  }, [conflito, executarBusca]);

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult | { nativeEvent: BarcodeScanningResult }) => {
      if (loading || lerLoading) return;
      const result = "nativeEvent" in event ? event.nativeEvent : event;
      const data = result?.data ?? "";
      if (!data) return;
      const rawScan = data.trim();
      if (!rawScan) return;
      const now = Date.now();
      if (now - lastScanRef.current < SCAN_DEBOUNCE_MS) return;
      lastScanRef.current = now;
      const parsed = parseCodigoQrRaw(rawScan);
      const t = parsed.codigo.trim();
      if (!t) return;
      setCameraAtiva(false);
      lastRawLeituraRef.current = rawScan;
      setSearchInput(t);
      void executarBusca(0, { codigoOverride: t, forceExact: true });
    },
    [loading, lerLoading, executarBusca]
  );

  const openCamera = useCallback(async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    setCameraAtiva(true);
  }, [permission, requestPermission]);

  const openVoice = useCallback(async () => {
    if (!mostrarVozConsulta) return;
    try {
      const mod = await import("../components/VoiceConsultaModal");
      setVoiceModalComp(() => mod.default);
      setVoiceVisible(true);
    } catch (err) {
      console.error("[ConsultaCodigosScreen] failed to load VoiceConsultaModal", err);
      setVoiceBanner(
        "Reconhecimento de voz não está disponível neste build. Use texto ou câmera. Em desenvolvimento, use um dev build com o módulo nativo (no Expo Go costuma faltar)."
      );
    }
  }, [mostrarVozConsulta]);

  const openRegistrarLeitura = useCallback(async () => {
    try {
      const list = await listMotoboysOperacao();
      setMotoboys(list);
      if (!list.length) {
        Alert.alert("Motoboy", "Não há entregadores disponíveis para registrar.");
        return;
      }
      setMotoboyId(list[0].id_motoboy);
      setMotoboyNome(list[0].nome);
      setRegistrarLeituraVisible(true);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar entregadores.");
    }
  }, []);

  const confirmRegistrarLeitura = useCallback(() => {
    const m = motoboys.find((x) => x.id_motoboy === motoboyId);
    if (!m) return;
    setRegistrarLeituraVisible(false);
    void processarLer(searchInput, {
      motoboy: { id: m.id_motoboy, nome: m.nome },
      rawScan: lastRawLeituraRef.current ?? undefined,
    });
  }, [motoboys, motoboyId, searchInput, processarLer]);

  const primeiro = results[0];
  const multiResultados = results.length > 1 || (searchMode !== "exact" && results.length > 0);
  const restantes = multiResultados ? results : results.length > 1 ? results.slice(1) : [];
  const VoiceModalResolved = voiceModalComp;

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeaderBar
          title="Consulta de códigos"
          onBack={() => navigation.goBack()}
          paddingTop={Math.max(12, insets.top)}
          rightElement={
            <OperacaoFilterButton
              activeCount={filterActiveCount}
              onPress={() => {
                setDraftStatus(appliedStatus);
                setDraftPeriod(appliedPeriod);
                setFilterSheetVisible(true);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            />
          }
        />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: 48 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            {mostrarVozConsulta
              ? "Digite ou escaneie o código e confirme. Toque no microfone para ditar."
              : "Digite ou escaneie o código e confirme."}
          </Text>

          {mostrarVozConsulta && voiceBanner ? (
            <View style={styles.voiceBanner}>
              <Text style={styles.voiceBannerText}>{voiceBanner}</Text>
              <TouchableOpacity
                onPress={() => setVoiceBanner(null)}
                accessibilityLabel="Fechar aviso de voz"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Código da saída"
              placeholderTextColor={colors.placeholder}
              value={searchInput}
              onChangeText={handleSearchInputChange}
              onSubmitEditing={handleSubmitSearch}
              returnKeyType="search"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
            />
            <TouchableOpacity style={styles.iconBtn} onPress={openCamera} accessibilityLabel="Escanear">
              <Ionicons name="camera-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
            {mostrarVozConsulta ? (
              <TouchableOpacity style={styles.iconBtn} onPress={openVoice} accessibilityLabel="Voz">
                <Ionicons name="mic-outline" size={26} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {loading && results.length === 0 ? (
            <>
              <View style={styles.skeleton} />
              <View style={[styles.skeleton, { width: "92%" }]} />
            </>
          ) : null}

          {partialHint ? (
            <OperacaoEmptyState message={partialHint} icon="information-circle-outline" />
          ) : null}

          {notFound ? (
            <View style={styles.notFoundBox}>
              <Text style={styles.notFoundTitle}>Nenhum código encontrado</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Nenhum código encontrado para este termo.
              </Text>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => {
                  lastRawLeituraRef.current = null;
                  setSearchInput("");
                  setPartialHint(null);
                }}
              >
                <Text style={styles.btnTextPrimary}>Tentar novamente</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => void openRegistrarLeitura()}
                disabled={lerLoading || !searchInput.trim()}
              >
                <Text style={styles.btnOutlineText}>Registrar leitura (tentar bip)</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {primeiro && !notFound && !multiResultados ? (
            <ConsultaCodigoCard item={primeiro} onPress={() => handleAbrirDetalhe(primeiro)} />
          ) : null}

          {multiResultados && !notFound ? (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsHeaderText}>
                  Encontrados {results.length} códigos
                </Text>
              </View>
              {searchTruncated ? (
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
                  Mostrando os 20 primeiros resultados
                </Text>
              ) : null}
              {results.map((r) => {
                const kid = getIdSaidaFromItem(r) ?? r.codigo;
                return (
                  <ConsultaCodigoCard
                    key={String(kid)}
                    item={r}
                    compact
                    onPress={() => handleAbrirDetalhe(r)}
                  />
                );
              })}
            </>
          ) : null}

          {restantes.length > 0 && !multiResultados ? (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsHeaderText}>Mais resultados</Text>
                <Text style={styles.resultsHeaderText}>{restantes.length}</Text>
              </View>
              {restantes.map((r) => {
                const kid = getIdSaidaFromItem(r) ?? r.codigo;
                return (
                  <ConsultaCodigoCard
                    key={String(kid)}
                    item={r}
                    compact
                    onPress={() => handleAbrirDetalhe(r)}
                  />
                );
              })}
            </>
          ) : null}

          {total != null && results.length > 0 && !buscaComCodigoExato ? (
            <Text style={[styles.resultsHeaderText, { marginTop: 8 }]}>
              Total aproximado: {total}
            </Text>
          ) : null}

          {hasMore && !buscaComCodigoExato ? (
            <View style={styles.loadMoreBtn}>
              <TouchableOpacity onPress={handleCarregarMais} disabled={loadingMore}>
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Carregar mais</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      </View>

      {loading && results.length > 0 ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}

      <Modal visible={cameraAtiva} animationType="slide" onRequestClose={() => setCameraAtiva(false)}>
        <View style={styles.cameraModalOverlay}>
          <View style={styles.cameraHeader}>
            <Pressable onPress={() => setCameraAtiva(false)}>
              <Text style={styles.cameraBackText}>← Voltar</Text>
            </Pressable>
            <Text style={styles.cameraTitle}>Escanear QR</Text>
            <Text style={styles.cameraSubtitle}>Centralize o QR na moldura.</Text>
          </View>
          {!permission ? (
            <View
              style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center" }]}
            >
              <Text style={styles.permissionText}>Carregando permissões da câmera…</Text>
            </View>
          ) : !permission.granted ? (
            <View
              style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center", padding: 24 }]}
            >
              <Text style={styles.permissionText}>Precisamos de acesso à câmera para ler o QR.</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => void requestPermission()}>
                <Text style={styles.btnTextPrimary}>Permitir câmera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: CONSULTA_BARCODE_TYPES }}
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
            </>
          )}
        </View>
      </Modal>

      {mostrarVozConsulta && voiceVisible && VoiceModalResolved ? (
        <VoiceModalResolved
          visible
          onDone={handleVoiceDone}
          onCancel={handleVoiceCancel}
          onVoiceNotice={handleVoiceNotice}
          overlayBg="rgba(0,0,0,0.45)"
          cardBg={colors.backgroundCard}
          textColor={colors.text}
          secondaryColor={colors.textSecondary}
        />
      ) : null}

      <Modal
        visible={registrarLeituraVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRegistrarLeituraVisible(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailCard, { maxHeight: "85%" }]}>
            <Text style={styles.detailTitle}>Registrar leitura (bip)</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 12 }}>
              Escolha o entregador para vincular a esta leitura. Só é necessário ao registrar o bip, não para
              consultar.
            </Text>
            <View style={styles.chipScroll}>
              {motoboys.map((m) => {
                const sel = motoboyId === m.id_motoboy;
                return (
                  <TouchableOpacity
                    key={m.id_motoboy}
                    style={[styles.chip, sel && styles.chipSelected]}
                    onPress={() => {
                      setMotoboyId(m.id_motoboy);
                      setMotoboyNome(m.nome);
                    }}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{m.nome}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 16 }]}
              onPress={confirmRegistrarLeitura}
              disabled={lerLoading || motoboys.length === 0}
            >
              {lerLoading ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={styles.btnTextPrimary}>Confirmar leitura</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => setRegistrarLeituraVisible(false)}
              disabled={lerLoading}
            >
              <Text style={styles.btnOutlineText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={filterSheetVisible} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setFilterSheetVisible(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Filtros</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>Status</Text>
            <View style={styles.pillRow}>
              {(
                [
                  { key: "" as const, label: "Todos" },
                  { key: "Saiu para entrega" as const, label: "Em rota" },
                  { key: "Entregue" as const, label: "Entregue" },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key || "all"}
                  style={[styles.pill, draftStatus === opt.key && styles.pillActive]}
                  onPress={() => setDraftStatus(opt.key)}
                >
                  <Text style={[styles.pillText, draftStatus === opt.key && styles.pillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>Período</Text>
            <View style={styles.pillRow}>
              {(
                [
                  { key: "none" as const, label: "Qualquer" },
                  { key: "today" as const, label: "Hoje" },
                  { key: "7d" as const, label: "Últimos 7 dias" },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.pill, draftPeriod === opt.key && styles.pillActive]}
                  onPress={() => setDraftPeriod(opt.key)}
                >
                  <Text style={[styles.pillText, draftPeriod === opt.key && styles.pillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.sheetBtnSecondary}
                onPress={() => {
                  setDraftStatus("");
                  setDraftPeriod("none");
                }}
              >
                <Text style={{ fontWeight: "600", color: colors.text }}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={() => {
                  setAppliedStatus(draftStatus);
                  setAppliedPeriod(draftPeriod);
                  setFilterSheetVisible(false);
                  void executarBusca(0);
                }}
              >
                <Text style={styles.btnTextPrimary}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConsultaPacoteDetailModal
        visible={detailVisible}
        loading={detailLoading}
        detail={selectedDetail}
        historico={selectedHistorico}
        idSaida={selectedDetailId}
        podeGerarEtiqueta={podeGerarEtiqueta}
        podeCancelarSaida={podeCancelarSaida}
        gerandoEtiqueta={gerandoEtiqueta}
        cancelandoSaida={cancelandoSaida}
        onClose={handleFecharDetalhe}
        onGerarEtiqueta={() => void handleGerarEtiqueta()}
        onCancelarSaida={handleCancelarSaida}
      />

      <Modal
        visible={previewEtiquetaVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharPreviewEtiqueta}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>
                Pré-visualização da etiqueta{etiquetaCodigo ? ` · ${etiquetaCodigo}` : ""}
              </Text>
              <TouchableOpacity onPress={fecharPreviewEtiqueta} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {etiquetaUri ? (
              <Image source={{ uri: etiquetaUri }} style={{ flex: 1 }} resizeMode="contain" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.textSecondary }}>Arquivo não disponível.</Text>
              </View>
            )}
            <View style={styles.previewFooter}>
              <TouchableOpacity style={[styles.detailActionBtn, styles.detailActionPrimary]} onPress={() => void handleCompartilharEtiqueta()}>
                <Text style={styles.detailActionText}>Compartilhar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!conflito} transparent animationType="fade" onRequestClose={() => setConflito(null)}>
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailCard, { maxHeight: "80%" }]}>
            <Text style={styles.detailTitle}>Código já vinculado a outro entregador</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, marginVertical: 10 }}>
              Entregador atual: <Text style={{ fontWeight: "700", color: colors.text }}>{conflito?.entregadorAtual}</Text>
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.sheetBtnSecondary, { flex: 1 }]}
                onPress={() => setConflito(null)}
                disabled={confirmandoTroca}
              >
                <Text style={{ fontWeight: "600" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={handleConfirmarTroca}
                disabled={confirmandoTroca}
              >
                {confirmandoTroca ? (
                  <ActivityIndicator color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.btnTextPrimary}>Trocar entregador</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingNaoColetado != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingNaoColetado(null)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailCard, { maxHeight: "70%" }]}>
            <Text style={styles.detailTitle}>Código ainda não coletado</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, marginVertical: 10 }}>
              Deseja registrar mesmo assim?
            </Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                const pending = pendingNaoColetado;
                setPendingNaoColetado(null);
                if (pending?.codigo) {
                  void processarLer(pending.codigo, {
                    registrarNaoColetado: true,
                    rawScan: pending.rawScan,
                  });
                }
              }}
            >
              <Text style={styles.btnTextPrimary}>Registrar mesmo assim</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => setPendingNaoColetado(null)}
            >
              <Text style={styles.btnOutlineText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
