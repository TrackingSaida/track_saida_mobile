import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import EntregaCodigoHeader from "../components/EntregaCodigoHeader";
import { useScannerTorch } from "../hooks/useScannerTorch";
import ScannerTorchButton from "../components/ScannerTorchButton";
import { getEntregas } from "../api";
import type { EntregaListItem } from "../types";
import { parseCodigoQrRaw } from "../../operacao/parseCodigoQr";
import { takeDeliveryPhoto, preparePhoto } from "../../../services/deliveryPhotoService";
import {
  clearDevolucaoPhotoDraft,
  loadDevolucaoPhotoDraft,
  saveDevolucaoPhotoDraft,
} from "../../../services/deliveryPhotoDraft";
import { usePhotoCaptureStore } from "../../../store/photoCaptureStore";
import {
  enqueueDevolucaoCompletion,
  OutboxKindConflictError,
} from "../../../services/outbox/deliveryOutboxService";
import { alertDevolucaoFeita } from "../utils/deliveryAlerts";
import { useAuthStore } from "../../../store/authStore";
import { decodeJwtPayload } from "../../../utils/jwt";
import type { RootStackParamList } from "../../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "DevolverPacotes">;

function searchEntregasByCodigo(
  itens: EntregaListItem[],
  query: string,
  limit = 12
): EntregaListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return itens
    .filter((it) => String(it.codigo ?? "").toLowerCase().includes(q))
    .slice(0, limit);
}

function findEntregaByScan(itens: EntregaListItem[], raw: string): EntregaListItem | null {
  const parsed = parseCodigoQrRaw(raw);
  const candidates = [parsed.codigo, raw]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (candidates.length === 0) return null;

  for (const item of itens) {
    const codigo = String(item.codigo ?? "").trim().toLowerCase();
    if (!codigo) continue;
    if (candidates.some((c) => codigo.includes(c) || c.includes(codigo))) {
      return item;
    }
  }
  return null;
}

