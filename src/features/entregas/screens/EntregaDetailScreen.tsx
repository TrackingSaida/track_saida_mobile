import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  Image,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import * as ImagePicker from "expo-image-picker";
import { getEntrega, fetchComprovanteImagesDataUris, getEntregaHistorico } from "../api";
import type { EntregaListItem, EntregaHistoricoItem } from "../types";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { getNetworkState } from "../../../services/outbox/networkStatus";
import { useOutboxStore } from "../../../store/outboxStore";
import type { AddressFormValues, AddressOrigem } from "../components/AddressForm";
import AddressQuickForm from "../components/AddressQuickForm";
import FormEntregaConcluida from "../components/FormEntregaConcluida";
import FormAusenteModal from "../components/FormAusenteModal";
import { pickBestOcrAddress, parseVoiceAddress, type ParsedAddress } from "../utils/ocrAddress";
import VoiceAddressModal from "../components/VoiceAddressModal";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import type { GeocodeResult } from "../utils/geocode";
import { inferCoordPrecision, isValidGeocodeCoords } from "../utils/geocode";
import { runPostFinalizeFeedback } from "../utils/finalizeEntregaFeedback";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import DetailStatusHero from "../components/detail/DetailStatusHero";
import DetailOperacaoResumoBlock from "../components/detail/DetailOperacaoResumoBlock";
import EntregaTimelineSheet from "../components/detail/EntregaTimelineSheet";
import DetailAddressBlock from "../components/detail/DetailAddressBlock";
import DetailOccurrenceBlock from "../components/detail/DetailOccurrenceBlock";
import DetailPersonBlock from "../components/detail/DetailPersonBlock";
import DetailComprovanteBlock from "../components/detail/DetailComprovanteBlock";
import DetailInfoBlock, { DetailFieldRow } from "../components/detail/DetailInfoBlock";
import { resolveDetailStatusKind } from "../components/detail/detailFormatters";
import { openNavigationToStop } from "../utils/externalNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "EntregaDetail">;

