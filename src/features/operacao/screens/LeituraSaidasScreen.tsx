import React, { useCallback, useMemo, useRef, useState } from "react";
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
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import type { AxiosError } from "axios";
import { useThemeColors } from "../../../theme/colors";
import { useAuthStore } from "../../../store/authStore";
import { playSound } from "../../../utils/sound";
import { formatApiError } from "../../../utils/formatApiError";
import { lerSaidaAdmin, listMotoboysOperacao, updateSaidaAdmin, type MotoboyItem } from "../saidasApi";

const FRAME_SIZE = Math.min(Dimensions.get("window").width, Dimensions.get("window").height) * 0.65;
const CORNER_LENGTH = 40;
const CORNER_THICKNESS = 5;
const CORNER_COLOR = "#00bfff";

type StatusLeituraSaida = "sucesso" | "nao_coletado" | "erro" | "alterado";

interface LeituraSaidaItem {
  codigo: string;
  servico?: string | null;
  entregador: string;
  status: StatusLeituraSaida;
}

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

export default function LeituraSaidasScreen() {
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
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);
  const scanLocked = useRef(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 24, paddingBottom: 48 },
        title: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 12 },
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
        btnTextPrimary: { color: colors.primaryContrast, fontSize: 15, fontWeight: "600" },
        btnTextSecondary: { color: colors.text, fontSize: 15, fontWeight: "500" },
        row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
        listaContainer: {
          marginTop: 16,
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
        listaSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        statusBadge: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
        },
        statusText: { fontSize: 11, fontWeight: "600" },
        statusSucesso: { backgroundColor: "rgba(25,135,84,0.15)" },
        statusSucessoText: { color: "#198754" },
        statusAlterado: { backgroundColor: "rgba(13,110,253,0.15)" },
        statusAlteradoText: { color: "#0d6efd" },
        statusNaoColetado: { backgroundColor: "rgba(255,193,7,0.15)" },
        statusNaoColetadoText: { color: "#856404" },
        statusErro: { backgroundColor: "rgba(220,53,69,0.15)" },
        statusErroText: { color: "#dc3545" },
        resumoLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 8, textAlign: "right" },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.4)",
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
        modalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        },
        modalCard: {
          width: "100%",
          borderRadius: 12,
          padding: 20,
          backgroundColor: colors.backgroundCard,
        },
        modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        modalText: { fontSize: 15, color: colors.textSecondary, marginBottom: 16 },
        modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
        modalBtnCancel: { paddingHorizontal: 16, paddingVertical: 10 },
        modalBtnCancelText: { fontSize: 15, color: colors.textSecondary },
        modalBtnPrimary: {
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: colors.primary,
        },
        modalBtnPrimaryText: { fontSize: 15, fontWeight: "600", color: colors.primaryContrast },
      }),
    [colors, insets.bottom, insets.top]
  );

  const podeLerSaida = Boolean(currentUser?.pode_ler_saida);
  const username = currentUser?.username ?? "";

  const totalSucesso = leituras.filter((l) => l.status === "sucesso").length;
  const totalAlterado = leituras.filter((l) => l.status === "alterado").length;
  const totalNaoColetado = leituras.filter((l) => l.status === "nao_coletado").length;

  const carregarMotoboys = useCallback(async () => {
    setCarregandoMotoboys(true);
    try {
      const data = await listMotoboysOperacao();
      setMotoboys(data);
      if (data.length && motoboyId == null) {
        setMotoboyId(data[0].id_motoboy);
        setMotoboyNome(data[0].nome);
      }
    } catch (err) {
      Alert.alert("Erro", "Falha ao carregar lista de motoboys.");
    } finally {
      setCarregandoMotoboys(false);
    }
  }, [motoboyId]);

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
      if (!podeLerSaida) {
        Alert.alert("Sem permissão", "Seu usuário não possui permissão para leitura de saídas.");
        return;
      }
      if (!motoboyId || !motoboyNome) {
        Alert.alert("Motoboy obrigatório", "Selecione um motoboy antes de ler os códigos.");
        return;
      }

      const c = String(raw || "").trim();
      if (!c || scanLocked.current) return;
      if (isRecentlyScanned(c)) return;
      markScanned(c);
      scanLocked.current = true;

      if (leituras.some((l) => l.codigo === c && l.status !== "erro")) {
        scanLocked.current = false;
        playSound("warn");
        Alert.alert("Duplicado", "Este código já foi lido nesta sessão.");
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
        });

        const servico = res?.servico ?? null;
        const statusBackend = res?.status ?? "Saiu para entrega";
        const item: LeituraSaidaItem = {
          codigo: c,
          servico,
          entregador: motoboyNome,
          status: statusBackend === "Não Coletado" ? "nao_coletado" : "sucesso",
        };

        setLeituras((prev) => [...prev, item]);
        if (item.status === "nao_coletado") {
          playSound("warn");
        } else {
          playSound("success");
        }
      } catch (err) {
        const ax = err as AxiosError<{
          code?: string;
          detail?: { code?: string; [key: string]: unknown } | string;
          id_saida?: number;
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
          return;
        }

        if (status === 422 && code === "NAO_COLETADO") {
          setLeituras((prev) => [
            ...prev,
            {
              codigo: c,
              servico: null,
              entregador: motoboyNome,
              status: "nao_coletado",
            },
          ]);
          playSound("warn");
          Alert.alert("Código não coletado", "Este código ainda não foi coletado.");
        } else {
          setLeituras((prev) => [
            ...prev,
            { codigo: c, servico: null, entregador: motoboyNome, status: "erro" },
          ]);
          playSound("error");
          Alert.alert("Erro ao enviar", formatApiError(err, "Falha ao registrar a saída."));
        }
      } finally {
        setLoading(false);
        setTimeout(() => {
          scanLocked.current = false;
        }, 400);
      }
    },
    [leituras, motoboyId, motoboyNome, podeLerSaida]
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

  const handleSelecionarMotoboy = useCallback(
    (item: MotoboyItem) => {
      setMotoboyId(item.id_motoboy);
      setMotoboyNome(item.nome);
    },
    []
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
      setLeituras((prev) => [
        ...prev,
        {
          codigo: conflito.codigo,
          servico: null,
          entregador: conflito.novoEntregador,
          status: "alterado",
        },
      ]);
      playSound("success");
      setConflito(null);
    } catch (err) {
      playSound("error");
      Alert.alert("Erro", formatApiError(err, "Erro ao alterar entregador."));
    } finally {
      setConfirmandoTroca(false);
      scanLocked.current = false;
    }
  }, [conflito]);

  const handleCancelarTroca = useCallback(() => {
    setConflito(null);
    scanLocked.current = false;
  }, []);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(24, insets.top) }]}
      >
        <Text style={styles.title}>Leitura de Saídas</Text>
        <Text style={styles.description}>
          Leitura administrativa de saídas para acompanhar códigos, entregadores e tratar conflitos de motoboy
          (TROCA_ENTREGADOR), espelhando o fluxo do painel web.
        </Text>

        <View style={styles.badgeRow}>
          {username ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Usuário: {username}</Text>
            </View>
          ) : null}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              Permissão de leitura de saídas: {podeLerSaida ? "Ativa" : "Desativada"}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Motoboy / Entregador alvo</Text>
          <Text style={styles.infoText}>
            Selecione o motoboy para o qual as saídas serão registradas. Cada leitura chama diretamente o endpoint
            `/saidas/ler` com esse entregador.
          </Text>
          <View style={{ marginTop: 16 }}>
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={carregarMotoboys}
                disabled={carregandoMotoboys}
              >
                {carregandoMotoboys ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.btnTextSecondary}>
                    {motoboys.length ? "Recarregar motoboys" : "Carregar motoboys"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {motoboys.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {motoboys.map((m) => {
                    const selected = motoboyId === m.id_motoboy;
                    return (
                      <TouchableOpacity
                        key={m.id_motoboy}
                        style={[
                          styles.badge,
                          {
                            borderWidth: selected ? 1 : 0,
                            borderColor: selected ? colors.primary : "transparent",
                          },
                        ]}
                        onPress={() => handleSelecionarMotoboy(m)}
                      >
                        <Text style={styles.badgeText}>{m.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            {motoboyNome ? (
              <Text style={[styles.infoText, { marginTop: 8 }]}>
                Motoboy selecionado: <Text style={{ fontWeight: "600", color: colors.text }}>{motoboyNome}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Código (escaneie ou digite)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Código da saída"
              placeholderTextColor={colors.placeholder}
              value={codigoInput}
              onChangeText={setCodigoInput}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleRegistrarManual}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnTextPrimary}>Registrar</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={ensurePermissionAndOpenCamera}
              disabled={loading || !podeLerSaida}
            >
              <Text style={styles.btnTextSecondary}>Abrir câmera</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.resumoLabel}>
          Lidos nesta sessão: {totalSucesso} sucesso(s), {totalAlterado} troca(s) de entregador,{" "}
          {totalNaoColetado} não coletado(s)
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
                  let statusStyle = styles.statusSucesso;
                  let statusTextStyle = styles.statusSucessoText;
                  let statusLabel = "Saiu para entrega";
                  if (l.status === "alterado") {
                    statusStyle = styles.statusAlterado;
                    statusTextStyle = styles.statusAlteradoText;
                    statusLabel = "Entregador alterado";
                  } else if (l.status === "nao_coletado") {
                    statusStyle = styles.statusNaoColetado;
                    statusTextStyle = styles.statusNaoColetadoText;
                    statusLabel = "Não coletado";
                  } else if (l.status === "erro") {
                    statusStyle = styles.statusErro;
                    statusTextStyle = styles.statusErroText;
                    statusLabel = "Erro";
                  }
                  return (
                    <View key={`${l.codigo}-${l.entregador}-${l.status}`} style={styles.listaItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listaCodigo}>{l.codigo}</Text>
                        <Text style={styles.listaSubtitle}>
                          Entregador: {l.entregador}
                          {l.servico ? ` • ${l.servico}` : ""}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, statusStyle]}>
                        <Text style={[styles.statusText, statusTextStyle]}>{statusLabel}</Text>
                      </View>
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.loadingText}>Enviando leitura...</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={cameraAtiva} animationType="slide" onRequestClose={() => setCameraAtiva(false)}>
        <View style={styles.cameraModalOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setCameraAtiva(false)}>
              <Text style={styles.cameraBackText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Escanear código de saída</Text>
            <Text style={styles.cameraSubtitle}>
              Aponte para o código de barras ou QR. Cada leitura será enviada para o backend em tempo real.
            </Text>
          </View>

          {!permission ? (
            <View style={[styles.cameraModalOverlay, { justifyContent: "center", alignItems: "center" }]}>
              <Text style={styles.permissionText}>Carregando permissões da câmera...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={[styles.cameraModalOverlay, { justifyContent: "center", alignItems: "center" }]}>
              <Text style={styles.permissionText}>
                Precisamos de acesso à câmera para escanear os códigos de saída.
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
                <Text style={[styles.resumoLabel, { color: "#fff" }]}>
                  Leituras na sessão: {leituras.length}
                </Text>
              </View>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={!!conflito} transparent animationType="fade" onRequestClose={handleCancelarTroca}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Código já saiu com outro motoboy</Text>
            <Text style={styles.modalText}>
              O código{" "}
              <Text style={{ fontWeight: "700", color: colors.text }}>{conflito?.codigo ?? ""}</Text> já foi
              registrado como <Text style={{ fontWeight: "700" }}>Saiu para entrega</Text>.
            </Text>
            <Text style={styles.modalText}>
              Registrado por:{" "}
              <Text style={{ fontWeight: "600", color: colors.text }}>
                {conflito?.usuarioRegistro ?? "Desconhecido"}
              </Text>
              {"\n"}
              Entregador atual:{" "}
              <Text style={{ fontWeight: "600", color: colors.text }}>
                {conflito?.entregadorAtual ?? "Desconhecido"}
              </Text>
              {"\n"}
              Novo entregador desejado:{" "}
              <Text style={{ fontWeight: "600", color: colors.text }}>
                {conflito?.novoEntregador ?? "—"}
              </Text>
            </Text>
            <Text style={styles.modalText}>Deseja alterar o entregador para o motoboy selecionado?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={handleCancelarTroca}
                disabled={confirmandoTroca}
              >
                <Text style={styles.modalBtnCancelText}>Não</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={handleConfirmarTroca}
                disabled={confirmandoTroca}
              >
                {confirmandoTroca ? (
                  <ActivityIndicator size="small" color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Sim, alterar entregador</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