export default function DevolverPacotesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const scanLockedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const token = useAuthStore((s) => s.token);
  const claims = token ? decodeJwtPayload(token) : {};
  const subBaseNome =
    (typeof claims.sub_base_nome === "string" && claims.sub_base_nome.trim()) ||
    (typeof claims.sub_base === "string" && claims.sub_base.trim()) ||
    "base";

  const [loading, setLoading] = useState(true);
  const [pacotes, setPacotes] = useState<EntregaListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selected, setSelected] = useState<EntregaListItem | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const photoCaptureActive = usePhotoCaptureStore((s) => s.hardwareBusy);
  const torch = useScannerTorch(scannerVisible && !!cameraPermission?.granted && !photoCaptureActive);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { justifyContent: "center", alignItems: "center", padding: 24 },
        hint: {
          color: colors.textSecondary,
          fontSize: 14,
          lineHeight: 20,
          paddingHorizontal: 16,
          marginBottom: 12,
        },
        searchRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
        },
        searchInput: {
          flex: 1,
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
        },
        searchIconBtn: {
          minWidth: 110,
          minHeight: 42,
          borderRadius: 10,
          backgroundColor: colors.primary,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        searchIconBtnText: {
          color: colors.primaryContrast,
          fontSize: 14,
          fontWeight: "700",
        },
        searchResultsWrap: {
          marginHorizontal: 16,
          marginBottom: 8,
          maxHeight: 220,
          borderWidth: 1,
          borderColor: colors.separator,
          borderRadius: 10,
          backgroundColor: colors.backgroundCard,
        },
        searchResultItem: {
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        searchResultCliente: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        content: { paddingHorizontal: 16, paddingBottom: 32 },
        emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 24 },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 12,
        },
        cardTitle: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          marginBottom: 8,
        },
        cliente: { marginTop: 8, color: colors.text, fontSize: 14, fontWeight: "600" },
        endereco: { marginTop: 4, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
        photoPreview: {
          width: "100%",
          height: 200,
          borderRadius: 12,
          backgroundColor: colors.chipBackground,
          marginBottom: 12,
        },
        secondaryBtn: {
          minHeight: 46,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          marginBottom: 10,
        },
        secondaryBtnText: { color: colors.primary, fontWeight: "700", fontSize: 15 },
        primaryBtn: {
          minHeight: 48,
          borderRadius: 10,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        },
        primaryBtnDisabled: { opacity: 0.45 },
        primaryBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: 16 },
        clearBtn: {
          alignSelf: "flex-start",
          marginTop: 8,
          paddingVertical: 6,
          paddingHorizontal: 2,
        },
        clearBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
        scannerHeader: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          paddingHorizontal: 16,
          backgroundColor: "rgba(0,0,0,0.35)",
        },
        scannerClose: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
        scannerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
        scannerSubtitle: { color: "#d5e6ff", fontSize: 13, marginTop: 2, marginBottom: 10 },
        scannerFooter: {
          position: "absolute",
          left: 16,
          right: 16,
          zIndex: 2,
          borderRadius: 10,
          padding: 12,
          backgroundColor: "rgba(0,0,0,0.45)",
        },
        scannerFooterText: { color: "#fff", fontSize: 13, textAlign: "center" },
      }),
    [colors]
  );

  const carregarPacotes = useCallback(async () => {
    setLoading(true);
    try {
      // Só pacotes do motoboy logado (API mobile — não consulta admin).
      const [pendentes, ausentes] = await Promise.all([
        getEntregas("pendente"),
        getEntregas("ausentes"),
      ]);
      const byId = new Map<number, EntregaListItem>();
      for (const d of [...pendentes, ...ausentes]) {
        byId.set(d.id_saida, d);
      }
      setPacotes(Array.from(byId.values()));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível carregar seus pacotes.";
      Alert.alert("Erro", msg);
      setPacotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregarPacotes();
    }, [carregarPacotes])
  );

  const draftHydratedRef = useRef(false);
  useEffect(() => {
    if (loading || draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    let cancelled = false;
    void (async () => {
      const draft = await loadDevolucaoPhotoDraft();
      if (cancelled || !draft) return;
      if (draft.idSaida) {
        const found = pacotes.find((p) => p.id_saida === draft.idSaida);
        if (found) setSelected(found);
      }
      if (draft.photoUri) setPhotoUri(draft.photoUri);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, pacotes]);

  useEffect(() => {
    if (!selected && !photoUri) return;
    void saveDevolucaoPhotoDraft({
      idSaida: selected?.id_saida ?? null,
      codigo: selected?.codigo ?? undefined,
      photoUri,
    });
  }, [selected, photoUri]);

  const searchResults = useMemo(
    () => searchEntregasByCodigo(pacotes, searchQuery),
    [pacotes, searchQuery]
  );

  const selecionarPacote = useCallback((item: EntregaListItem) => {
    setSelected(item);
    setPhotoUri(null);
    setSearchQuery("");
  }, []);

  const processarBuscaOuScan = useCallback(
    (raw: string) => {
      const found = findEntregaByScan(pacotes, raw);
      if (!found) {
        Alert.alert(
          "Não encontrado",
          "Nenhum pacote seu (pendente, em rota ou ausente) corresponde a este código."
        );
        return;
      }
      selecionarPacote(found);
    },
    [pacotes, selecionarPacote]
  );

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult) => {
      if (scanLockedRef.current) return;
      const data = String(event.data ?? "").trim();
      if (!data) return;
      scanLockedRef.current = true;
      setScannerVisible(false);
      processarBuscaOuScan(data);
      setTimeout(() => {
        scanLockedRef.current = false;
      }, 500);
    },
    [processarBuscaOuScan]
  );

  const openScanner = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert("Permissão", "Permita acesso à câmera para escanear.");
        return;
      }
    }
    scanLockedRef.current = false;
    setScannerVisible(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const tirarFoto = useCallback(async () => {
    if (takingPhoto) return;
    setScannerVisible(false);
    setTakingPhoto(true);
    try {
      await saveDevolucaoPhotoDraft({
        idSaida: selected?.id_saida ?? null,
        codigo: selected?.codigo ?? undefined,
        photoUri,
      });
      const picked = await takeDeliveryPhoto();
      if (!picked) return;
      const prepared = await preparePhoto(picked.uri);
      setPhotoUri(prepared.uri);
      await saveDevolucaoPhotoDraft({
        idSaida: selected?.id_saida ?? null,
        codigo: selected?.codigo ?? undefined,
        photoUri: prepared.uri,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível tirar a foto.";
      Alert.alert("Foto", msg);
    } finally {
      setTakingPhoto(false);
    }
  }, [takingPhoto, selected, photoUri]);

  const confirmarDevolucao = useCallback(async () => {
    if (!selected || !photoUri || submitting) return;
    setSubmitting(true);
    try {
      const result = await enqueueDevolucaoCompletion({
        idSaidas: [selected.id_saida],
        photoUris: [photoUri],
      });
      const codigo = selected.codigo;
      setSelected(null);
      setPhotoUri(null);
      setPacotes((prev) => prev.filter((d) => d.id_saida !== selected.id_saida));
      await clearDevolucaoPhotoDraft();
      alertDevolucaoFeita(codigo, subBaseNome, undefined, result.queued);
    } catch (e) {
      if (e instanceof OutboxKindConflictError) {
        Alert.alert("Envio pendente", e.message);
      } else {
        const msg =
          e instanceof Error ? e.message : "Não foi possível registrar a devolução.";
        Alert.alert("Erro", msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [selected, photoUri, submitting, subBaseNome]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const canConfirm = Boolean(selected && photoUri) && !submitting;

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Devolver pacotes"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />

      <Text style={styles.hint}>
        Busque ou escaneie um pacote seu para devolver à {subBaseNome}. A foto do comprovante é
        obrigatória.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar código"
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (searchResults.length === 1) selecionarPacote(searchResults[0]);
            else if (searchQuery.trim()) processarBuscaOuScan(searchQuery);
          }}
        />
        <TouchableOpacity style={styles.searchIconBtn} onPress={() => void openScanner()}>
          <Ionicons name="scan-outline" size={22} color={colors.primaryContrast} />
          <Text style={styles.searchIconBtnText}>Escanear</Text>
        </TouchableOpacity>
      </View>

      {searchQuery.trim().length > 0 ? (
        <View style={styles.searchResultsWrap}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => `search-${item.id_saida}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.searchResultItem}>
                <Text style={styles.searchResultCliente}>
                  Nenhum pacote encontrado com esse trecho.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => selecionarPacote(item)}
              >
                <EntregaCodigoHeader
                  codigo={item.codigo}
                  servico={item.servico}
                  exibicao={item.exibicao}
                  compact
                />
                {item.cliente ? (
                  <Text style={styles.searchResultCliente} numberOfLines={1}>
                    {item.cliente}
                  </Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!selected ? (
          <Text style={styles.emptyText}>
            {pacotes.length === 0
              ? "Você não tem pacotes pendentes, em rota ou ausentes para devolver."
              : "Digite o código ou toque em Escanear para escolher o pacote."}
          </Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pacote selecionado</Text>
              <EntregaCodigoHeader
                codigo={selected.codigo}
                servico={selected.servico}
                exibicao={selected.exibicao}
              />
              {selected.cliente ? <Text style={styles.cliente}>{selected.cliente}</Text> : null}
              {selected.endereco_formatado || selected.endereco ? (
                <Text style={styles.endereco}>
                  {selected.endereco_formatado || selected.endereco}
                </Text>
              ) : null}
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setSelected(null);
                  setPhotoUri(null);
                }}
              >
                <Text style={styles.clearBtnText}>Trocar pacote</Text>
              </TouchableOpacity>
            </View>

            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            ) : null}

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => void tirarFoto()}
              disabled={takingPhoto}
            >
              {takingPhoto ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  <Text style={styles.secondaryBtnText}>
                    {photoUri ? "Tirar outra foto" : "Tirar foto"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, !canConfirm && styles.primaryBtnDisabled]}
              onPress={() => void confirmarDevolucao()}
              disabled={!canConfirm}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={styles.primaryBtnText}>Confirmar devolução</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal
        visible={scannerVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View
            style={[
              styles.scannerHeader,
              { paddingTop: Math.max(14, insets.top), paddingBottom: 10 },
            ]}
          >
            <TouchableOpacity onPress={() => setScannerVisible(false)}>
              <Text style={styles.scannerClose}>← Fechar</Text>
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Escanear pedido</Text>
            <Text style={styles.scannerSubtitle}>Aponte para o QR Code da etiqueta</Text>
          </View>
          {photoCaptureActive ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
          ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            enableTorch={torch.enableTorch}
            onCameraReady={torch.onCameraReady}
            onBarcodeScanned={scanLockedRef.current ? undefined : handleBarcodeScanned}
          />
          )}
          <ScannerTorchButton
            mode={torch.mode}
            onPress={torch.cycleMode}
            style={{ top: insets.top + 72, right: 16 }}
          />
          <View style={[styles.scannerFooter, { bottom: Math.max(14, insets.bottom) }]}>
            <Text style={styles.scannerFooterText}>Busca pacotes seus (pendentes e ausentes)</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
