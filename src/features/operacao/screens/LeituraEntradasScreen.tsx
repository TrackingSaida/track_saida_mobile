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
  Pressable,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useAuthStore } from "../../../store/authStore";
import { effectiveEntradaObrigatoria, effectivePodeDigitarCodigoManual } from "../../../utils/role";
import { playSound } from "../../../utils/sound";
import { ScanFrameOverlay } from "../components/ScanFrameOverlay";
import { classifyCodigoParaOperacao, inferServicoSaida } from "../parseCodigoQr";
import {
  getEntradaResumoDia,
  lancarAvulsoEntrada,
  lerEntrada,
  mensagemErroEntrada,
  type EntradaResumoDia,
} from "../entradasApi";
import {
  AVULSO_IDENT_AJUDA,
  AVULSO_IDENT_MAX,
  AVULSO_QTD_MAX,
  validarLancamentoAvulso,
} from "../utils/avulsoLancamento";
import { useScannerTorch } from "../../entregas/hooks/useScannerTorch";
import ScannerTorchButton from "../../entregas/components/ScannerTorchButton";
import PhysicalScannerInput from "../components/PhysicalScannerInput";

type StatusLeitura = "sucesso" | "duplicado" | "erro";
type FeedbackTipo = StatusLeitura | "info";

interface LeituraEntradaItem {
  codigo: string;
  servico: string;
  status: StatusLeitura;
}

const SCAN_DEBOUNCE_MS = 1500;
const recentCodes = new Map<string, number>();
const RESUMO_DIA_VAZIO: EntradaResumoDia = {
  data_ref: "",
  total: 0,
  sum_shopee: 0,
  sum_mercado: 0,
  sum_avulso: 0,
};

function isRecentlyScanned(data: string): boolean {
  const key = String(data || "").trim();
  if (!key) return true;
  return Date.now() - (recentCodes.get(key) ?? 0) < SCAN_DEBOUNCE_MS;
}

function markScanned(data: string): void {
  const key = String(data || "").trim();
  if (key) recentCodes.set(key, Date.now());
}

function labelServicoUi(servico?: string | null, codigo?: string): string {
  const s = String(servico || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("mercado") || s === "ml" || s.includes("livre")) return "ML";
  if (s.includes("avulso")) return "Avulso";
  if (codigo) {
    const inferido = inferServicoSaida(codigo);
    if (inferido === "Mercado Livre") return "ML";
    return inferido;
  }
  return "Avulso";
}

function labelStatusUi(status: StatusLeitura): string {
  if (status === "sucesso") return "Entrada registrada";
  if (status === "duplicado") return "Já na base";
  return "Erro";
}

