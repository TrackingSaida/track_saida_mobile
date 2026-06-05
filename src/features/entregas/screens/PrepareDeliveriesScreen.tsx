import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import { useDeliveryStore } from "../../../store/deliveryStore";
import AddressForm, {
  type AddressFormValues,
  type AddressOrigem,
  type AddressCandidate,
} from "../components/AddressForm";
import AddressQuickForm, { type QuickFormFlowState } from "../components/AddressQuickForm";
import AddressPreviewSheet from "../components/AddressPreviewSheet";
import GeocodeFailureSheet from "../components/GeocodeFailureSheet";
import PrepProgressList from "../components/PrepProgressList";
import PrepScanSheet from "../components/PrepScanSheet";
import VoiceAddressModal from "../components/VoiceAddressModal";
import type { EntregaListItem } from "../types";
import {
  buildPrepQueue,
  prepOrdemLabel,
  type PrepOrdemModo,
  type ServicoTipo,
  SERVICO_ORDER,
} from "../utils/servico";
import {
  parseVoiceAddress,
  pickBestOcrAddress,
  parsedToFormValues,
  type ParsedAddress,
} from "../utils/ocrAddress";
import { geocodeAddress } from "../utils/geocode";
import type { EnderecoBody } from "../api";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";

type Props = NativeStackScreenProps<RootStackParamList, "PrepareDeliveries">;

type AfterSaveMode = "scan" | "queue" | "none";

