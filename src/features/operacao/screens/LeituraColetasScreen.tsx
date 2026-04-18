import React, { useCallback, useMemo, useRef, useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useThemeColors } from "../../../theme/colors";
import { useAuthStore } from "../../../store/authStore";
import { effectivePodeLerColeta, isStaffOperacaoRole } from "../../../utils/role";
import { playSound } from "../../../utils/sound";
import { enviarColetaUnica, type ServicoColeta } from "../coletasApi";
import * as Haptics from "expo-haptics";
import { ScanFrameOverlay } from "../components/ScanFrameOverlay";
import { classifyCodigoParaOperacao, type ClassifyCodigoOperacaoResult } from "../parseCodigoQr";

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
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [permission, requestPermission] = useCameraPermissions();
  const [base, setBase] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [leituras, setLeituras] = useState<ColetaItemLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(true);
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
        filterHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        filterHeaderTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
        resumoRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 12,
          marginBottom: 8,
        },
        resumoBadge: {
          flex: 1,
          marginHorizontal: 4,
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: "center",
          backgroundColor: colors.backgroundCard,
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

  const processarLeitura = useCallback(
    async (raw: string, origem: "camera" | "manual") => {
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
        pushFeedback("info", "Informe a base antes de iniciar.");
        Alert.alert("Base obrigatória", "Informe a base para registrar as coletas.");
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
    [base, codigosLidosSessao, ignorarColeta, leituras, podeLerColeta, pushFeedback]
  );

  const handleRegistrarManual = useCallback(async () => {
    const c = codigoInput.trim();
    if (!c) {
      Alert.alert("Atenção", "Digite o código para registrar.");
      return;
    }
    await processarLeitura(c, "manual");
  }, [codigoInput, processarLeitura]);

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: 12 }]}
    >
      <Text style={styles.description}>
        Leia códigos Shopee, Mercado Livre ou avulsos; a base é obrigatória antes de registrar.
      </Text>

      {feedbackVisual && !cameraAtiva ? renderFeedbackStrip("main") : null}

      <View style={styles.badgeRow}>
        {subBase ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Base: {subBase}</Text>
          </View>
        ) : null}
        {!hideStaffBadges ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              Permissão de leitura de coletas: {podeLerColeta ? "Ativa" : "Desativada"}
            </Text>
          </View>
        ) : null}
        {ignorarColeta ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Coletas desativadas para este owner</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.infoCard}>
        <TouchableOpacity
          style={styles.filterHeader}
          onPress={() => setConfigExpanded((e) => !e)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterHeaderTitle}>Configuração da coleta</Text>
          <Ionicons
            name={configExpanded ? "chevron-up" : "chevron-down"}
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {configExpanded ? (
          <Text style={styles.infoText}>
            Informe a base, depois escaneie ou digite. O serviço é detectado automaticamente.
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: 16 }}>
        <Text style={styles.label}>Base</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: BASE-01"
          placeholderTextColor={colors.placeholder}
          value={base}
          onChangeText={setBase}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
        />
      </View>

      <View style={{ marginTop: 8 }}>
        <TouchableOpacity
          style={styles.cameraCta}
          onPress={ensurePermissionAndOpenCamera}
          disabled={loading || !podeLerColeta || ignorarColeta}
          activeOpacity={0.85}
        >
          <Text style={styles.cameraCtaText}>Abrir câmera</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Ou digite o código</Text>
        <TextInput
          style={styles.input}
          placeholder="BR... / código marketplace"
          placeholderTextColor={colors.placeholder}
          value={codigoInput}
          onChangeText={setCodigoInput}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
        />
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={handleRegistrarManual}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.btnTextOutline}>Registrar manualmente</Text>
          )}
        </TouchableOpacity>
      </View>

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
      <Text style={[styles.resumoLabel, { textAlign: "right" }]}>
        Total (sessão atual): {resumo.total}
      </Text>

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
              </View>
            </>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}
