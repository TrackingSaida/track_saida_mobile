import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { useThemeColors } from "../../../theme/colors";
import { useAuthStore } from "../../../store/authStore";
import { effectivePodeLerSaida, isMotoboyRole } from "../../../utils/role";
import { formatApiError } from "../../../utils/formatApiError";
import {
  listSaidas,
  listMotoboysOperacao,
  lerSaidaAdmin,
  updateSaidaAdmin,
  type ListSaidasParams,
  type SaidaListItem,
  getSaidaDetail,
  getSaidaHistorico,
  type SaidaDetail,
  type SaidaHistoricoItem,
  type MotoboyItem,
} from "../saidasApi";
import { parseCodigoQrRaw, inferServicoSaida, classifyCodigoParaOperacao } from "../parseCodigoQr";

/** Consulta por câmera: apenas QR (moldura central), como na leitura de coleta. */
const CONSULTA_BARCODE_TYPES: import("expo-camera").BarcodeType[] = ["qr"];

const SCAN_DEBOUNCE_MS = 1200;

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
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

function formatarDataHoraUsuario(iso?: string | null): string {
  if (iso == null || String(iso).trim() === "") return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function coresBadgeServico(servico?: string | null): { bg: string; fg: string } {
  const s = (servico || "").trim().toLowerCase();
  if (s.includes("shopee")) return { bg: "rgba(238,77,45,0.15)", fg: "#ee4d2d" };
  if (s.includes("mercado") || s.includes("livre")) return { bg: "rgba(255,230,0,0.35)", fg: "#2d3277" };
  return { bg: "rgba(13,110,253,0.12)", fg: "#0d6efd" };
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  const [conflito, setConflito] = useState<ConflitoTroca | null>(null);
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);
  const [pendingNaoColetadoCodigo, setPendingNaoColetadoCodigo] = useState<string | null>(null);
  /** Última busca usou código com correspondência exata (consulta por código). */
  const [buscaComCodigoExato, setBuscaComCodigoExato] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            setDraftStatus(appliedStatus);
            setDraftPeriod(appliedPeriod);
            setFilterSheetVisible(true);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="options-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.primary, appliedStatus, appliedPeriod]);

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
        detailTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
        timelineStep: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 10 },
        timelineIcon: { marginTop: 2 },
        timelineText: { flex: 1 },
        timelineLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
        timelineSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        histLine: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
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
    async (nextOffset = 0, opts?: { codigoOverride?: string }) => {
      if (!podeLerSaida) {
        Alert.alert("Sem permissão", "Sem permissão para consultar saídas.");
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (nextOffset === 0) setLoading(true);
      else setLoadingMore(true);
      setNotFound(false);
      try {
        const params = buildParams({ offset: nextOffset, codigoOverride: opts?.codigoOverride });
        const codigoUsado = params.codigo?.trim() ?? "";
        setBuscaComCodigoExato(Boolean(params.codigoExato));
        if (codigoUsado) lastCodigoConsultaRef.current = codigoUsado;
        const res = await listSaidas(params);
        let rows = filtrarSaidasPelaSubBaseDoUsuario(res.rows ?? [], currentUser?.sub_base);
        if (params.codigoExato && params.codigo) {
          const want = params.codigo.trim().toLowerCase();
          rows = rows.filter((r) => (String(r.codigo || "").trim().toLowerCase() === want));
        }
        if (nextOffset === 0) {
          setResults(rows);
          setNotFound(rows.length === 0 && Boolean(codigoUsado));
          void Haptics.notificationAsync(
            rows.length > 0
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning
          );
          if (rows.length > 0) {
            setTimeout(() => setSearchInput(""), 400);
          }
        } else {
          setResults((prev) => [...prev, ...rows]);
        }
        setTotal(res.total ?? null);
        setHasMore(res.hasMore);
        setOffset(nextOffset);
      } catch {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Erro", "Falha ao buscar registros.");
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildParams, podeLerSaida, currentUser?.sub_base]
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
        setSearchInput(t);
        void executarBusca(0, { codigoOverride: t });
      }
    },
    [executarBusca]
  );

  const handleSubmitSearch = useCallback(() => {
    void executarBusca(0);
  }, [executarBusca]);

  const handleCarregarMais = useCallback(() => {
    if (buscaComCodigoExato || !hasMore || loadingMore) return;
    void executarBusca(offset + 50);
  }, [buscaComCodigoExato, hasMore, loadingMore, executarBusca, offset]);

  const handleAbrirDetalhe = useCallback(
    async (item: SaidaListItem) => {
      const idNum = getIdSaidaFromItem(item);
      if (idNum == null) {
        Alert.alert("Indisponível", "Registro sem identificador (id_saida). Não é possível abrir o detalhe.");
        return;
      }
      setDetailVisible(true);
      setDetailLoading(true);
      setSelectedDetail(null);
      setSelectedHistorico([]);
      try {
        const [detail, historico] = await Promise.all([
          getSaidaDetail(idNum),
          getSaidaHistorico(idNum),
        ]);
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
    },
    []
  );

  const handleFecharDetalhe = useCallback(() => {
    setDetailVisible(false);
    setSelectedDetail(null);
    setSelectedHistorico([]);
  }, []);

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
      opts?: { registrarNaoColetado?: boolean; motoboy?: { id: number; nome: string } }
    ) => {
      const cls = classifyCodigoParaOperacao(String(rawCodigo || ""));
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
        setPendingNaoColetadoCodigo(null);
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
          setPendingNaoColetadoCodigo(c);
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
      Alert.alert("Erro", formatApiError(err, "Erro ao trocar entregador."));
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
      const now = Date.now();
      if (now - lastScanRef.current < SCAN_DEBOUNCE_MS) return;
      lastScanRef.current = now;
      const parsed = parseCodigoQrRaw(data.trim());
      const t = parsed.codigo.trim();
      if (!t) return;
      setCameraAtiva(false);
      setSearchInput(t);
      void executarBusca(0, { codigoOverride: t });
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
    void processarLer(searchInput, { motoboy: { id: m.id_motoboy, nome: m.nome } });
  }, [motoboys, motoboyId, searchInput, processarLer]);

  const statusVisual = (s?: string | null) => {
    const u = (s || "").toLowerCase().replace(/\s+/g, "_");
    if (u.includes("entregue")) {
      return {
        label: s || "Entregue",
        bg: "rgba(25,135,84,0.15)",
        fg: "#198754",
      };
    }
    if (u.includes("rota") || u.includes("saiu") || u === "em_rota") {
      return {
        label: s || "Em rota",
        bg: "rgba(13,110,253,0.12)",
        fg: "#0d6efd",
      };
    }
    if (u.includes("nao_coletado") || u.includes("não_coletado") || u.includes("coletado") === false) {
      if (u.includes("nao") || u.includes("não")) {
        return { label: s || "Não coletado", bg: "rgba(108,117,125,0.2)", fg: "#6c757d" };
      }
    }
    if (u.includes("ausente") || u.includes("erro")) {
      return { label: s || "—", bg: "rgba(220,53,69,0.12)", fg: "#dc3545" };
    }
    return { label: s || "—", bg: "rgba(13,110,253,0.10)", fg: "#0d6efd" };
  };

  const timelineForDetail = (detail: SaidaDetail | null, historico: SaidaHistoricoItem[]) => {
    const st = (detail?.status || "").toLowerCase();
    const entregue = st.includes("entregue");
    const rota =
      st.includes("saiu") || st.includes("rota") || st.includes("em_rota") || st.includes("entrega");
    const naoColetado = st.includes("não coletado") || st.includes("nao coletado");

    return (
      <View style={{ marginTop: 12, marginBottom: 8 }}>
        <View style={styles.timelineStep}>
          <Ionicons
            style={styles.timelineIcon}
            name={!naoColetado ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={!naoColetado ? "#198754" : colors.textSecondary}
          />
          <View style={styles.timelineText}>
            <Text style={styles.timelineLabel}>Coletado</Text>
            <Text style={styles.timelineSub}>
              {naoColetado ? "Código ainda não coletado no fluxo." : "Pacote vinculado à operação."}
            </Text>
          </View>
        </View>
        <View style={styles.timelineStep}>
          <Ionicons
            name={rota || entregue ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={rota || entregue ? "#0d6efd" : colors.textSecondary}
          />
          <View style={styles.timelineText}>
            <Text style={styles.timelineLabel}>Em rota</Text>
            <Text style={styles.timelineSub}>Base: {detail?.base || "—"}</Text>
          </View>
        </View>
        <View style={styles.timelineStep}>
          <Ionicons
            name={entregue ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={entregue ? "#198754" : colors.textSecondary}
          />
          <View style={styles.timelineText}>
            <Text style={styles.timelineLabel}>Entregue</Text>
            <Text style={styles.timelineSub}>{formatarDataHoraUsuario(detail?.data_hora_entrega as string | undefined)}</Text>
          </View>
        </View>
        <Text style={[styles.timelineLabel, { marginTop: 12 }]}>Histórico</Text>
        {historico.length === 0 ? (
          <Text style={styles.histLine}>Sem histórico disponível.</Text>
        ) : (
          historico.map((h) => {
            const key = String(h.id ?? `${h.evento}-${h.timestamp}`);
            const quando = formatarDataHoraUsuario(h.timestamp as string | undefined);
            const quem = h.usuario_nome ? ` · ${h.usuario_nome}` : "";
            return (
              <Text key={key} style={[styles.histLine, { marginBottom: 10 }]}>
                <Text style={{ fontWeight: "600", color: colors.text }}>{h.evento || "Evento"}</Text>
                {"\n"}
                <Text style={{ color: colors.textSecondary }}>
                  {quando}
                  {quem}
                </Text>
              </Text>
            );
          })
        )}
      </View>
    );
  };

  const primeiro = results[0];
  const restantes = buscaComCodigoExato ? [] : results.slice(1);
  const VoiceModalResolved = voiceModalComp;

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(12, insets.top), paddingBottom: 48 + insets.bottom },
          ]}
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
              onChangeText={setSearchInput}
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

          {notFound ? (
            <View style={styles.notFoundBox}>
              <Text style={styles.notFoundTitle}>Código não encontrado</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Não há saída com esse código nos filtros atuais.
              </Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => setSearchInput("")}>
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

          {primeiro && !notFound ? (
            <TouchableOpacity
              style={styles.heroCard}
              activeOpacity={0.85}
              onPress={() => handleAbrirDetalhe(primeiro)}
            >
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                {buscaComCodigoExato ? "Código encontrado" : "Resultado principal"}
              </Text>
              <View style={styles.cardRowTop}>
                <Text style={styles.cardCodigo}>{primeiro.codigo || "—"}</Text>
                {(() => {
                  const sv = statusVisual(primeiro.status as string);
                  return (
                    <View style={[styles.metaPill, { backgroundColor: sv.bg }]}>
                      <Text style={[styles.metaPillText, { color: sv.fg, fontWeight: "700" }]}>
                        {sv.label}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <View style={styles.metaRow}>
                {primeiro.entregador ? (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>Entregador: {primeiro.entregador}</Text>
                  </View>
                ) : null}
                {primeiro.servico
                  ? (() => {
                      const sv = coresBadgeServico(primeiro.servico);
                      return (
                        <View style={[styles.servicoBadge, { backgroundColor: sv.bg }]}>
                          <Text style={[styles.servicoBadgeText, { color: sv.fg }]}>{primeiro.servico}</Text>
                        </View>
                      );
                    })()
                  : null}
              </View>
              <View style={styles.heroTapHint}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.heroTapHintText}>Toque no card para ver os detalhes do pedido.</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ) : null}

          {restantes.length > 0 ? (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsHeaderText}>Mais resultados</Text>
                <Text style={styles.resultsHeaderText}>{restantes.length}</Text>
              </View>
              {restantes.map((r) => {
                const sv = statusVisual(r.status as string);
                const kid = getIdSaidaFromItem(r) ?? r.codigo;
                return (
                  <TouchableOpacity
                    key={String(kid)}
                    style={styles.card}
                    activeOpacity={0.85}
                    onPress={() => handleAbrirDetalhe(r)}
                  >
                    <View style={styles.cardRowTop}>
                      <Text style={styles.cardCodigo}>{r.codigo || "—"}</Text>
                      <View style={[styles.metaPill, { backgroundColor: sv.bg }]}>
                        <Text style={[styles.metaPillText, { color: sv.fg, fontWeight: "700" }]}>
                          {sv.label}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.metaRow}>
                      {r.entregador ? (
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillText}>{r.entregador}</Text>
                        </View>
                      ) : null}
                      {r.servico
                        ? (() => {
                            const sv = coresBadgeServico(r.servico);
                            return (
                              <View style={[styles.servicoBadge, { backgroundColor: sv.bg }]}>
                                <Text style={[styles.servicoBadgeText, { color: sv.fg }]}>{r.servico}</Text>
                              </View>
                            );
                          })()
                        : null}
                    </View>
                  </TouchableOpacity>
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

      <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={handleFecharDetalhe}>
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailCard}>
            {detailLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView>
                <Text style={styles.detailTitle}>{selectedDetail?.codigo || "Detalhe"}</Text>
                <View style={{ marginBottom: 14, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Entregador</Text>
                  <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>
                    {selectedDetail?.entregador || "—"}
                  </Text>
                </View>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Serviço</Text>
                  {(() => {
                    const sv = coresBadgeServico(selectedDetail?.servico);
                    return (
                      <View
                        style={{
                          alignSelf: "flex-start",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: sv.bg,
                        }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: sv.fg }}>
                          {selectedDetail?.servico || "—"}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                {timelineForDetail(selectedDetail, selectedHistorico)}
              </ScrollView>
            )}
            <TouchableOpacity
              style={{ alignSelf: "flex-end", marginTop: 12, padding: 10 }}
              onPress={handleFecharDetalhe}
            >
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>Fechar</Text>
            </TouchableOpacity>
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
        visible={pendingNaoColetadoCodigo != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingNaoColetadoCodigo(null)}
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
                const c = pendingNaoColetadoCodigo;
                setPendingNaoColetadoCodigo(null);
                if (c) void processarLer(c, { registrarNaoColetado: true });
              }}
            >
              <Text style={styles.btnTextPrimary}>Registrar mesmo assim</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => setPendingNaoColetadoCodigo(null)}
            >
              <Text style={styles.btnOutlineText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