export default function EntregaDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 48 },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        avisoRota: {
          backgroundColor: colors.warning + "33",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.warning + "55",
        },
        avisoRotaText: { fontSize: 14, color: colors.text, fontWeight: "600" },
        actions: { marginTop: 8, gap: 12 },
        btnEntregue: {
          backgroundColor: colors.success,
          paddingVertical: 18,
          borderRadius: 12,
          alignItems: "center",
        },
        btnAusente: {
          backgroundColor: colors.danger,
          paddingVertical: 18,
          borderRadius: 12,
          alignItems: "center",
        },
        btnNovaTentativa: {
          backgroundColor: colors.primary,
          paddingVertical: 18,
          borderRadius: 12,
          alignItems: "center",
        },
        btnDisabled: { opacity: 0.7 },
        btnEntregueText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "700" },
        btnAusenteText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "700" },
        btnNovaTentativaText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "700" },
        modalOverlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          padding: 24,
        },
        modalBox: { backgroundColor: colors.backgroundCard, borderRadius: 12, padding: 24 },
        modalMessage: { fontSize: 16, color: colors.text, marginBottom: 16 },
        modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, color: colors.text },
        radio: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          marginBottom: 8,
          backgroundColor: colors.inputBackground,
        },
        radioText: { fontSize: 16, color: colors.text },
        modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 20 },
        modalBtnCancelText: { color: colors.textSecondary },
      }),
    [colors]
  );
  const { idSaida } = route.params;
  const [entrega, setEntrega] = useState<EntregaListItem | null>(null);
  const [historico, setHistorico] = useState<EntregaHistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalAusente, setModalAusente] = useState(false);
  const [modalEndereco, setModalEndereco] = useState(false);
  const [modalEnderecoOpcoes, setModalEnderecoOpcoes] = useState(false);
  const [externalParsed, setExternalParsed] = useState<ParsedAddress | null>(null);
  const [quickFormFlowState, setQuickFormFlowState] =
    useState<import("../components/AddressQuickForm").QuickFormFlowState>("idle");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [vozLoading, setVozLoading] = useState(false);
  const [speechModule, setSpeechModule] = useState<typeof import("expo-speech-recognition") | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showEntregueModal, setShowEntregueModal] = useState(false);
  const [comprovanteUris, setComprovanteUris] = useState<string[]>([]);
  const [loadingComprovante, setLoadingComprovante] = useState(false);
  const [showComprovanteViewer, setShowComprovanteViewer] = useState(false);
  const [comprovanteViewerIndex, setComprovanteViewerIndex] = useState(0);
  const comprovanteViewerRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [showTimelineSheet, setShowTimelineSheet] = useState(false);
  const saveAddress = useDeliveryStore((s) => s.saveAddress);
  const markDelivered = useDeliveryStore((s) => s.markDelivered);
  const markAbsent = useDeliveryStore((s) => s.markAbsent);
  const pendingDeliveries = useDeliveryStore((s) => s.pendingDeliveries);
  const novaTentativa = useDeliveryStore((s) => s.novaTentativa);
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const outboxActions = useOutboxStore((s) => s.actions);

  const applyLocalFinalized = useCallback((kind: "entregue" | "ausente") => {
    setEntrega((prev) =>
      prev
        ? {
            ...prev,
            status: kind === "entregue" ? "Entregue" : "Ausente",
            exibicao: kind === "entregue" ? "Entregue" : "Ausente",
          }
        : prev
    );
  }, []);

  const findLocalDelivery = useCallback((targetId: number): EntregaListItem | null => {
    const store = useDeliveryStore.getState();
    return (
      store.pendingDeliveries.find((d) => d.id_saida === targetId) ??
      store.routeDeliveries.find((d) => d.id_saida === targetId) ??
      null
    );
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { online } = await getNetworkState();
      if (!online) {
        const local = findLocalDelivery(idSaida);
        setEntrega(local);
        setHistorico([]);
        return;
      }

      const [e, hist] = await Promise.all([
        getEntrega(idSaida),
        getEntregaHistorico(idSaida).catch(() => [] as EntregaHistoricoItem[]),
      ]);
      setEntrega(e);
      setHistorico(hist);
      const statusKind = resolveDetailStatusKind(e);
      const shouldLoadComprovante =
        !!e?.tem_comprovante &&
        (statusKind === "entregue" || statusKind === "cancelado" || statusKind === "ausente");
      if (shouldLoadComprovante) {
        setLoadingComprovante(true);
        try {
          const uris = await fetchComprovanteImagesDataUris(idSaida);
          setComprovanteUris(uris);
        } catch {
          setComprovanteUris([]);
        } finally {
          setLoadingComprovante(false);
        }
      } else {
        setComprovanteUris([]);
        setLoadingComprovante(false);
      }
    } catch {
      const local = findLocalDelivery(idSaida);
      setEntrega(local);
      setHistorico([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [idSaida]);

  useEffect(() => {
    if (!showComprovanteViewer || comprovanteUris.length === 0) return;
    requestAnimationFrame(() => {
      comprovanteViewerRef.current?.scrollTo({
        x: comprovanteViewerIndex * windowWidth,
        animated: false,
      });
    });
  }, [showComprovanteViewer, comprovanteViewerIndex, comprovanteUris.length, windowWidth]);

  const handleAbrirEntregueModal = () => setShowEntregueModal(true);
  const handleAbrirAusente = () => setModalAusente(true);

  const handleAusenteSuccess = async (result?: { queued?: boolean }) => {
    setModalAusente(false);
    if (result?.queued) {
      applyLocalFinalized("ausente");
    } else {
      await load();
    }
    runPostFinalizeFeedback({
      tipo: "ausente",
      codigo: entrega?.codigo,
      entregaAtrasada: false,
      routeJustCompleted: false,
      rotaIdForResumo: null,
      isRouteFlow: false,
      queued: result?.queued,
      onAfterIndividualAlert: () => navigation.goBack(),
    });
  };

  const handleAbrirEndereco = () => setModalEnderecoOpcoes(true);

  const handleDigitarEndereco = () => {
    setModalEnderecoOpcoes(false);
    setExternalParsed(null);
    setModalEndereco(true);
  };

  const handleOcrEndereco = async () => {
    setModalEnderecoOpcoes(false);
    let extractTextFromImage: (uri: string) => Promise<string[]>;
    let isSupported: boolean;
    try {
      const ocrModule = await import("expo-text-extractor");
      extractTextFromImage = ocrModule.extractTextFromImage;
      isSupported = ocrModule.isSupported;
    } catch {
      Alert.alert(
        "OCR não disponível",
        "O leitor de texto (OCR) funciona apenas em versão de desenvolvimento (build nativo). Use 'Digitar' ou 'Voz' para preencher o endereço."
      );
      return;
    }
    if (!isSupported) {
      Alert.alert("Não disponível", "Reconhecimento de texto não é suportado neste dispositivo.");
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão", "É necessário permitir o uso da câmera para escanear.");
      return;
    }
    setOcrLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setOcrLoading(false);
        return;
      }
      const lines = await extractTextFromImage(result.assets[0].uri);
      const parsed = pickBestOcrAddress(lines);
      const nomeOriginal = (entrega?.cliente ?? "").trim();
      const nomeOcr = (parsed.destinatario ?? "").trim();
      const openFormWithDest = (dest: string) => {
        setExternalParsed({ ...parsed, destinatario: dest });
        setModalEndereco(true);
        setOcrLoading(false);
      };
      if (nomeOcr && nomeOriginal && nomeOcr.toLowerCase() !== nomeOriginal.toLowerCase()) {
        Alert.alert(
          "Atualizar nome do destinatário?",
          `O texto lido foi: "${nomeOcr}". O cadastro atual é: "${nomeOriginal}".`,
          [
            { text: "Manter original", onPress: () => openFormWithDest(nomeOriginal) },
            { text: "Sim", onPress: () => openFormWithDest(nomeOcr) },
          ],
          { onDismiss: () => setOcrLoading(false) }
        );
        return;
      }
      openFormWithDest(nomeOcr || nomeOriginal);
    } catch {
      Alert.alert("Erro", "Não foi possível ler o texto da imagem.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleVozEndereco = async () => {
    setModalEnderecoOpcoes(false);
    setVozLoading(true);
    try {
      const mod = await import("expo-speech-recognition");
      setSpeechModule(mod);
      setShowVoiceModal(true);
    } catch {
      Alert.alert(
        "Voz não disponível",
        "O reconhecimento de voz funciona apenas em versão de desenvolvimento (build nativo). Use 'Digitar' ou 'Leitor (OCR)' para preencher o endereço."
      );
    } finally {
      setVozLoading(false);
    }
  };

  const handleVoiceDone = (transcript: string) => {
    setShowVoiceModal(false);
    setSpeechModule(null);
    const parsed = parseVoiceAddress(transcript, {
      cidade: cidadePadrao || undefined,
      estado: estadoPadrao || undefined,
    });
    setExternalParsed({
      ...parsed,
      destinatario: parsed.destinatario ?? entrega?.cliente ?? "",
    });
    setModalEndereco(true);
  };

  const handleVoiceCancel = () => {
    setShowVoiceModal(false);
    setSpeechModule(null);
  };

  const handleQuickFormSave = async (
    vals: AddressFormValues,
    coords?: GeocodeResult | null,
    origem: AddressOrigem = "manual"
  ) => {
    try {
      const body = {
        ...vals,
        origem,
        coord_precision: inferCoordPrecision(origem),
        ...(isValidGeocodeCoords(coords?.latitude, coords?.longitude)
          ? { latitude: coords!.latitude, longitude: coords!.longitude }
          : {}),
      };
      const updated = await saveAddress(idSaida, body);
      setEntrega(updated);
      setModalEndereco(false);
      setExternalParsed(null);
    } catch (e) {
      Alert.alert(
        "Erro ao salvar endereço",
        e instanceof Error ? e.message : "Não foi possível salvar. Verifique o endereço e tente novamente."
      );
    }
  };

  const handleQuickFormOcr = async () => {
    await handleOcrEndereco();
  };

  const handleQuickFormDictate = async () => {
    await handleVozEndereco();
  };

  const handleNavigate = async () => {
    if (!entrega) return;
    await openNavigationToStop(entrega, "google");
  };

  if (loading || !entrega) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const statusNorm = (entrega.status || "").toUpperCase();
  const podeFinalizar = statusNorm === "EM_ROTA";
  const awaitingSync = outboxActions.some(
    (action) =>
      (action.state === "pending" || action.state === "syncing" || action.state === "failed") &&
      action.idSaidas.includes(idSaida)
  );
  const podeFinalizarEfetivo = podeFinalizar && !awaitingSync;
  const statusKind = resolveDetailStatusKind(entrega);
  const isAusente = statusKind === "ausente";
  const isEntregue = statusKind === "entregue";
  const isCancelado = statusKind === "cancelado";
  const isPendente = statusKind === "pendente";
  const isFinalizado = isEntregue || isAusente || isCancelado;
  const mostrarAvisoRota = !isFinalizado && !podeFinalizar && !isAusente;
  const temObsEntrega = !!(entrega.observacao_entrega || "").trim();
  const showComprovanteBlock =
    isEntregue ||
    (isCancelado && !!entrega.tem_comprovante) ||
    (isAusente && (comprovanteUris.length > 0 || !!entrega.tem_comprovante));

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Detalhe da entrega"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {mostrarAvisoRota ? (
          <View style={styles.avisoRota}>
            <Text style={styles.avisoRotaText}>
              Inicie a rota na tela de escaneamento para poder finalizar esta entrega.
            </Text>
          </View>
        ) : null}

        <DetailStatusHero entrega={entrega} />
        <DetailOperacaoResumoBlock
          entrega={entrega}
          historico={historico}
          onOpenTimeline={() => setShowTimelineSheet(true)}
        />

        {isPendente ? (
          <>
            <DetailAddressBlock
              entrega={entrega}
              editable={!isFinalizado}
              onEditPress={handleAbrirEndereco}
              onNavigatePress={entrega.possui_endereco ? () => void handleNavigate() : undefined}
              showPhone
            />
          </>
        ) : null}

        {isAusente ? (
          <>
            <DetailOccurrenceBlock entrega={entrega} />
            <DetailPersonBlock entrega={entrega} mode="cliente" />
            <DetailAddressBlock entrega={entrega} showPhone />
            {showComprovanteBlock ? (
              <DetailComprovanteBlock
                thumbUris={comprovanteUris}
                loading={loadingComprovante}
                onPressThumb={(index) => {
                  setComprovanteViewerIndex(index);
                  setShowComprovanteViewer(true);
                }}
              />
            ) : null}
          </>
        ) : null}

        {isEntregue || isCancelado ? (
          <>
            {isEntregue ? <DetailPersonBlock entrega={entrega} mode="recebedor" /> : null}
            {temObsEntrega ? (
              <DetailInfoBlock title="Observação" icon="document-text-outline">
                <DetailFieldRow label="Entrega" value={entrega.observacao_entrega!.trim()} />
              </DetailInfoBlock>
            ) : null}
            <DetailAddressBlock entrega={entrega} showPhone={!isCancelado} />
            {isCancelado ? <DetailOccurrenceBlock entrega={entrega} /> : null}
            {showComprovanteBlock ? (
              <DetailComprovanteBlock
                thumbUris={comprovanteUris}
                loading={loadingComprovante}
                onPressThumb={
                  comprovanteUris.length
                    ? (index) => {
                        setComprovanteViewerIndex(index);
                        setShowComprovanteViewer(true);
                      }
                    : undefined
                }
              />
            ) : null}
          </>
        ) : null}

        <View style={styles.actions}>
          {isAusente ? (
            <TouchableOpacity
              style={[styles.btnNovaTentativa, saving && styles.btnDisabled]}
              onPress={async () => {
                setSaving(true);
                try {
                  await novaTentativa(idSaida);
                  Alert.alert("Sucesso", "Pedido colocado em rota para nova tentativa.", [
                    { text: "OK", onPress: () => navigation.goBack() },
                  ]);
                } catch (e: unknown) {
                  const msg =
                    e && typeof e === "object" && "response" in e
                      ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
                      : "Erro ao solicitar nova tentativa.";
                  Alert.alert("Erro", String(msg));
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            >
              <Text style={styles.btnNovaTentativaText}>Nova Tentativa</Text>
            </TouchableOpacity>
          ) : null}

          {podeFinalizarEfetivo ? (
            <>
              <TouchableOpacity style={styles.btnEntregue} onPress={handleAbrirEntregueModal}>
                <Text style={styles.btnEntregueText}>Marcar como entregue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAusente} onPress={handleAbrirAusente}>
                <Text style={styles.btnAusenteText}>Marcar como ausente</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </ScrollView>

      <EntregaTimelineSheet
        visible={showTimelineSheet}
        entrega={entrega}
        historico={historico}
        comprovanteUris={comprovanteUris}
        comprovanteLoading={loadingComprovante}
        onVerComprovante={(index) => {
          setComprovanteViewerIndex(index);
          setShowComprovanteViewer(true);
        }}
        onClose={() => setShowTimelineSheet(false)}
      />

      <Modal visible={modalEnderecoOpcoes} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Adicionar Endereço</Text>
            <TouchableOpacity style={styles.radio} onPress={handleDigitarEndereco} disabled={ocrLoading}>
              <Text style={styles.radioText}>Digitar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.radio} onPress={() => void handleOcrEndereco()} disabled={ocrLoading}>
              <Text style={styles.radioText}>{ocrLoading ? "Abrindo câmera…" : "Leitor (OCR)"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.radio} onPress={() => void handleVozEndereco()} disabled={vozLoading}>
              <Text style={styles.radioText}>{vozLoading ? "Abrindo…" : "Voz"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalEnderecoOpcoes(false)}>
              <Text style={styles.modalBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showVoiceModal && speechModule ? (
        <VoiceAddressModal
          speechModule={speechModule}
          modalStyles={{
            modalOverlay: styles.modalOverlay,
            modalBox: styles.modalBox,
            modalTitle: styles.modalTitle,
            modalMessage: styles.modalMessage,
            modalBtnCancel: styles.modalBtnCancel,
            modalBtnCancelText: styles.modalBtnCancelText,
          }}
          onDone={handleVoiceDone}
          onCancel={handleVoiceCancel}
        />
      ) : null}

      <Modal visible={modalEndereco && entrega != null} animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddressQuickForm
            delivery={entrega!}
            flowState={quickFormFlowState}
            cidadePadrao={cidadePadrao}
            estadoPadrao={estadoPadrao}
            knownDeliveries={pendingDeliveries}
            hidePackageCard
            submitLabel="Salvar"
            onFlowStateChange={setQuickFormFlowState}
            onSaveAndNext={handleQuickFormSave}
            onDictate={() => void handleQuickFormDictate()}
            onOcr={() => void handleQuickFormOcr()}
            externalParsed={externalParsed}
            onCancel={() => {
              setModalEndereco(false);
              setExternalParsed(null);
            }}
          />
        </View>
      </Modal>

      <FormEntregaConcluida
        visible={showEntregueModal}
        idSaida={idSaida}
        destinatarioPreenchido={entrega?.cliente ?? undefined}
        requiredFields={entrega?.campos_obrigatorios_entregue || []}
        onClose={() => setShowEntregueModal(false)}
        onSuccess={async ({ marcacao, queued } = {}) => {
          setShowEntregueModal(false);
          if (queued) {
            applyLocalFinalized("entregue");
          } else {
            await load();
          }
          const extra = marcacao as { routeJustCompleted?: boolean; rotaIdForResumo?: string | number | null };
          runPostFinalizeFeedback({
            tipo: "entregue",
            codigo: entrega?.codigo,
            entregaAtrasada: marcacao?.entrega_atrasada ?? false,
            routeJustCompleted: extra.routeJustCompleted ?? false,
            rotaIdForResumo: extra.rotaIdForResumo ?? null,
            isRouteFlow: marcacao?.rota_sync?.in_active_route ?? false,
            queued,
            onAfterIndividualAlert: () => navigation.goBack(),
          });
        }}
      />

      <FormAusenteModal
        visible={modalAusente}
        idSaidas={[idSaida]}
        requiredFields={entrega?.campos_obrigatorios_ausente || []}
        codigo={entrega?.codigo ?? undefined}
        onSuccess={handleAusenteSuccess}
        onClose={() => setModalAusente(false)}
      />

      <Modal
        visible={showComprovanteViewer}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setShowComprovanteViewer(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View
            style={{
              paddingTop: Math.max(14, insets.top),
              paddingHorizontal: 16,
              paddingBottom: 12,
              backgroundColor: "rgba(0,0,0,0.3)",
            }}
          >
            <TouchableOpacity onPress={() => setShowComprovanteViewer(false)}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 }}>Fechar</Text>
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 14 }}>
              Comprovante {entrega?.codigo ? `- ${entrega.codigo}` : ""}
              {comprovanteUris.length > 1
                ? ` (${comprovanteViewerIndex + 1}/${comprovanteUris.length})`
                : ""}
            </Text>
          </View>
          {comprovanteUris.length > 0 ? (
            <ScrollView
              ref={comprovanteViewerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
                if (nextIndex >= 0 && nextIndex < comprovanteUris.length) {
                  setComprovanteViewerIndex(nextIndex);
                }
              }}
            >
              {comprovanteUris.map((uri, index) => (
                <View key={`${index}-${uri.slice(0, 24)}`} style={{ width: windowWidth, flex: 1 }}>
                  <Image source={{ uri }} style={{ width: windowWidth, flex: 1, resizeMode: "contain" }} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