function coresFeedback(tipo: FeedbackTipo) {
  switch (tipo) {
    case "sucesso":
      return { bg: "rgba(25,135,84,0.12)", border: "rgba(25,135,84,0.35)", fg: "#198754" };
    case "duplicado":
      return { bg: "rgba(255,193,7,0.15)", border: "rgba(200,150,0,0.4)", fg: "#856404" };
    case "erro":
      return { bg: "rgba(220,53,69,0.12)", border: "rgba(220,53,69,0.35)", fg: "#dc3545" };
    default:
      return { bg: "rgba(13,110,253,0.12)", border: "rgba(13,110,253,0.35)", fg: "#0d6efd" };
  }
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
  const [modoManual, setModoManual] = useState(false);
  const [modoLeitorFisico, setModoLeitorFisico] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [leituras, setLeituras] = useState<LeituraEntradaItem[]>([]);
  const [feedback, setFeedback] = useState<{ tipo: FeedbackTipo; msg: string; codigo?: string } | null>(
    null
  );
  const [avulsoModalVisible, setAvulsoModalVisible] = useState(false);
  const [avulsoIdentificacao, setAvulsoIdentificacao] = useState("");
  const [avulsoQuantidade, setAvulsoQuantidade] = useState("1");
  const [resumoDia, setResumoDia] = useState<EntradaResumoDia>(RESUMO_DIA_VAZIO);
  const [resumoLoading, setResumoLoading] = useState(false);
  const scanLocked = useRef(false);
  const feedbackClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const torch = useScannerTorch(
    cameraOpen && !modoManual && !modoLeitorFisico && !!permission?.granted
  );

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
        totRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
        totBox: {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
          minHeight: 72,
          justifyContent: "center",
        },
        totNum: { fontSize: 24, fontWeight: "900" },
        totLbl: {
          fontSize: 11,
          fontWeight: "800",
          marginTop: 2,
          textTransform: "uppercase",
        },
        sessaoMeta: {
          fontSize: 13,
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: 12,
        },
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
        cameraHeaderRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },
        cameraBackText: { fontSize: 16, color: "#fff", fontWeight: "600" },
        cameraMeta: { flex: 1, alignItems: "flex-end" },
        cameraMetaLine: {
          fontSize: 13,
          color: "rgba(255,255,255,0.92)",
          fontWeight: "600",
          textAlign: "right",
        },
        cameraMetaMuted: {
          fontSize: 12,
          color: "rgba(255,255,255,0.75)",
          marginTop: 2,
          textAlign: "right",
        },
        cameraFooter: {
          position: "absolute",
          bottom: 0,
          left: 14,
          right: 14,
          zIndex: 12,
          paddingBottom: Math.max(20, insets.bottom + 6),
          gap: 8,
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
        btnAvulsoFooter: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
        },
        btnAvulsoFooterText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "600" },
        btnDisabled: { opacity: 0.7 },
        linkManualWhite: { paddingVertical: 10, alignItems: "center" },
        linkManualTextWhite: { fontSize: 15, color: "rgba(255,255,255,0.95)" },
        cameraFeedbackAbs: {
          position: "absolute",
          top: insets.top + 72,
          left: 14,
          right: 70,
          zIndex: 11,
        },
        cameraSending: {
          position: "absolute",
          top: "45%",
          alignSelf: "center",
          backgroundColor: "rgba(0,0,0,0.45)",
          padding: 12,
          borderRadius: 24,
          zIndex: 11,
        },
        modoManualWrap: {
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(24, insets.bottom + 12),
        },
        modoManualTitle: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 4 },
        modoManualSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },
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
        btnPrimary: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
        },
        btnTextPrimary: { color: colors.primaryContrast, fontWeight: "700", fontSize: 16 },
        linkManual: { marginTop: 16, alignItems: "center" },
        linkManualText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
        disabledBox: {
          padding: 16,
          borderRadius: 12,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.border,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: 24,
        },
        modalCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          padding: 18,
        },
        modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 8 },
        modalMessage: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
        modalHelp: { fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
        modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
        modalBtnCancel: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: colors.inputBackground,
        },
        modalBtnCancelText: { color: colors.textSecondary, fontWeight: "700" },
        modalBtnPrimary: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: colors.primary,
        },
        modalBtnPrimaryText: { color: colors.primaryContrast, fontWeight: "700" },
      }),
    [colors, insets.bottom, insets.top]
  );

  const totalOk = useMemo(
    () => leituras.filter((l) => l.status === "sucesso").length,
    [leituras]
  );

  const ultimaLeitura = leituras.length ? leituras[leituras.length - 1] : null;

  const loadResumoDia = useCallback(async () => {
    if (!habilitada) return;
    setResumoLoading(true);
    try {
      const data = await getEntradaResumoDia();
      setResumoDia(data);
    } catch {
      // Mantém último resumo conhecido.
    } finally {
      setResumoLoading(false);
    }
  }, [habilitada]);

  useFocusEffect(
    useCallback(() => {
      void loadResumoDia();
    }, [loadResumoDia])
  );

  const pushFeedback = useCallback((tipo: FeedbackTipo, msg: string, codigo?: string) => {
    if (feedbackClearRef.current) clearTimeout(feedbackClearRef.current);
    setFeedback({ tipo, msg, codigo });
    feedbackClearRef.current = setTimeout(() => setFeedback(null), 1200);
  }, []);

  const appendLeitura = useCallback((item: LeituraEntradaItem) => {
    setLeituras((prev) => [...prev, item]);
  }, []);

  const abrirCamera = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Câmera", "Permissão de câmera necessária.");
        return;
      }
    }
    setModoLeitorFisico(false);
    setModoManual(false);
    setCameraOpen(true);
  }, [permission?.granted, requestPermission]);

  const abrirLeitorFisico = useCallback(() => {
    setModoLeitorFisico(true);
    setModoManual(false);
    setCameraOpen(true);
  }, []);

  const processar = useCallback(
    async (raw: string, origem: "camera" | "manual" | "leitor") => {
      const rawStr = String(raw || "").trim();
      if (!rawStr || scanLocked.current) return;

      const classified = classifyCodigoParaOperacao(rawStr);
      if (!classified.ok || !classified.codigo) {
        playSound("error");
        pushFeedback("erro", !classified.ok ? classified.motivo : "Código inválido");
        appendLeitura({
          codigo: rawStr.slice(0, 40) || "—",
          servico: "Avulso",
          status: "erro",
        });
        return;
      }
      const c = classified.codigo.trim().toUpperCase();
      if (isRecentlyScanned(rawStr) || isRecentlyScanned(c)) {
        // Mesmo QR ainda no frame: não trava o scanner sequencial.
        return;
      }

      markScanned(rawStr);
      markScanned(c);
      scanLocked.current = true;
      if (origem === "manual") setCodigoManual("");
      setLoading(true);
      try {
        const res = await lerEntrada({
          codigo: classified.qr_payload_raw || classified.codigo,
          origem: origem === "leitor" ? "manual" : origem,
          qr_payload_raw: classified.qr_payload_raw,
        });
        const servico = labelServicoUi(res.servico, c);
        appendLeitura({ codigo: c, servico, status: "sucesso" });
        playSound("success");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        pushFeedback("sucesso", "Entrada registrada", c);
        void loadResumoDia();
      } catch (err) {
        const ax = err as { response?: { status?: number; data?: { code?: string } } };
        if (ax.response?.status === 409 || ax.response?.data?.code === "JA_NA_BASE") {
          playSound("warn");
          appendLeitura({
            codigo: c,
            servico: labelServicoUi(undefined, c),
            status: "duplicado",
          });
          pushFeedback("duplicado", "Já teve entrada na base", c);
        } else {
          playSound("error");
          appendLeitura({
            codigo: c,
            servico: labelServicoUi(undefined, c),
            status: "erro",
          });
          pushFeedback("erro", mensagemErroEntrada(err), c);
        }
      } finally {
        setLoading(false);
        setTimeout(() => {
          scanLocked.current = false;
        }, 400);
      }
    },
    [appendLeitura, loadResumoDia, pushFeedback]
  );

  const onBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (loading || scanLocked.current) return;
      const type = String(result?.type || "").toLowerCase();
      if (type && type !== "qr") return;
      const raw = String(result.data || "").trim();
      if (!raw) return;
      void processar(raw, "camera");
    },
    [loading, processar]
  );

  const handleLancarAvulso = useCallback(async () => {
    const validacao = validarLancamentoAvulso(avulsoIdentificacao, avulsoQuantidade);
    if (!validacao.ok) {
      pushFeedback("erro", validacao.message);
      return;
    }
    setLoading(true);
    try {
      const res = await lancarAvulsoEntrada({
        identificacao: validacao.identificacao,
        quantidade: validacao.quantidade,
      });
      const novos = (res.saidas ?? []).map((s) => ({
        codigo: String(s.codigo ?? ""),
        servico: labelServicoUi(s.servico, s.codigo),
        status: "sucesso" as const,
      }));
      if (novos.length) setLeituras((prev) => [...prev, ...novos]);
      pushFeedback("sucesso", res.mensagem || "Avulsos registrados na entrada.");
      setAvulsoModalVisible(false);
      setAvulsoIdentificacao("");
      setAvulsoQuantidade("1");
      setModoManual(false);
      void loadResumoDia();
      if (!cameraOpen) void abrirCamera();
    } catch (err) {
      pushFeedback("erro", mensagemErroEntrada(err));
    } finally {
      setLoading(false);
    }
  }, [
    abrirCamera,
    avulsoIdentificacao,
    avulsoQuantidade,
    cameraOpen,
    loadResumoDia,
    pushFeedback,
  ]);

  const renderFeedbackStrip = (variant: "main" | "camera") => {
    if (!feedback) return null;
    const c = coresFeedback(feedback.tipo);
    return (
      <View
        style={[
          styles.feedbackStrip,
          variant === "camera" ? styles.cameraFeedbackAbs : null,
          { backgroundColor: c.bg, borderColor: c.border },
        ]}
      >
        <Text style={[styles.feedbackTitulo, { color: c.fg }]}>{feedback.msg}</Text>
        {feedback.codigo ? (
          <Text style={[styles.feedbackCodigo, { color: c.fg }]}>{feedback.codigo}</Text>
        ) : null}
      </View>
    );
  };

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

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Registrar entrada" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={resumoLoading} onRefresh={() => void loadResumoDia()} />
        }
      >
        <Text style={styles.hint}>
          Bipe o pacote para registrar a entrada na base. Não é necessário informar seller.
        </Text>
        {renderFeedbackStrip("main")}

        <Text style={[styles.hint, { marginBottom: 8 }]}>Como deseja realizar as leituras?</Text>
        <View style={styles.scanChoiceRow}>
          <TouchableOpacity
            style={styles.scanChoice}
            onPress={() => void abrirCamera()}
            accessibilityLabel="Usar câmera para registrar entradas"
          >
            <Ionicons name="camera-outline" size={24} color={colors.primaryContrast} />
            <Text style={styles.cameraCtaText}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanChoice, styles.scanChoiceOutline]}
            onPress={abrirLeitorFisico}
            accessibilityLabel="Usar leitor físico para registrar entradas"
          >
            <Ionicons name="barcode-outline" size={24} color={colors.primary} />
            <Text style={styles.scanChoiceOutlineText}>Leitor físico</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resumoCard}>
          <Text style={styles.sessaoTitulo}>Hoje na base</Text>
          <Text style={styles.totalGigante}>{resumoDia.total}</Text>
          <Text style={styles.totalLegenda}>Entradas de todos os operadores</Text>
          <View style={styles.totRow}>
            {(
              [
                { label: "Shopee", value: resumoDia.sum_shopee, bg: "#dc2626", fg: "#fff" },
                { label: "ML", value: resumoDia.sum_mercado, bg: "#eab308", fg: "#1f2937" },
                { label: "Avulso", value: resumoDia.sum_avulso, bg: "#6b7280", fg: "#fff" },
              ] as const
            ).map((s) => (
              <View key={s.label} style={[styles.totBox, { backgroundColor: s.bg }]}>
                <Text style={[styles.totNum, { color: s.fg }]}>{s.value}</Text>
                <Text style={[styles.totLbl, { color: s.fg }]}>{s.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.sessaoMeta}>
            Nesta sessão: {totalOk} {totalOk === 1 ? "entrada" : "entradas"}
          </Text>
          <View style={styles.ultimaCard}>
            <Text style={styles.ultimaTitulo}>Última leitura (sua sessão)</Text>
            {ultimaLeitura ? (
              <>
                <Text style={styles.ultimaCodigo}>{ultimaLeitura.codigo}</Text>
                <Text style={[styles.ultimaStatus, { fontWeight: "600" }]}>
                  {labelStatusUi(ultimaLeitura.status)}
                  {ultimaLeitura.servico ? ` · ${ultimaLeitura.servico}` : ""}
                </Text>
              </>
            ) : (
              <Text style={styles.vazioText}>Aguardando primeira leitura</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        {modoManual ? (
          <View style={styles.modoManualWrap}>
            <TouchableOpacity onPress={() => setModoManual(false)}>
              <Text style={styles.linkManualText}>
                ← Voltar para {modoLeitorFisico ? "o leitor físico" : "a câmera"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.modoManualTitle}>Digitar código</Text>
            <Text style={styles.modoManualSubtitle}>Registra a entrada na base sem bipar.</Text>
            <TextInput
              style={styles.input}
              value={codigoManual}
              onChangeText={setCodigoManual}
              placeholder="Código do pacote"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              disabled={loading || !codigoManual.trim()}
              onPress={() => void processar(codigoManual, "manual")}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={styles.btnTextPrimary}>Registrar entrada</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnAvulsoFooter, { marginTop: 12 }, loading && styles.btnDisabled]}
              onPress={() => setAvulsoModalVisible(true)}
              disabled={loading}
            >
              <Text style={styles.btnAvulsoFooterText}>Lançar Avulso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkManual} onPress={() => setCameraOpen(false)}>
              <Text style={styles.linkManualText}>Fechar scanner</Text>
            </TouchableOpacity>
          </View>
        ) : modoLeitorFisico ? (
          <PhysicalScannerInput
            active={cameraOpen && modoLeitorFisico && !modoManual && !avulsoModalVisible}
            disabled={loading}
            title="Leitor físico de entradas"
            subtitle={`Entradas nesta sessão: ${totalOk}`}
            onClose={() => setCameraOpen(false)}
            onScan={(codigo) => processar(codigo, "leitor")}
          >
            {renderFeedbackStrip("main")}
            <TouchableOpacity
              style={[styles.btnAvulsoFooter, loading && styles.btnDisabled]}
              onPress={() => setAvulsoModalVisible(true)}
              disabled={loading}
            >
              <Text style={styles.btnAvulsoFooterText}>Lançar Avulso</Text>
            </TouchableOpacity>
            {podeManual ? (
              <TouchableOpacity
                style={styles.linkManual}
                onPress={() => setModoManual(true)}
                disabled={loading}
              >
                <Text style={styles.linkManualText}>Digitar código manualmente</Text>
              </TouchableOpacity>
            ) : null}
          </PhysicalScannerInput>
        ) : (
          <View style={styles.cameraModalOverlay}>
            <View style={styles.cameraHeader}>
              <View style={styles.cameraHeaderRow}>
                <Pressable onPress={() => setCameraOpen(false)} accessibilityLabel="Fechar câmera">
                  <Text style={styles.cameraBackText}>← Fechar</Text>
                </Pressable>
                <View style={styles.cameraMeta}>
                  <Text style={styles.cameraMetaLine}>Entrada na base</Text>
                  <Text style={styles.cameraMetaMuted}>Lidos: {totalOk}</Text>
                </View>
              </View>
            </View>

            {renderFeedbackStrip("camera")}

            {!permission?.granted ? (
              <View
                style={[
                  styles.cameraModalOverlay,
                  { justifyContent: "center", alignItems: "center", padding: 24 },
                ]}
              >
                <Text style={{ color: "#fff", marginBottom: 12, textAlign: "center" }}>
                  Permita o uso da câmera para escanear.
                </Text>
                <TouchableOpacity style={styles.btnPrimary} onPress={() => void requestPermission()}>
                  <Text style={styles.btnTextPrimary}>Permitir câmera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnAvulsoFooter, { marginTop: 12, alignSelf: "stretch" }]}
                  onPress={() => setAvulsoModalVisible(true)}
                  disabled={loading}
                >
                  <Text style={styles.btnAvulsoFooterText}>Lançar Avulso</Text>
                </TouchableOpacity>
                {podeManual ? (
                  <TouchableOpacity
                    style={styles.linkManualWhite}
                    onPress={() => setModoManual(true)}
                    disabled={loading}
                  >
                    <Text style={styles.linkManualTextWhite}>Digitar código manualmente</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  enableTorch={torch.enableTorch}
                  onCameraReady={torch.onCameraReady}
                  onBarcodeScanned={loading ? undefined : onBarcode}
                />
                <ScannerTorchButton
                  mode={torch.mode}
                  onPress={torch.cycleMode}
                  style={{ top: insets.top + 72, right: 16 }}
                />
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingBottom: 160,
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
                <View style={styles.cameraFooter}>
                  <View style={styles.cameraFooterBox} pointerEvents="none">
                    <Text style={styles.cameraFooterLabel}>Última leitura</Text>
                    {ultimaLeitura ? (
                      <>
                        <Text style={styles.cameraFooterCodigo}>{ultimaLeitura.codigo}</Text>
                        <Text style={styles.cameraFooterStatus}>
                          {labelStatusUi(ultimaLeitura.status)}
                          {ultimaLeitura.servico ? ` · ${ultimaLeitura.servico}` : ""}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.cameraFooterStatus}>Aguardando primeiro código…</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.btnAvulsoFooter, loading && styles.btnDisabled]}
                    onPress={() => setAvulsoModalVisible(true)}
                    disabled={loading}
                    accessibilityLabel="Lançar Avulso"
                  >
                    <Text style={styles.btnAvulsoFooterText}>Lançar Avulso</Text>
                  </TouchableOpacity>
                  {podeManual ? (
                    <TouchableOpacity
                      style={styles.linkManualWhite}
                      onPress={() => setModoManual(true)}
                      disabled={loading}
                    >
                      <Text style={styles.linkManualTextWhite}>Digitar código manualmente</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}
          </View>
        )}
      </Modal>

      <Modal
        visible={avulsoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvulsoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lançar Avulso</Text>
            <Text style={styles.modalMessage}>
              Cria pacote(s) avulso já com entrada na base. Identificação opcional.
            </Text>
            <Text style={styles.modalHelp}>{AVULSO_IDENT_AJUDA}</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Cliente João"
              placeholderTextColor={colors.textSecondary}
              value={avulsoIdentificacao}
              onChangeText={setAvulsoIdentificacao}
              autoCapitalize="words"
              maxLength={AVULSO_IDENT_MAX}
              editable={!loading}
            />
            <Text style={[styles.modalMessage, { marginTop: 4 }]}>
              Quantidade (máx. {AVULSO_QTD_MAX})
            </Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
              value={avulsoQuantidade}
              onChangeText={setAvulsoQuantidade}
              keyboardType="number-pad"
              maxLength={2}
              editable={!loading}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setAvulsoModalVisible(false)}
                disabled={loading}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={() => void handleLancarAvulso()}
                disabled={loading}
              >
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
    </View>
  );
}