export default function PrepareDeliveriesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const {
    pendingDeliveries,
    deliveriesWithAddress,
    deliveriesWithoutAddress,
    loadDeliveries,
    saveAddress,
    loading,
    setRouteDeliveries,
    clearActiveRouteState,
    activeRouteId,
    optimizeRoute,
  } = useDeliveryStore();

  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const prepOrdemModo = useMotoboyPrefsStore((s) => s.prepOrdemModo);
  const prepServicoInicio = useMotoboyPrefsStore((s) => s.prepServicoInicio);
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const setPrepOrdem = useMotoboyPrefsStore((s) => s.setPrepOrdem);

  const [showScanSheet, setShowScanSheet] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<EntregaListItem | null>(null);
  const [queue, setQueue] = useState<EntregaListItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [afterSaveMode, setAfterSaveMode] = useState<AfterSaveMode>("none");
  const [flowState, setFlowState] = useState<QuickFormFlowState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [externalParsed, setExternalParsed] = useState<ParsedAddress | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [previewParsed, setPreviewParsed] = useState<ParsedAddress | null>(null);
  const [previewSource, setPreviewSource] = useState<"voice" | "ocr">("voice");
  const [pendingPreviewSave, setPendingPreviewSave] = useState<AddressFormValues | null>(null);

  const [showGeocodeFailure, setShowGeocodeFailure] = useState(false);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [pendingSaveValues, setPendingSaveValues] = useState<AddressFormValues | null>(null);
  const [pendingSaveOrigem, setPendingSaveOrigem] = useState<AddressOrigem>("manual");

  const [showOrdemModal, setShowOrdemModal] = useState(false);
  const [ordemDraftModo, setOrdemDraftModo] = useState<PrepOrdemModo>(prepOrdemModo);
  const [ordemDraftServico, setOrdemDraftServico] = useState<ServicoTipo>(prepServicoInicio);
  const [optimizing, setOptimizing] = useState(false);

  const voiceResolveRef = useRef<(v: AddressCandidate[] | AddressCandidate | null) => void>(
    () => {}
  );
  const voiceRejectRef = useRef<() => void>(() => {});

  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [speechModule, setSpeechModule] = useState<{
    ExpoSpeechRecognitionModule: typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent: typeof import("expo-speech-recognition").useSpeechRecognitionEvent;
  } | null>(null);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        header: { paddingHorizontal: 20, paddingBottom: 12 },
        backText: { fontSize: 16, color: colors.primary, marginBottom: 8 },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        card: {
          marginHorizontal: 20,
          backgroundColor: colors.backgroundCard,
          padding: 20,
          borderRadius: 12,
          marginBottom: 16,
        },
        totalValue: { fontSize: 32, fontWeight: "800", color: colors.text, marginBottom: 12 },
        row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
        label: { fontSize: 14, color: colors.textSecondary },
        value: { fontSize: 16, fontWeight: "600", color: colors.text },
        ordemRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          marginHorizontal: 20,
          marginBottom: 12,
          gap: 8,
        },
        ordemText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
        ordemLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
        btn: {
          marginHorizontal: 20,
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 10,
        },
        btnDisabled: { opacity: 0.5 },
        btnText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "600" },
        btnOutline: {
          marginHorizontal: 20,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.primary,
          marginBottom: 10,
        },
        btnOutlineText: { color: colors.primary, fontSize: 15, fontWeight: "600" },
        btnGhost: {
          marginHorizontal: 20,
          paddingVertical: 10,
          alignItems: "center",
          marginBottom: 8,
        },
        btnGhostText: { fontSize: 14, color: colors.textSecondary },
        feedback: {
          marginHorizontal: 20,
          padding: 10,
          borderRadius: 8,
          backgroundColor: colors.success + "22",
          marginBottom: 12,
        },
        feedbackText: { fontSize: 13, color: colors.text, textAlign: "center" },
        listSection: { flex: 1, marginHorizontal: 20, marginBottom: 16 },
        listTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 8 },
        modalWrap: { flex: 1, backgroundColor: colors.backgroundCard },
        ordemModalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          padding: 24,
        },
        ordemModalBox: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 20,
        },
        ordemModalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 16 },
        ordemBtn: {
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          marginBottom: 10,
        },
        ordemBtnText: { fontSize: 16, fontWeight: "600", color: colors.primaryContrast },
        ordemBtnOutline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: "transparent" },
        ordemBtnOutlineText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
        voiceModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
        voiceModalBox: { backgroundColor: colors.backgroundCard, borderRadius: 12, padding: 20 },
        voiceModalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        voiceModalMessage: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
        voiceModalBtnCancel: { paddingVertical: 12, alignItems: "center" },
        voiceModalBtnCancelText: { fontSize: 16, color: colors.primary },
      }),
    [colors]
  );

  useFocusEffect(
    useCallback(() => {
      if (!roteirizacaoHabilitada) {
        navigation.replace("EntregasList");
        return;
      }
      void loadDeliveries({ onlyToday: somenteHojePendentes });
    }, [roteirizacaoHabilitada, navigation, loadDeliveries, somenteHojePendentes])
  );

  const total = pendingDeliveries.length;
  const comEndereco = deliveriesWithAddress.length;
  const semEndereco = deliveriesWithoutAddress.length;

  const withCoords = useMemo(
    () =>
      deliveriesWithAddress.filter((d) => d.latitude != null && d.longitude != null),
    [deliveriesWithAddress]
  );

  const queuePrefs = useMemo(
    () => ({ modo: prepOrdemModo, servicoInicio: prepServicoInicio }),
    [prepOrdemModo, prepServicoInicio]
  );

  const progressItems = useMemo(() => {
    const without = buildPrepQueue(deliveriesWithoutAddress, queuePrefs);
    return [...without, ...deliveriesWithAddress];
  }, [deliveriesWithoutAddress, deliveriesWithAddress, queuePrefs]);

  const refreshQueue = useCallback(() => {
    const without = useDeliveryStore.getState().deliveriesWithoutAddress;
    const q = buildPrepQueue(without, queuePrefs);
    setQueue(q);
    return q;
  }, [queuePrefs]);

  useEffect(() => {
    if (feedbackMessage) {
      const t = setTimeout(() => setFeedbackMessage(null), 2500);
      return () => clearTimeout(t);
    }
  }, [feedbackMessage]);

  const addressQueryFromValues = (vals: AddressFormValues): string =>
    [vals.rua, vals.numero, vals.bairro, vals.cidade, vals.estado, vals.cep]
      .filter(Boolean)
      .join(", ");

  const commitSave = useCallback(
    async (vals: AddressFormValues, origem: AddressOrigem, skipGeocodeCheck = false) => {
      if (!activeDelivery) return;
      setFlowState("geocoding");
      try {
        if (!skipGeocodeCheck) {
          const query = addressQueryFromValues(vals);
          const geo = await geocodeAddress(query, {
            cidade: vals.cidade,
            estado: vals.estado,
            bairro: vals.bairro,
            numero: vals.numero,
          });
          if (!geo) {
            setPendingSaveValues(vals);
            setPendingSaveOrigem(origem);
            setGeocodeQuery(query);
            setShowGeocodeFailure(true);
            setFlowState("idle");
            return;
          }
          const body: EnderecoBody = {
            ...vals,
            origem,
            latitude: geo.latitude,
            longitude: geo.longitude,
          };
          setFlowState("saving");
          await saveAddress(activeDelivery.id_saida, body);
        } else {
          setFlowState("saving");
          await saveAddress(activeDelivery.id_saida, { ...vals, origem });
        }
        setFeedbackMessage("Endereço salvo. Próximo pacote.");
        setExternalParsed(null);
        setShowGeocodeFailure(false);
        setPendingSaveValues(null);

        if (afterSaveMode === "scan") {
          setShowQuickForm(false);
          setShowAdvancedForm(false);
          setActiveDelivery(null);
          setShowScanSheet(true);
        } else if (afterSaveMode === "queue") {
          const q = refreshQueue();
          const currentId = activeDelivery.id_saida;
          const nextPending =
            q.find((d) => !d.possui_endereco && d.id_saida !== currentId) ?? null;
          if (nextPending) {
            setActiveDelivery(nextPending);
            setQueueIndex(q.indexOf(nextPending));
            if (!showAdvancedForm) {
              setShowQuickForm(true);
            }
          } else {
            setShowQuickForm(false);
            setShowAdvancedForm(false);
            setActiveDelivery(null);
          }
        } else {
          setShowQuickForm(false);
          setShowAdvancedForm(false);
          setActiveDelivery(null);
        }
      } catch (e) {
        Alert.alert(
          "Erro ao salvar",
          e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente."
        );
      } finally {
        setFlowState("idle");
      }
    },
    [
      activeDelivery,
      saveAddress,
      afterSaveMode,
      refreshQueue,
      showAdvancedForm,
    ]
  );

  const handleSaveAndNext = useCallback(
    async (vals: AddressFormValues, origem: AddressOrigem = "manual") => {
      await commitSave(vals, origem, false);
    },
    [commitSave]
  );

  const handleScanFound = (delivery: EntregaListItem) => {
    setShowScanSheet(false);
    setActiveDelivery(delivery);
    setAfterSaveMode("scan");
    setShowQuickForm(true);
    setExternalParsed(null);
  };

  const handleStartScan = () => {
    setAfterSaveMode("scan");
    setShowScanSheet(true);
  };

  const handleNextPending = () => {
    const q = refreshQueue();
    const next = q[queueIndex] ?? q[0];
    if (!next) {
      Alert.alert("Atenção", "Não há pedidos pendentes de endereço.");
      return;
    }
    setQueue(q);
    setQueueIndex(q.indexOf(next));
    setActiveDelivery(next);
    setAfterSaveMode("queue");
    setShowQuickForm(true);
    setExternalParsed(null);
  };

  const handleProgressPress = (item: EntregaListItem) => {
    if (item.possui_endereco) return;
    const q = refreshQueue();
    setQueue(q);
    setQueueIndex(q.findIndex((d) => d.id_saida === item.id_saida));
    setActiveDelivery(item);
    setAfterSaveMode("queue");
    setShowQuickForm(true);
    setExternalParsed(null);
  };

  const captureOcrParsed = useCallback(async (): Promise<ParsedAddress | null> => {
    const isExpoGo = Constants.appOwnership === "expo";
    if (isExpoGo) {
      Alert.alert(
        "OCR no Expo Go",
        "O leitor por imagem só funciona em build nativo. Use digitar ou voz."
      );
      return null;
    }
    let extractTextFromImage: (uri: string) => Promise<string[]>;
    let isSupported: boolean;
    try {
      const ocrModule = await import("expo-text-extractor");
      extractTextFromImage = ocrModule.extractTextFromImage;
      isSupported = ocrModule.isSupported;
    } catch {
      Alert.alert("OCR não disponível", "Use build nativo ou digite o endereço.");
      return null;
    }
    if (!isSupported) {
      Alert.alert("Não disponível", "OCR não suportado neste dispositivo.");
      return null;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão", "Permita o uso da câmera.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    const lines = await extractTextFromImage(result.assets[0].uri);
    return pickBestOcrAddress(lines);
  }, []);

  const handleOcr = useCallback(async () => {
    setFlowState("parsing");
    try {
      const parsed = await captureOcrParsed();
      if (!parsed) {
        setFlowState("idle");
        return;
      }
      if (!(parsed.rua ?? "").trim() && parsed.rawText) {
        setExternalParsed(parsed);
        setFlowState("idle");
        return;
      }
      setPreviewParsed(parsed);
      setPreviewSource("ocr");
      setPendingPreviewSave(parsedToFormValues(parsed));
      setShowPreview(true);
    } catch {
      Alert.alert("Erro", "Não foi possível ler a imagem.");
    } finally {
      setFlowState("idle");
    }
  }, [captureOcrParsed]);

  const handleRequestOcrAdvanced = useCallback(async () => {
    const parsed = await captureOcrParsed();
    if (!parsed) return null;
    return Object.keys(parsed).length > 0 ? parsedToFormValues(parsed) : null;
  }, [captureOcrParsed]);

  const handleRequestVozAdvanced = useCallback((): Promise<AddressCandidate | null> => {
    const isExpoGo = Constants.appOwnership === "expo";
    if (isExpoGo) {
      Alert.alert("Voz no Expo Go", "Reconhecimento de voz só funciona em build nativo.");
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      voiceResolveRef.current = (v) => {
        setShowVoiceModal(false);
        setSpeechModule(null);
        if (Array.isArray(v)) resolve(v[0] ?? null);
        else resolve(v);
      };
      voiceRejectRef.current = () => {
        setShowVoiceModal(false);
        setSpeechModule(null);
        resolve(null);
      };
      void (async () => {
        try {
          const mod = await import("expo-speech-recognition");
          setSpeechModule(mod);
          setShowVoiceModal(true);
        } catch {
          Alert.alert("Voz não disponível", "Use build nativo ou digite o endereço.");
          resolve(null);
        }
      })();
    });
  }, []);

  const handleDictate = useCallback(async () => {
    const isExpoGo = Constants.appOwnership === "expo";
    if (isExpoGo) {
      Alert.alert("Voz no Expo Go", "Reconhecimento de voz só funciona em build nativo.");
      return;
    }
    try {
      const mod = await import("expo-speech-recognition");
      setSpeechModule(mod);
      setFlowState("listening");
      setShowVoiceModal(true);
    } catch {
      Alert.alert("Voz não disponível", "Use build nativo ou digite o endereço.");
    }
  }, []);

  const handleVoiceDone = useCallback(
    (transcript: string) => {
      const parsed = parseVoiceAddress(transcript, {
        cidade: cidadePadrao || undefined,
        estado: estadoPadrao || undefined,
      });
      if (showAdvancedForm) {
        if (Object.keys(parsed).length > 0) {
          voiceResolveRef.current(parsedToFormValues(parsed));
        } else {
          voiceResolveRef.current(null);
        }
        return;
      }
      setShowVoiceModal(false);
      setSpeechModule(null);
      setFlowState("parsing");
      if (!(parsed.rua ?? "").trim()) {
        setExternalParsed({ rawText: transcript, confidence: "low" });
        setFlowState("idle");
        return;
      }
      setPreviewParsed(parsed);
      setPreviewSource("voice");
      setPendingPreviewSave(parsedToFormValues(parsed));
      setShowPreview(true);
      setFlowState("idle");
    },
    [cidadePadrao, estadoPadrao, showAdvancedForm]
  );

  const handleVoiceCancel = useCallback(() => {
    if (showAdvancedForm) {
      voiceRejectRef.current();
      return;
    }
    setShowVoiceModal(false);
    setSpeechModule(null);
    setFlowState("idle");
  }, [showAdvancedForm]);

  const handlePreviewSave = async () => {
    if (!pendingPreviewSave) return;
    setShowPreview(false);
    const origem = previewSource === "voice" ? "voz" : "ocr";
    setExternalParsed(previewParsed);
    await handleSaveAndNext(pendingPreviewSave, origem);
    setPendingPreviewSave(null);
    setPreviewParsed(null);
  };

  const handlePreviewEdit = () => {
    setShowPreview(false);
    if (previewParsed) setExternalParsed(previewParsed);
    setPendingPreviewSave(null);
  };

  const handleOtimizarRota = useCallback(async () => {
    if (activeRouteId != null) {
      Alert.alert("Atenção", "Finalize a rota ativa antes de montar outra.");
      return;
    }
    if (withCoords.length < 2) {
      Alert.alert("Atenção", "É necessário pelo menos 2 entregas com coordenadas para otimizar.");
      return;
    }
    const runOptimize = async () => {
      setOptimizing(true);
      try {
        if (activeRouteId === null) clearActiveRouteState();
        setRouteDeliveries(withCoords);
        await optimizeRoute();
        navigation.navigate("RouteBuilder");
      } catch (e) {
        Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao otimizar rota.");
      } finally {
        setOptimizing(false);
      }
    };
    if (semEndereco > 0) {
      Alert.alert(
        "Rota parcial",
        `${semEndereco} pedido${semEndereco !== 1 ? "s" : ""} sem endereço não entrarão na rota agora.`,
        [
          { text: "Adicionar pendentes", onPress: handleNextPending },
          { text: "Continuar", onPress: () => void runOptimize() },
          { text: "Cancelar", style: "cancel" },
        ]
      );
    } else {
      await runOptimize();
    }
  }, [
    withCoords,
    semEndereco,
    activeRouteId,
    clearActiveRouteState,
    setRouteDeliveries,
    optimizeRoute,
    navigation,
    handleNextPending,
  ]);

  const handleSalvarAdvanced = async (vals: AddressFormValues, origem?: AddressOrigem) => {
    setAfterSaveMode("queue");
    await handleSaveAndNext(vals, origem ?? "manual");
  };

  const confirmOrdem = async () => {
    await setPrepOrdem(ordemDraftModo, ordemDraftServico);
    setShowOrdemModal(false);
    refreshQueue();
  };

  if (loading && total === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(16, insets.top) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Preparar Rota</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.totalValue}>{total} pedidos</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Com endereço</Text>
          <Text style={styles.value}>{comEndereco}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Pendentes</Text>
          <Text style={styles.value}>{semEndereco}</Text>
        </View>
      </View>

      <View style={styles.ordemRow}>
        <Text style={styles.ordemText}>
          Ordenação: {prepOrdemLabel(prepOrdemModo, prepServicoInicio)}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setOrdemDraftModo(prepOrdemModo);
            setOrdemDraftServico(prepServicoInicio);
            setShowOrdemModal(true);
          }}
        >
          <Text style={styles.ordemLink}>Alterar</Text>
        </TouchableOpacity>
      </View>

      {feedbackMessage ? (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.btn} onPress={handleStartScan}>
        <Text style={styles.btnText}>Escanear pacote</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnOutline, semEndereco === 0 && styles.btnDisabled]}
        onPress={handleNextPending}
        disabled={semEndereco === 0}
      >
        <Text style={styles.btnOutlineText}>Adicionar endereço ao próximo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, withCoords.length < 2 && styles.btnDisabled]}
        onPress={() => void handleOtimizarRota()}
        disabled={withCoords.length < 2 || optimizing}
      >
        {optimizing ? (
          <ActivityIndicator color={colors.primaryContrast} />
        ) : (
          <Text style={styles.btnText}>Otimizar rota</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnGhost}
        onPress={() => {
          const q = refreshQueue();
          const next = q[0];
          if (!next) {
            Alert.alert("Atenção", "Não há pedidos pendentes.");
            return;
          }
          setActiveDelivery(next);
          setAfterSaveMode("queue");
          setShowAdvancedForm(true);
        }}
      >
        <Text style={styles.btnGhostText}>Modo avançado (CEP em passos)</Text>
      </TouchableOpacity>

      <View style={[styles.listSection, { flex: 1 }]}>
        <Text style={styles.listTitle}>Pacotes</Text>
        <PrepProgressList items={progressItems} onPressItem={handleProgressPress} />
      </View>

      <PrepScanSheet
        visible={showScanSheet}
        pendingDeliveries={pendingDeliveries}
        onFound={handleScanFound}
        onClose={() => setShowScanSheet(false)}
      />

      <Modal visible={showQuickForm && activeDelivery != null} animationType="slide">
        <View style={[styles.modalWrap, { paddingTop: insets.top }]}>
          {activeDelivery && (
            <AddressQuickForm
              delivery={activeDelivery}
              flowState={flowState}
              cidadePadrao={cidadePadrao}
              estadoPadrao={estadoPadrao}
              externalParsed={externalParsed}
              onFlowStateChange={setFlowState}
              onSaveAndNext={(vals) => handleSaveAndNext(vals, "manual")}
              onDictate={handleDictate}
              onOcr={handleOcr}
              onCancel={() => {
                setShowQuickForm(false);
                setActiveDelivery(null);
              }}
            />
          )}
        </View>
      </Modal>

      <Modal visible={showAdvancedForm && activeDelivery != null} animationType="slide">
        <View style={styles.modalWrap}>
          {activeDelivery && (
            <AddressForm
              idSaida={activeDelivery.id_saida}
              initialValues={{
                destinatario: activeDelivery.cliente ?? "",
                rua: activeDelivery.endereco ?? "",
                numero: activeDelivery.numero ?? "",
                complemento: "",
                bairro: activeDelivery.bairro ?? "",
                cidade: "",
                estado: estadoPadrao,
                cep: activeDelivery.cep ?? "",
              }}
              origem="manual"
              onSave={handleSalvarAdvanced}
              onCancel={() => setShowAdvancedForm(false)}
              submitLabel="Salvar e próximo"
              enableOnlyDestinatarioShortcut
              showOcrVozIcons
              onRequestOcr={handleRequestOcrAdvanced}
              onRequestVoz={handleRequestVozAdvanced}
            />
          )}
        </View>
      </Modal>

      <AddressPreviewSheet
        visible={showPreview}
        source={previewSource}
        parsed={previewParsed}
        onSaveAndNext={() => void handlePreviewSave()}
        onEdit={handlePreviewEdit}
        onRetry={previewSource === "voice" ? handleDictate : handleOcr}
        onClose={() => setShowPreview(false)}
      />

      <GeocodeFailureSheet
        visible={showGeocodeFailure}
        addressQuery={geocodeQuery}
        onEdit={() => setShowGeocodeFailure(false)}
        onSaveWithoutCoords={() => {
          if (pendingSaveValues) {
            void commitSave(pendingSaveValues, pendingSaveOrigem, true);
          }
        }}
        onClose={() => setShowGeocodeFailure(false)}
      />

      <Modal visible={showOrdemModal} transparent animationType="fade">
        <View style={styles.ordemModalOverlay}>
          <View style={styles.ordemModalBox}>
            <Text style={styles.ordemModalTitle}>Ordenação da fila</Text>
            <TouchableOpacity
              style={[styles.ordemBtn, { backgroundColor: colors.primary }]}
              onPress={() => setOrdemDraftModo("sequencial")}
            >
              <Text
                style={[
                  styles.ordemBtnText,
                  ordemDraftModo !== "sequencial" && { opacity: 0.5 },
                ]}
              >
                Sequencial {ordemDraftModo === "sequencial" ? "✓" : ""}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ordemBtn, { backgroundColor: colors.primary }]}
              onPress={() => setOrdemDraftModo("servico")}
            >
              <Text
                style={[
                  styles.ordemBtnText,
                  ordemDraftModo !== "servico" && { opacity: 0.5 },
                ]}
              >
                Por serviço {ordemDraftModo === "servico" ? "✓" : ""}
              </Text>
            </TouchableOpacity>
            {ordemDraftModo === "servico" &&
              SERVICO_ORDER.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.ordemBtn, { backgroundColor: colors.inputBackground }]}
                  onPress={() => setOrdemDraftServico(s)}
                >
                  <Text style={{ color: colors.text, fontWeight: "600" }}>
                    {s} primeiro {ordemDraftServico === s ? "✓" : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            <TouchableOpacity
              style={[styles.ordemBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
              onPress={() => void confirmOrdem()}
            >
              <Text style={styles.ordemBtnText}>Salvar preferência</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ordemBtn, styles.ordemBtnOutline]}
              onPress={() => setShowOrdemModal(false)}
            >
              <Text style={styles.ordemBtnOutlineText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showVoiceModal && speechModule && (
        <VoiceAddressModal
          speechModule={speechModule}
          modalStyles={{
            modalOverlay: styles.voiceModalOverlay,
            modalBox: styles.voiceModalBox,
            modalTitle: styles.voiceModalTitle,
            modalMessage: styles.voiceModalMessage,
            modalBtnCancel: styles.voiceModalBtnCancel,
            modalBtnCancelText: styles.voiceModalBtnCancelText,
          }}
          onDone={handleVoiceDone}
          onCancel={handleVoiceCancel}
        />
      )}
    </View>
  );
}
