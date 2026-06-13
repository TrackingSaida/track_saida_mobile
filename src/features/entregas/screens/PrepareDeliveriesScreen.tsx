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
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import PrepAddressSaveSuccess from "../components/PrepAddressSaveSuccess";
import AddressQuickForm, {
  type AddressQuickFormHandle,
  type InlineFeedback,
  type PrepAddressOrigem,
  type QuickFormFlowState,
} from "../components/AddressQuickForm";
import { useDeliveryStore } from "../../../store/deliveryStore";
import AddressForm, {
  type AddressFormValues,
  type AddressOrigem,
  type AddressCandidate,
} from "../components/AddressForm";
import GeocodeFailureSheet from "../components/GeocodeFailureSheet";
import PrepProgressList from "../components/PrepProgressList";
import PrepAddressExistsModal from "../components/PrepAddressExistsModal";
import PrepScanSheet from "../components/PrepScanSheet";
import PrepSeparatePackagesSheet from "../components/PrepSeparatePackagesSheet";
import VoiceAddressModal from "../components/VoiceAddressModal";
import type { EntregaListItem } from "../types";
import {
  buildPrepQueue,
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
import {
  geocodeAddressFromValues,
  inferCoordPrecision,
  isValidGeocodeCoords,
  type GeocodeResult,
} from "../utils/geocode";
import type { EnderecoBody } from "../api";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { formatApiError } from "../../../utils/formatApiError";
import { operationalIcons } from "../../../theme/operationalIcons";
import {
  derivePrepFlowView,
  type PrepPrimaryAction,
  type PrepSecondaryAction,
} from "../utils/prepFlowState";
import { runOptimizeRouteWithFeedback } from "../utils/optimizeRouteFeedback";
import { deliveryToFreeText } from "../utils/deliveryAddress";
import { formatAddressSummary } from "../utils/addressSuggestions";

type Props = NativeStackScreenProps<RootStackParamList, "PrepareDeliveries">;

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type AfterSaveMode = "scan" | "queue" | "none";
type FormMode = "new" | "edit";

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
    routeOrder,
    routeDeliveries,
    routeSeparationAcknowledged,
    acknowledgeRouteSeparation,
    optimizeRoute,
    startActiveRoute,
    reconcileActiveRoute,
  } = useDeliveryStore();

  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const prepOrdemModo = useMotoboyPrefsStore((s) => s.prepOrdemModo);
  const prepServicoInicio = useMotoboyPrefsStore((s) => s.prepServicoInicio);
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const setPrepOrdem = useMotoboyPrefsStore((s) => s.setPrepOrdem);

  const [showScanSheet, setShowScanSheet] = useState(false);
  const [addressExistsDelivery, setAddressExistsDelivery] = useState<EntregaListItem | null>(
    null
  );
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<EntregaListItem | null>(null);
  const [queue, setQueue] = useState<EntregaListItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [afterSaveMode, setAfterSaveMode] = useState<AfterSaveMode>("none");
  const [formMode, setFormMode] = useState<FormMode>("new");
  const [flowState, setFlowState] = useState<QuickFormFlowState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [externalParsed, setExternalParsed] = useState<ParsedAddress | null>(null);
  const [postSaveSuccess, setPostSaveSuccess] = useState<{
    summaryLines: string[];
    remaining: number;
  } | null>(null);
  const [quickFormInlineFeedback, setQuickFormInlineFeedback] = useState<InlineFeedback>(null);
  const [voiceSessionKey, setVoiceSessionKey] = useState(0);
  const quickFormRef = useRef<AddressQuickFormHandle>(null);

  const [showGeocodeFailure, setShowGeocodeFailure] = useState(false);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [pendingSaveValues, setPendingSaveValues] = useState<AddressFormValues | null>(null);
  const [pendingSaveOrigem, setPendingSaveOrigem] = useState<AddressOrigem>("manual");

  const [showOrdemModal, setShowOrdemModal] = useState(false);
  const [ordemDraftModo, setOrdemDraftModo] = useState<PrepOrdemModo>(prepOrdemModo);
  const [ordemDraftServico, setOrdemDraftServico] = useState<ServicoTipo>(prepServicoInicio);
  const [optimizing, setOptimizing] = useState(false);
  const [showSeparationSheet, setShowSeparationSheet] = useState(false);

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
        statusChip: {
          alignSelf: "flex-start",
          marginTop: 8,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
        },
        statusChipText: { fontSize: 12, fontWeight: "700" },
        statusHint: {
          marginTop: 8,
          fontSize: 13,
          color: colors.warning,
          lineHeight: 18,
        },
        statusMessage: {
          marginHorizontal: 20,
          marginBottom: 10,
          fontSize: 13,
          color: colors.success,
          fontWeight: "600",
          textAlign: "center",
        },
        btnInner: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
        btnOutlineInner: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
        btnOutlineTextWrap: {
          flex: 1,
          alignItems: "center",
        },
        btnOutlineSubtext: {
          fontSize: 12,
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: 2,
        },
        actionsBlock: { marginBottom: 8 },
        linkBtn: {
          marginHorizontal: 20,
          paddingVertical: 8,
          alignItems: "center",
          marginBottom: 8,
        },
        linkBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
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

  const prepFlow = useMemo(
    () =>
      derivePrepFlowView({
        totalPedidos: total,
        comEndereco,
        semEndereco,
        withCoordsCount: withCoords.length,
        routeOrderLength: routeOrder.length,
        activeRouteId,
        separationViewed: routeSeparationAcknowledged,
      }),
    [
      total,
      comEndereco,
      semEndereco,
      withCoords.length,
      routeOrder.length,
      activeRouteId,
      routeSeparationAcknowledged,
    ]
  );

  const statusChipStyle = useMemo(() => {
    switch (prepFlow.statusChip) {
      case "ready":
      case "route_ready":
        return { bg: colors.success + "22", fg: colors.success };
      case "missing_addresses":
        return { bg: colors.warning + "22", fg: colors.warning };
      case "route_active":
        return { bg: colors.primary + "22", fg: colors.primary };
      default:
        return { bg: colors.chipBackground, fg: colors.textSecondary };
    }
  }, [prepFlow.statusChip, colors]);

  const knownDeliveriesForForm = useMemo(() => {
    if (!activeDelivery) return deliveriesWithAddress;
    return deliveriesWithAddress.filter((d) => d.id_saida !== activeDelivery.id_saida);
  }, [deliveriesWithAddress, activeDelivery]);

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

  type CommitSaveOptions = {
    skipGeocodeCheck?: boolean;
    coords?: GeocodeResult | null;
  };

  const commitSave = useCallback(
    async (
      vals: AddressFormValues,
      origem: AddressOrigem,
      options: CommitSaveOptions | boolean = {}
    ) => {
      if (!activeDelivery) return;
      const opts: CommitSaveOptions =
        typeof options === "boolean" ? { skipGeocodeCheck: options } : options;

      const finalVals: AddressFormValues = {
        ...vals,
        destinatario:
          (vals.destinatario ?? "").trim() || (activeDelivery.cliente ?? "").trim() || "—",
        rua: (vals.rua ?? "").trim(),
        numero: (vals.numero ?? "").trim(),
        bairro: (vals.bairro ?? "").trim(),
        complemento: (vals.complemento ?? "").trim(),
        cidade: (vals.cidade ?? "").trim() || cidadePadrao,
        estado: (vals.estado ?? "").trim() || estadoPadrao,
        cep: (vals.cep ?? "").replace(/\D/g, ""),
      };

      const missingRequired =
        !finalVals.rua ||
        !finalVals.numero ||
        !finalVals.bairro ||
        finalVals.cep.length !== 8;

      if (missingRequired) {
        setExternalParsed(finalVals);
        setShowQuickForm(false);
        setShowAdvancedForm(true);
        setFeedbackMessage("Complete os campos faltantes para salvar.");
        setFlowState("idle");
        return;
      }

      setFlowState("geocoding");
      try {
        if (!opts.skipGeocodeCheck) {
          const geoDefaults = {
            cidade: finalVals.cidade,
            estado: finalVals.estado,
          };
          const hasClientCoords = isValidGeocodeCoords(opts.coords?.latitude, opts.coords?.longitude);
          const geo =
            hasClientCoords && (origem === "google_places" || origem === "suggestion")
              ? opts.coords!
              : hasClientCoords
                ? opts.coords!
                : await geocodeAddressFromValues(finalVals, geoDefaults);
          if (!geo) {
            setPendingSaveValues(finalVals);
            setPendingSaveOrigem(origem);
            setGeocodeQuery(formatAddressSummary(finalVals));
            setShowGeocodeFailure(true);
            setFlowState("idle");
            return;
          }
          const body: EnderecoBody = {
            ...finalVals,
            origem,
            latitude: geo.latitude,
            longitude: geo.longitude,
            coord_precision: inferCoordPrecision(origem),
          };
          setFlowState("saving");
          await saveAddress(activeDelivery.id_saida, body);
        } else {
          setFlowState("saving");
          await saveAddress(activeDelivery.id_saida, { ...finalVals, origem });
        }
        setFeedbackMessage(
          formMode === "edit" ? "Endereço atualizado." : "Endereço salvo."
        );
        setExternalParsed(null);
        setShowGeocodeFailure(false);
        setPendingSaveValues(null);
        setFormMode("new");
        setQuickFormInlineFeedback(null);

        const summaryLines = [
          [finalVals.rua, finalVals.numero].filter(Boolean).join(", "),
          finalVals.bairro,
          [finalVals.cidade, finalVals.estado].filter(Boolean).join("/"),
        ].filter((line) => !!(line && line.trim()));

        if (afterSaveMode === "scan") {
          setShowQuickForm(false);
          setShowAdvancedForm(false);
          setActiveDelivery(null);
          setPostSaveSuccess(null);
          setFeedbackMessage("✓ Endereço salvo");
          setTimeout(() => setShowScanSheet(true), 400);
        } else if (afterSaveMode === "queue") {
          refreshQueue();
          const remaining = useDeliveryStore.getState().deliveriesWithoutAddress.length;
          setPostSaveSuccess({ summaryLines, remaining });
        } else {
          setShowQuickForm(false);
          setShowAdvancedForm(false);
          setActiveDelivery(null);
          setPostSaveSuccess(null);
        }
      } catch (e) {
        Alert.alert(
          "Erro ao salvar",
          formatApiError(e, "Não foi possível salvar. Tente novamente.")
        );
      } finally {
        setFlowState("idle");
      }
    },
    [
      activeDelivery,
      saveAddress,
      afterSaveMode,
      formMode,
      refreshQueue,
      cidadePadrao,
      estadoPadrao,
    ]
  );

  const openAddressForm = useCallback(
    (delivery: EntregaListItem, options: { mode: FormMode; afterSave: AfterSaveMode }) => {
      setShowScanSheet(false);
      setActiveDelivery(delivery);
      setFormMode(options.mode);
      setAfterSaveMode(options.afterSave);
      setShowQuickForm(true);
      setShowAdvancedForm(false);
      setExternalParsed(null);
      setPostSaveSuccess(null);
      setQuickFormInlineFeedback(null);
    },
    []
  );

  const prepOrigem = useMemo((): PrepAddressOrigem => {
    if (formMode === "edit") return "none";
    if (afterSaveMode === "scan") return "qr";
    if (afterSaveMode === "queue") return "pendente";
    return "none";
  }, [afterSaveMode, formMode]);

  const quickFormSubmitLabel = useMemo(() => {
    if (formMode === "edit") return "Salvar endereço";
    if (afterSaveMode === "scan") return "Salvar e escanear próximo";
    return "Salvar e próximo";
  }, [afterSaveMode, formMode]);

  const handleNextPackageFromSuccess = useCallback(() => {
    const q = refreshQueue();
    const next = q.find((d) => !d.possui_endereco) ?? null;
    setPostSaveSuccess(null);
    setExternalParsed(null);
    setQuickFormInlineFeedback(null);
    if (next) {
      setActiveDelivery(next);
      setQueueIndex(q.indexOf(next));
      setShowQuickForm(true);
    } else {
      setShowQuickForm(false);
      setActiveDelivery(null);
    }
  }, [refreshQueue]);

  const handleClosePostSaveSuccess = useCallback(() => {
    setPostSaveSuccess(null);
    setShowQuickForm(false);
    setActiveDelivery(null);
    setExternalParsed(null);
    setQuickFormInlineFeedback(null);
  }, []);

  const handleSaveAndNext = useCallback(
    async (
      vals: AddressFormValues,
      origem: AddressOrigem = "manual",
      coords?: GeocodeResult | null
    ) => {
      await commitSave(vals, origem, { coords });
    },
    [commitSave]
  );

  const injectAddressIntoQuickForm = useCallback((parsed: ParsedAddress, rawText: string) => {
    const text =
      rawText.trim() ||
      (parsed.rawText ?? "").trim() ||
      formatAddressSummary(parsedToFormValues(parsed));
    setExternalParsed({ ...parsed, rawText: text });
    setFlowState("idle");
  }, []);

  const handleScanFound = (delivery: EntregaListItem) => {
    if (delivery.possui_endereco) {
      setAddressExistsDelivery(delivery);
      return;
    }
    openAddressForm(delivery, { mode: "new", afterSave: "scan" });
  };

  const handleAddressExistsEdit = () => {
    const delivery = addressExistsDelivery;
    setAddressExistsDelivery(null);
    if (delivery) {
      openAddressForm(delivery, { mode: "edit", afterSave: "none" });
    }
  };

  const handleAddressExistsDismiss = () => {
    setAddressExistsDelivery(null);
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
    openAddressForm(next, { mode: "new", afterSave: "queue" });
  };

  const handleProgressPress = (item: EntregaListItem) => {
    if (item.possui_endereco) return;
    const q = refreshQueue();
    setQueue(q);
    setQueueIndex(q.findIndex((d) => d.id_saida === item.id_saida));
    openAddressForm(item, { mode: "new", afterSave: "queue" });
  };

  const handleEditAddress = (item: EntregaListItem) => {
    openAddressForm(item, { mode: "edit", afterSave: "none" });
  };

  const captureOcrParsed = useCallback(async (): Promise<
    ParsedAddress | null | "failed"
  > => {
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
    const parsed = pickBestOcrAddress(lines);
    return parsed ?? "failed";
  }, []);

  const showOcrFailureAlert = useCallback((onRetry: () => void) => {
    Alert.alert(
      "Endereço na foto",
      "Não foi possível identificar o endereço na imagem.",
      [
        { text: "Tentar novamente", onPress: onRetry },
        {
          text: "Digitar manualmente",
          style: "cancel",
          onPress: () => quickFormRef.current?.focusAddress(),
        },
      ]
    );
  }, []);

  const runOcrFlow = useCallback(async () => {
    setFlowState("parsing");
    setQuickFormInlineFeedback({ message: "📷 Analisando imagem…", tone: "info" });
    try {
      const parsed = await captureOcrParsed();
      if (parsed === null) {
        setFlowState("idle");
        setQuickFormInlineFeedback(null);
        return;
      }
      if (parsed === "failed") {
        setFlowState("idle");
        setQuickFormInlineFeedback({
          message: "⚠ Não foi possível identificar o endereço na imagem",
          tone: "warning",
        });
        showOcrFailureAlert(() => void runOcrFlow());
        return;
      }
      setQuickFormInlineFeedback({ message: "✓ Endereço encontrado", tone: "success" });
      injectAddressIntoQuickForm(parsed, parsed.rawText ?? "");
      setFlowState("idle");
      setTimeout(() => setQuickFormInlineFeedback(null), 2500);
    } catch {
      setFlowState("idle");
      setQuickFormInlineFeedback(null);
      Alert.alert("Erro", "Não foi possível ler a imagem.");
    }
  }, [captureOcrParsed, injectAddressIntoQuickForm, showOcrFailureAlert]);

  const handleOcr = useCallback(() => {
    void runOcrFlow();
  }, [runOcrFlow]);

  const handleRequestOcrAdvanced = useCallback(async () => {
    const parsed = await captureOcrParsed();
    if (!parsed || parsed === "failed") return null;
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

  const handleVoiceRetry = useCallback(() => {
    setVoiceSessionKey((k) => k + 1);
    setFlowState("listening");
  }, []);

  const handleVoiceFocusManual = useCallback(() => {
    quickFormRef.current?.focusAddress();
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
      injectAddressIntoQuickForm(parsed, transcript);
      setQuickFormInlineFeedback({ message: "✓ Endereço reconhecido", tone: "success" });
      setTimeout(() => setQuickFormInlineFeedback(null), 2500);
    },
    [cidadePadrao, estadoPadrao, showAdvancedForm, injectAddressIntoQuickForm]
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

  const handleGerarRotaOtimizada = useCallback(async () => {
    if (useDeliveryStore.getState().activeRouteId != null) {
      await reconcileActiveRoute();
    }
    if (useDeliveryStore.getState().activeRouteId != null) {
      Alert.alert("Atenção", "Finalize a rota ativa antes de montar outra.", [
        { text: "Continuar rota", onPress: () => navigation.navigate("RouteBuilder") },
        { text: "Cancelar", style: "cancel" },
      ]);
      return;
    }
    if (withCoords.length < 2) {
      Alert.alert("Atenção", "É necessário pelo menos 2 entregas com coordenadas para criar a rota.");
      return;
    }
    setOptimizing(true);
    try {
      clearActiveRouteState();
      setRouteDeliveries(withCoords);
      const result = await runOptimizeRouteWithFeedback(optimizeRoute);
      if (!result?.ok) return;
      navigation.navigate("RouteBuilder", { highlightLocatePackage: true });
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao criar rota.");
    } finally {
      setOptimizing(false);
    }
  }, [
    withCoords,
    clearActiveRouteState,
    setRouteDeliveries,
    optimizeRoute,
    navigation,
    reconcileActiveRoute,
  ]);

  const handleIniciarRota = useCallback(async () => {
    if (activeRouteId != null) {
      navigation.navigate("RouteBuilder");
      return;
    }
    if (routeOrder.length === 0) {
      Alert.alert("Atenção", "Gere a rota antes de iniciar a entrega.");
      return;
    }
    if (withCoords.length < 2) {
      Alert.alert("Atenção", "É necessário pelo menos 2 entregas com coordenadas para iniciar a rota.");
      return;
    }
    setOptimizing(true);
    try {
      await startActiveRoute();
      navigation.navigate("RouteBuilder");
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao iniciar rota.");
    } finally {
      setOptimizing(false);
    }
  }, [activeRouteId, routeOrder.length, withCoords.length, startActiveRoute, navigation]);

  const handleOpenAdvancedForm = useCallback(() => {
    const q = refreshQueue();
    const next = q[0];
    if (!next) {
      Alert.alert("Atenção", "Não há pedidos pendentes.");
      return;
    }
    setActiveDelivery(next);
    setAfterSaveMode("queue");
    setShowAdvancedForm(true);
  }, [refreshQueue]);

  const handlePrimaryAction = useCallback(() => {
    switch (prepFlow.primaryAction) {
      case "scan":
        handleStartScan();
        break;
      case "add_address":
        handleNextPending();
        break;
      case "generate_route":
        void handleGerarRotaOtimizada();
        break;
      case "separate_packages":
        setShowSeparationSheet(true);
        break;
      case "start_route":
        void handleIniciarRota();
        break;
      default:
        break;
    }
  }, [
    prepFlow.primaryAction,
    handleGerarRotaOtimizada,
    handleIniciarRota,
    handleStartScan,
    handleNextPending,
  ]);

  const handleSecondaryAction = useCallback(
    (action: PrepSecondaryAction) => {
      switch (action) {
        case "scan_more":
          handleStartScan();
          break;
        case "edit_ordering":
          setOrdemDraftModo(prepOrdemModo);
          setOrdemDraftServico(prepServicoInicio);
          setShowOrdemModal(true);
          break;
        case "locate_package":
          navigation.navigate("RouteBuilder", { openLocatePackage: true });
          break;
        case "open_route_builder":
          navigation.navigate("RouteBuilder");
          break;
        default:
          break;
      }
    },
    [navigation, prepOrdemModo, prepServicoInicio]
  );

  const primaryDisabled =
    optimizing ||
    (prepFlow.primaryAction === "generate_route" && withCoords.length < 2) ||
    (prepFlow.primaryAction === "start_route" &&
      routeOrder.length === 0 &&
      activeRouteId == null);

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
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Preparar Rota"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />

      <View style={styles.card}>
        <Text style={styles.totalValue}>{total} pedidos</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Prontos para rota</Text>
          <Text style={styles.value}>{prepFlow.prontosParaRota}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Precisam de endereço</Text>
          <Text style={styles.value}>{prepFlow.precisamEndereco}</Text>
        </View>
        {prepFlow.statusChipLabel ? (
          <View style={[styles.statusChip, { backgroundColor: statusChipStyle.bg }]}>
            <Text style={[styles.statusChipText, { color: statusChipStyle.fg }]}>
              {prepFlow.statusChipLabel}
            </Text>
          </View>
        ) : null}
        {prepFlow.statusHint ? (
          <Text style={styles.statusHint}>{prepFlow.statusHint}</Text>
        ) : null}
      </View>

      {feedbackMessage ? (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
        </View>
      ) : null}

      {prepFlow.addressCompleteMessage ? (
        <Text style={styles.statusMessage}>{prepFlow.addressCompleteMessage}</Text>
      ) : null}

      <View style={styles.actionsBlock}>
        <TouchableOpacity
          style={[styles.btn, primaryDisabled && styles.btnDisabled]}
          onPress={handlePrimaryAction}
          disabled={primaryDisabled}
          activeOpacity={0.92}
        >
          {optimizing &&
          (prepFlow.primaryAction === "generate_route" ||
            prepFlow.primaryAction === "start_route") ? (
            <ActivityIndicator color={colors.primaryContrast} />
          ) : (
            <View style={styles.btnInner}>
              <Ionicons
                name={operationalIcons[prepFlow.primaryIconKey] as IoniconName}
                size={20}
                color={colors.primaryContrast}
              />
              <Text style={styles.btnText}>{prepFlow.primaryLabel}</Text>
            </View>
          )}
        </TouchableOpacity>

        {prepFlow.secondaryActions.map((sec) => (
          <TouchableOpacity
            key={sec.action}
            style={styles.btnOutline}
            onPress={() => handleSecondaryAction(sec.action)}
            activeOpacity={0.85}
          >
            <View style={styles.btnOutlineInner}>
              <Ionicons
                name={operationalIcons[sec.iconKey] as IoniconName}
                size={18}
                color={colors.primary}
              />
              <View style={sec.subtitle ? styles.btnOutlineTextWrap : undefined}>
                <Text style={styles.btnOutlineText}>{sec.label}</Text>
                {sec.subtitle ? (
                  <Text style={styles.btnOutlineSubtext}>{sec.subtitle}</Text>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.linkBtn} onPress={handleOpenAdvancedForm} activeOpacity={0.85}>
          <Text style={styles.linkBtnText}>Opções de preenchimento</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.listSection, { flex: 1 }]}>
        <Text style={styles.listTitle}>Pacotes</Text>
        <PrepProgressList
          items={progressItems}
          onPressItem={handleProgressPress}
          onEditAddress={handleEditAddress}
        />
      </View>

      <PrepSeparatePackagesSheet
        visible={showSeparationSheet}
        routeDeliveries={routeDeliveries}
        routeOrder={routeOrder}
        onConfirm={() => {
          acknowledgeRouteSeparation();
          setShowSeparationSheet(false);
        }}
        onClose={() => setShowSeparationSheet(false)}
      />

      <PrepScanSheet
        visible={showScanSheet}
        pendingDeliveries={pendingDeliveries}
        onFound={handleScanFound}
        onClose={() => {
          setShowScanSheet(false);
          setAddressExistsDelivery(null);
        }}
      />

      <PrepAddressExistsModal
        visible={addressExistsDelivery != null}
        delivery={addressExistsDelivery}
        onEdit={handleAddressExistsEdit}
        onDismiss={handleAddressExistsDismiss}
      />

      <Modal visible={showQuickForm && activeDelivery != null} animationType="slide">
        <View style={[styles.modalWrap, { flex: 1 }]}>
          <ScreenHeaderBar
            title="Preparar rota"
            onBack={() => {
              setShowQuickForm(false);
              setActiveDelivery(null);
              setFormMode("new");
              setPostSaveSuccess(null);
              setQuickFormInlineFeedback(null);
            }}
            paddingTop={Math.max(12, insets.top)}
          />
          {activeDelivery && postSaveSuccess ? (
            <PrepAddressSaveSuccess
              summaryLines={postSaveSuccess.summaryLines}
              remaining={postSaveSuccess.remaining}
              onNext={handleNextPackageFromSuccess}
              onDone={handleClosePostSaveSuccess}
            />
          ) : activeDelivery ? (
            <AddressQuickForm
              ref={quickFormRef}
              key={`${activeDelivery.id_saida}-${formMode}`}
              delivery={activeDelivery}
              flowState={flowState}
              prepOrigem={prepOrigem}
              cidadePadrao={cidadePadrao}
              estadoPadrao={estadoPadrao}
              knownDeliveries={knownDeliveriesForForm}
              initialFreeText={
                formMode === "edit" ? deliveryToFreeText(activeDelivery) : ""
              }
              submitLabel={quickFormSubmitLabel}
              inlineFeedback={quickFormInlineFeedback}
              externalParsed={externalParsed}
              onFlowStateChange={setFlowState}
              onSaveAndNext={(vals, coords, origem) =>
                handleSaveAndNext(vals, origem ?? "manual", coords)
              }
              onDictate={handleDictate}
              onOcr={handleOcr}
              onCancel={() => {
                setShowQuickForm(false);
                setActiveDelivery(null);
                setFormMode("new");
                setPostSaveSuccess(null);
                setQuickFormInlineFeedback(null);
              }}
            />
          ) : null}
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

      <GeocodeFailureSheet
        visible={showGeocodeFailure}
        addressQuery={geocodeQuery}
        onEdit={() => setShowGeocodeFailure(false)}
        onChooseSuggestion={() => {
          setShowGeocodeFailure(false);
          if (!showQuickForm && activeDelivery) setShowQuickForm(true);
        }}
        onSaveWithoutCoords={() => {
          if (pendingSaveValues) {
            void commitSave(pendingSaveValues, pendingSaveOrigem, { skipGeocodeCheck: true });
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
          key={voiceSessionKey}
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
          onRetry={handleVoiceRetry}
          onFocusManual={handleVoiceFocusManual}
        />
      )}
    </View>
  );
}
