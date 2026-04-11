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

type StatusLeitura = "pendente" | "enviado" | "duplicado" | "erro";

interface ColetaItemLocal {
  codigo: string;
  servico: ServicoColeta;
  status: StatusLeitura;
  qr_payload_raw?: string;
  is_grande?: boolean;
}

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

const SCAN_DEBOUNCE_MS = 1500;
const recentCodes = new Map<string, number>();

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

function toAsciiDigits(s: string): string {
  if (!s) return "";
  const sup: Record<string, string> = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
  };
  let out = String(s).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => sup[d] ?? d);
  out = out.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30)
  );
  return out;
}

function isCodigoShopee(codigo: string): boolean {
  if (!codigo || typeof codigo !== "string") return false;
  const c = String(codigo).toUpperCase().trim();
  return /^BR(\d{13}|\d{12}[A-Z])$/.test(c);
}

interface ClassifyResult {
  ok: boolean;
  servico?: ServicoColeta;
  codigo?: string;
  qr_payload_raw?: string;
  motivo?: string;
}

function classifyCodigo(rawInput: string): ClassifyResult {
  const rawInputStr = String(rawInput || "").trim();
  const raw = toAsciiDigits(rawInputStr).toUpperCase().trim();
  const allDigits = raw.replace(/\D+/g, "");

  try {
    if (rawInputStr.startsWith("{") && rawInputStr.trim().endsWith("}")) {
      const obj = JSON.parse(rawInputStr) as { id?: string; sender_id?: unknown; hash_code?: unknown };
      if (typeof obj.id === "string" && (obj.sender_id != null || obj.hash_code != null)) {
        const codigo = String(obj.id).trim();
        return { ok: true, servico: "Mercado Livre", codigo, qr_payload_raw: rawInputStr };
      }
    }
  } catch {
    // ignore
  }

  try {
    if (raw.startsWith("{") && raw.endsWith("}")) {
      const obj = JSON.parse(raw) as { external_order_id?: string };
      if (typeof obj.external_order_id === "string") {
        const codigo = obj.external_order_id.toUpperCase().trim();
        const servico: ServicoColeta = isCodigoShopee(codigo) ? "Shopee" : "Avulso";
        return { ok: true, servico, codigo };
      }
    }
  } catch {
    // ignore
  }

  const extMatch = raw.match(/external_order_id["']?\s*[:=]\s*["']?([\w-]+)/i);
  if (extMatch) {
    const codigo = extMatch[1].toUpperCase();
    const servico: ServicoColeta = isCodigoShopee(codigo) ? "Shopee" : "Avulso";
    return { ok: true, servico, codigo };
  }

  const magaluMatch = raw.match(/external_grouper_code\^Ç\^(\d{10,})\^/i);
  if (magaluMatch) {
    return { ok: true, servico: "Avulso", codigo: magaluMatch[1] };
  }

  if (/^LM[\w\d-]+$/i.test(raw)) {
    return { ok: true, servico: "Avulso", codigo: raw };
  }

  if (/^\d{44}$/.test(allDigits)) {
    return { ok: false, motivo: "NF-e (44 dígitos) não é aceita como código de coleta." };
  }

  const sh = raw.match(/(?:^|[^A-Z0-9])(BR(?:\d{13}|\d{12}[A-Z]))(?=$|[^A-Z0-9])/i);
  if (sh) {
    return { ok: true, servico: "Shopee", codigo: sh[1].toUpperCase() };
  }

  const mlRun = allDigits.match(/4[5-9]\d{9,}/);
  if (mlRun) {
    return {
      ok: true,
      servico: "Mercado Livre",
      codigo: mlRun[0].slice(0, 11),
      qr_payload_raw: rawInputStr,
    };
  }

  if (/^\d{8}$/.test(allDigits)) {
    return { ok: true, servico: "Avulso", codigo: allDigits };
  }

  if (/^\d{7}$/.test(allDigits)) {
    return { ok: true, servico: "Avulso", codigo: allDigits };
  }

  if (/^CP\d{3,}/.test(raw) || /^TIME\d{6}$/i.test(raw)) {
    return { ok: true, servico: "Avulso", codigo: raw };
  }

  const phone = raw.match(/0?(\d{2})[-\s]?(\d{4,5})[-\s]?(\d{4})/);
  if (phone) {
    const cod = `${phone[1]}${phone[2]}${phone[3]}`;
    return { ok: true, servico: "Avulso", codigo: cod };
  }

  return { ok: false, motivo: "Padrão de código não reconhecido para coleta." };
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
  const scanLocked = useRef(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 24, paddingBottom: 48 },
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
        Alert.alert("Sem permissão", "Seu usuário não possui permissão para leitura de coletas.");
        return;
      }
      if (ignorarColeta) {
        Alert.alert(
          "Coletas desativadas",
          "Este owner está configurado para não utilizar o fluxo de coletas."
        );
        return;
      }
      if (!baseTrimmed) {
        Alert.alert("Base obrigatória", "Informe a base para registrar as coletas.");
        return;
      }

      const c = String(raw || "").trim();
      if (!c || scanLocked.current) return;
      if (isRecentlyScanned(c)) return;
      markScanned(c);
      scanLocked.current = true;

      const classified = classifyCodigo(c);
      if (!classified.ok || !classified.codigo || !classified.servico) {
        scanLocked.current = false;
        playSound("warn");
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
        Alert.alert("Duplicado", "Este código já foi lido nesta sessão.");
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
          Alert.alert("Código já coletado", String(detail || "Este código já foi coletado."));
        } else {
          setLeituras((prev) =>
            prev.map((l) =>
              l.codigo === codigoNorm ? { ...l, status: "erro" } : l
            )
          );
          playSound("error");
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
    [base, ignorarColeta, leituras, podeLerColeta]
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
      const data = result?.data ?? "";
      if (data && !scanLocked.current && !isRecentlyScanned(data)) {
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
              Aponte para o código de barras ou QR. As leituras serão enviadas em tempo real.
            </Text>
          </View>

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
