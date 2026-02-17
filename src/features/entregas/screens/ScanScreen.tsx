import React, { useState, useRef, useCallback } from "react";
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
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { scanCodigo, assumirEntrega, desatribuirEntrega, getEntrega } from "../api";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

export interface LeituraSession {
  id_saida: number;
  codigo: string;
  servico: "Shopee" | "Flex" | "Avulso";
}

function classifyServico(serv?: string | null): "Shopee" | "Flex" | "Avulso" {
  const s = (serv || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("mercado") || s.includes("ml") || s.includes("flex")) return "Flex";
  return "Avulso";
}

// Debounce: evita processar o mesmo código várias vezes (performance igual/superior ao painel web)
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

export default function ScanScreen({ navigation }: Props) {
  const [modoManual, setModoManual] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [conflito, setConflito] = useState<{ motoboy_atual: string; id_saida: number } | null>(null);
  const [assumindo, setAssumindo] = useState(false);
  const [leiturasSession, setLeiturasSession] = useState<LeituraSession[]>([]);
  const [listaExpandida, setListaExpandida] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);
  const scanLocked = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();

  const addLeitura = useCallback((ent: { id_saida: number; codigo?: string | null; servico?: string | null }) => {
    const serv = classifyServico(ent.servico);
    setLeiturasSession((prev) => {
      if (prev.some((l) => l.id_saida === ent.id_saida)) return prev;
      return [...prev, { id_saida: ent.id_saida, codigo: ent.codigo || "", servico: serv }];
    });
  }, []);

  const removerLeitura = useCallback(async (id_saida: number) => {
    setRemovendoId(id_saida);
    try {
      await desatribuirEntrega(id_saida);
      setLeiturasSession((prev) => prev.filter((l) => l.id_saida !== id_saida));
    } catch {
      Alert.alert("Erro", "Não foi possível remover a leitura.");
    } finally {
      setRemovendoId(null);
    }
  }, []);

  const contadores = {
    Shopee: leiturasSession.filter((l) => l.servico === "Shopee").length,
    Flex: leiturasSession.filter((l) => l.servico === "Flex").length,
    Avulso: leiturasSession.filter((l) => l.servico === "Avulso").length,
  };

  const processarCodigo = useCallback(
    async (raw: string) => {
      const c = String(raw || "").trim();
      if (!c || scanLocked.current) return;
      if (isRecentlyScanned(c)) return;
      markScanned(c);
      scanLocked.current = true;
      setLoading(true);
      setConflito(null);

      try {
        const result = await scanCodigo(c);
        if (result.conflito) {
          setConflito({
            motoboy_atual: result.motoboy_atual ?? "outro motoboy",
            id_saida: result.id_saida ?? 0,
          });
        } else if (result.entrega) {
          addLeitura(result.entrega);
          Alert.alert("Sucesso", "Entrega atribuída.", [
            {
              text: "Ver entrega",
              onPress: () =>
                navigation.navigate("EntregaDetail", { idSaida: result.entrega?.id_saida ?? 0 }),
            },
            {
              text: "Continuar",
              onPress: () => {
                setCodigo("");
                setTimeout(() => (scanLocked.current = false), SCAN_DEBOUNCE_MS);
              },
            },
          ]);
        }
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "response" in e
            ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Código não encontrado ou erro ao processar.";
        Alert.alert("Erro", String(msg));
        setTimeout(() => (scanLocked.current = false), 500);
      } finally {
        setLoading(false);
      }
    },
    [navigation, addLeitura]
  );

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult | { nativeEvent: BarcodeScanningResult }) => {
      const result = "nativeEvent" in event ? event.nativeEvent : event;
      const data = result?.data ?? "";
      if (data && !scanLocked.current && !isRecentlyScanned(data)) {
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
      Alert.alert("Sucesso", "Entrega assumida.", [
        {
          text: "Ver entrega",
          onPress: () => navigation.navigate("EntregaDetail", { idSaida: conflito.id_saida }),
        },
        {
          text: "Continuar",
          onPress: () => {},
        },
      ]);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Erro ao assumir.";
      Alert.alert("Erro", String(msg));
    } finally {
      setAssumindo(false);
    }
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
      <View style={styles.headerOverlay}>
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

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadingText}>Processando...</Text>
        </View>
      )}

      <View style={styles.footerOverlay}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 24,
    paddingTop: 48,
  },
  containerCamera: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: { marginBottom: 32 },
  headerOverlay: {
    position: "absolute",
    top: 48,
    left: 24,
    right: 24,
    zIndex: 10,
  },
  backText: { fontSize: 16, color: "#0d6efd", marginBottom: 8 },
  backTextWhite: { fontSize: 16, color: "#fff", marginBottom: 8, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700" },
  titleWhite: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4 },
  subtitleWhite: { fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 4 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 24,
  },
  btnScan: {
    backgroundColor: "#198754",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnScanText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  linkManual: {
    marginTop: 24,
    alignItems: "center",
  },
  linkManualText: { fontSize: 15, color: "#0d6efd" },
  linkManualWhite: {
    paddingVertical: 12,
    alignItems: "center",
  },
  linkManualTextWhite: {
    fontSize: 15,
    color: "rgba(255,255,255,0.95)",
  },
  permissionText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 24,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  loadingText: { color: "#fff", marginTop: 12, fontSize: 16 },
  footerOverlay: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 10,
    maxHeight: "50%",
  },
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
  servicoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  modalMessage: { fontSize: 16, color: "#333", marginBottom: 24 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalBtnCancel: { paddingVertical: 12, paddingHorizontal: 24 },
  modalBtnCancelText: { color: "#666", fontSize: 16 },
  modalBtnOk: {
    backgroundColor: "#0d6efd",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalBtnOkText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
