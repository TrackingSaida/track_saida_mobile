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
import PrepAddressExistsModal from "../components/PrepAddressExistsModal";
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
import {
  geocodeAddressFromValues,
  inferCoordPrecision,
  isValidGeocodeCoords,
  type GeocodeResult,
} from "../utils/geocode";
import type { EnderecoBody } from "../api";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import RoutePriorityModal from "../components/RoutePriorityModal";
import { routePriorityLabel } from "../utils/routePriority";
import { formatApiError } from "../../../utils/formatApiError";
import { deliveryToFreeText } from "../utils/deliveryAddress";
import {
  enrichParsedAddress,
  formatAddressSummary,
  isGooglePendingSuggestion,
  isSelectableAddressSuggestion,
  needsAddressEnrichment,
  resetAddressSessionToken,
  resolveGooglePlaceSuggestion,
  suggestionToParsed,
  type AddressSuggestion,
} from "../utils/addressSuggestions";

type Props = NativeStackScreenProps<RootStackParamList, "PrepareDeliveries">;

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
    optimizeRoute,
    reconcileActiveRoute,
  } = useDeliveryStore();

  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const prepOrdemModo = useMotoboyPrefsStore((s) => s.prepOrdemModo);
  const prepServicoInicio = useMotoboyPrefsStore((s) => s.prepServicoInicio);
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const setPrepOrdem = useMotoboyPrefsStore((s) => s.setPrepOrdem);
  const routePriority = useMotoboyPrefsStore((s) => s.routePriority);
  const setRoutePriority = useMotoboyPrefsStore((s) => s.setRoutePriority);

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

  const [showPreview, setShowPreview] = useState(false);
  const [previewParsed, setPreviewParsed] = useState<ParsedAddress | null>(null);
  const [previewSource, setPreviewSource] = useState<"voice" | "ocr">("voice");
  const [pendingPreviewSave, setPendingPreviewSave] = useState<{
    values: AddressFormValues;
    coords: GeocodeResult | null;
    origem: AddressOrigem;
  } | null>(null);
  const [previewSuggestions, setPreviewSuggestions] = useState<AddressSuggestion[]>([]);
  const [previewDidYouMean, setPreviewDidYouMean] = useState<AddressSuggestion | null>(null);
  const [previewSuggestionsLoading, setPreviewSuggestionsLoading] = useState(false);
  const [previewSelectedSuggestionId, setPreviewSelectedSuggestionId] = useState<string | null>(null);
  const [previewAutoApplied, setPreviewAutoApplied] = useState(false);

  const [showGeocodeFailure, setShowGeocodeFailure] = useState(false);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [pendingSaveValues, setPendingSaveValues] = useState<AddressFormValues | null>(null);
  const [pendingSaveOrigem, setPendingSaveOrigem] = useState<AddressOrigem>("manual");

  const [showOrdemModal, setShowOrdemModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
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
      setFlowState("geocoding");
      try {
        if (!opts.skipGeocodeCheck) {
          const geoDefaults = {
            cidade: (vals.cidade ?? "").trim() || cidadePadrao,
            estado: (vals.estado ?? "").trim() || estadoPadrao,
          };
          const hasClientCoords = isValidGeocodeCoords(opts.coords?.latitude, opts.coords?.longitude);
          const geo =
            hasClientCoords && (origem === "google_places" || origem === "suggestion")
              ? opts.coords!
              : hasClientCoords
                ? opts.coords!
                : await geocodeAddressFromValues(vals, geoDefaults, {
                    enderecoFormatado: formatAddressSummary(vals),
                  });
          if (!geo) {
            setPendingSaveValues(vals);
            setPendingSaveOrigem(origem);
            setGeocodeQuery(formatAddressSummary(vals));
            setShowGeocodeFailure(true);
            setFlowState("idle");
            return;
          }
          const body: EnderecoBody = {
            ...vals,
            origem,
            latitude: geo.latitude,
            longitude: geo.longitude,
            coord_precision: inferCoordPrecision(origem),
          };
          setFlowState("saving");
          await saveAddress(activeDelivery.id_saida, body);
        } else {
          setFlowState("saving");
          await saveAddress(activeDelivery.id_saida, { ...vals, origem });
        }
        setFeedbackMessage(
          formMode === "edit" ? "Endereço atualizado." : "Endereço salvo. Próximo pacote."
        );
        setExternalParsed(null);
        setShowGeocodeFailure(false);
        setPendingSaveValues(null);
        setFormMode("new");

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
      showAdvancedForm,
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
    },
    []
  );

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

  const setPreviewPending = useCallback(
    (
      values: AddressFormValues,
      opts?: { coords?: GeocodeResult | null; origem?: AddressOrigem; fromSuggestion?: boolean }
    ) => {
      const coords = opts?.coords ?? null;
      const origem =
        opts?.origem ??
        (opts?.fromSuggestion && isValidGeocodeCoords(coords?.latitude, coords?.longitude)
          ? "suggestion"
          : previewSource === "voice"
            ? "voz"
            : "ocr");
      setPendingPreviewSave({ values, coords, origem });
    },
    [previewSource]
  );

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

  const mergePreviewValues = useCallback(
    (vals: AddressFormValues): AddressFormValues => ({
      ...vals,
      destinatario: vals.destinatario.trim() || activeDelivery?.cliente || "",
    }),
    [activeDelivery?.cliente]
  );

  const openPreviewWithEnrichment = useCallback(
    async (parsed: ParsedAddress, source: "voice" | "ocr") => {
      setPreviewParsed(parsed);
      setPreviewSource(source);
      setPreviewPending(mergePreviewValues(parsedToFormValues(parsed)));
      setPreviewSuggestions([]);
      setPreviewDidYouMean(null);
      setPreviewSelectedSuggestionId(null);
      setPreviewAutoApplied(false);
      setShowPreview(true);

      if (!needsAddressEnrichment(parsedToFormValues(parsed))) return;

      setPreviewSuggestionsLoading(true);
      try {
        const { suggestions, autoSelected, didYouMean } = await enrichParsedAddress(parsed, {
          cidade: cidadePadrao || undefined,
          estado: estadoPadrao || undefined,
        });
        setPreviewSuggestions(suggestions);
        setPreviewDidYouMean(didYouMean);
        if (autoSelected) {
          const enriched = suggestionToParsed(autoSelected);
          setPreviewParsed(enriched);
          setPreviewPending(mergePreviewValues(autoSelected.values), {
            coords: { latitude: autoSelected.latitude, longitude: autoSelected.longitude },
            fromSuggestion: true,
          });
          setPreviewSelectedSuggestionId(autoSelected.id);
          setPreviewAutoApplied(true);
        }
      } finally {
        setPreviewSuggestionsLoading(false);
      }
    },
    [cidadePadrao, estadoPadrao, mergePreviewValues, setPreviewPending]
  );

  const handlePreviewSelectSuggestion = useCallback(
    async (s: AddressSuggestion) => {
      if (!isSelectableAddressSuggestion(s)) return;
      let resolved = s;
      if (isGooglePendingSuggestion(s)) {
        setPreviewSuggestionsLoading(true);
        const full = await resolveGooglePlaceSuggestion(s, {
          defaults: { cidade: cidadePadrao, estado: estadoPadrao },
        });
        setPreviewSuggestionsLoading(false);
        if (!full) {
          Alert.alert("Endereço", "Não foi possível obter os detalhes deste endereço.");
          return;
        }
        resolved = full;
        resetAddressSessionToken();
      }
      const enriched = suggestionToParsed(resolved);
      setPreviewParsed(enriched);
      setPreviewPending(mergePreviewValues(resolved.values), {
        coords: { latitude: resolved.latitude, longitude: resolved.longitude },
        origem: resolved.provider === "google_places" ? "google_places" : "suggestion",
        fromSuggestion: resolved.provider !== "google_places",
      });
      setPreviewSelectedSuggestionId(resolved.id);
      setPreviewAutoApplied(false);
    },
    [cidadePadrao, estadoPadrao, mergePreviewValues, setPreviewPending]
  );

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
      await openPreviewWithEnrichment(parsed, "ocr");
    } catch {
      Alert.alert("Erro", "Não foi possível ler a imagem.");
    } finally {
      setFlowState("idle");
    }
  }, [captureOcrParsed, openPreviewWithEnrichment]);

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
      void openPreviewWithEnrichment(parsed, "voice");
      setFlowState("idle");
    },
    [cidadePadrao, estadoPadrao, showAdvancedForm, openPreviewWithEnrichment]
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
    setExternalParsed(previewParsed);
    await handleSaveAndNext(
      pendingPreviewSave.values,
      pendingPreviewSave.origem,
      pendingPreviewSave.coords
    );
    setPendingPreviewSave(null);
    setPreviewParsed(null);
  };

  const handlePreviewEdit = () => {
    setShowPreview(false);
    if (previewParsed) setExternalParsed(previewParsed);
    setPendingPreviewSave(null);
  };

  const handleCriarRota = useCallback(async () => {
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
    const runCreate = async () => {
      setOptimizing(true);
      try {
        clearActiveRouteState();
        setRouteDeliveries(withCoords);
        await optimizeRoute();
        navigation.navigate("RouteBuilder");
      } catch (e) {
        Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao criar rota.");
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
          { text: "Continuar", onPress: () => void runCreate() },
          { text: "Cancelar", style: "cancel" },
        ]
      );
    } else {
      await runCreate();
    }
  }, [
    withCoords,
    semEndereco,
    clearActiveRouteState,
    setRouteDeliveries,
    optimizeRoute,
    navigation,
    handleNextPending,
    reconcileActiveRoute,
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

      <View style={styles.ordemRow}>
        <Text style={styles.ordemText}>
          Priorizar por:{" "}
          {routePriority.type === "delivery"
            ? routePriorityLabel(
                routePriority,
                withCoords.find((d) => d.id_saida === routePriority.idSaida)?.codigo ?? undefined
              )
            : routePriorityLabel(routePriority)}
        </Text>
        <TouchableOpacity onPress={() => setShowPriorityModal(true)}>
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
        onPress={() => void handleCriarRota()}
        disabled={withCoords.length < 2 || optimizing}
      >
        {optimizing ? (
          <ActivityIndicator color={colors.primaryContrast} />
        ) : (
          <Text style={styles.btnText}>Criar rota</Text>
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
        <PrepProgressList
          items={progressItems}
          onPressItem={handleProgressPress}
          onEditAddress={handleEditAddress}
        />
      </View>

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
        <View style={[styles.modalWrap, { paddingTop: insets.top }]}>
          {activeDelivery && (
            <AddressQuickForm
              key={`${activeDelivery.id_saida}-${formMode}`}
              delivery={activeDelivery}
              flowState={flowState}
              cidadePadrao={cidadePadrao}
              estadoPadrao={estadoPadrao}
              knownDeliveries={knownDeliveriesForForm}
              initialFreeText={
                formMode === "edit" ? deliveryToFreeText(activeDelivery) : ""
              }
              submitLabel={formMode === "edit" ? "Salvar endereço" : "Salvar e próximo"}
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
        suggestions={previewSuggestions}
        suggestionsLoading={previewSuggestionsLoading}
        selectedSuggestionId={previewSelectedSuggestionId}
        autoApplied={previewAutoApplied}
        didYouMean={previewDidYouMean}
        onSelectSuggestion={handlePreviewSelectSuggestion}
        onSaveAndNext={() => void handlePreviewSave()}
        onEdit={handlePreviewEdit}
        onRetry={previewSource === "voice" ? handleDictate : handleOcr}
        onClose={() => setShowPreview(false)}
      />

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

      <RoutePriorityModal
        visible={showPriorityModal}
        current={routePriority}
        packages={withCoords}
        onClose={() => setShowPriorityModal(false)}
        onSave={(p) => void setRoutePriority(p)}
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
