import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";
import type { AddressFormValues, AddressOrigem } from "./AddressForm";
import {
  parseFreeTextAddress,
  parsedToFormValues,
  type ParsedAddress,
} from "../utils/ocrAddress";
import {
  buildSearchQuery,
  filterSelectableSuggestions,
  findLocalAddressSuggestions,
  formatAddressSummary,
  formatSelectedAddress,
  isGooglePendingSuggestion,
  isSelectableAddressSuggestion,
  resetAddressSessionToken,
  resolveGooglePlaceSuggestion,
  sanitizeAddressFormValues,
  needsAddressEnrichment,
  searchAddressSuggestions,
  type AddressSuggestion,
  AddressSearchError,
} from "../utils/addressSuggestions";
import AddressSuggestionList from "./AddressSuggestionList";
import { isValidGeocodeCoords, type GeocodeResult } from "../utils/geocode";
import { deriveAddressVisualStatus } from "../utils/deriveAddressVisualStatus";

export type QuickFormFlowState =
  | "idle"
  | "listening"
  | "parsing"
  | "searching"
  | "geocoding"
  | "saving";

export type PrepAddressOrigem = "pendente" | "qr" | "none";

export type AddressQuickFormHandle = {
  focusAddress: () => void;
};

export type InlineFeedback = {
  message: string;
  tone: "success" | "warning" | "info";
} | null;

interface AddressQuickFormProps {
  delivery: EntregaListItem;
  flowState?: QuickFormFlowState;
  prepOrigem?: PrepAddressOrigem;
  cidadePadrao?: string;
  estadoPadrao?: string;
  initialFreeText?: string;
  knownDeliveries?: EntregaListItem[];
  hidePackageCard?: boolean;
  showInputActions?: boolean;
  submitLabel?: string;
  inlineFeedback?: InlineFeedback;
  onFlowStateChange?: (state: QuickFormFlowState) => void;
  onSaveAndNext: (
    values: AddressFormValues,
    coords?: GeocodeResult | null,
    origem?: AddressOrigem
  ) => Promise<void>;
  onDictate: () => void;
  onOcr: () => void;
  onCancel?: () => void;
  externalParsed?: ParsedAddress | null;
}

const PREP_MODE_LABEL: Record<Exclude<PrepAddressOrigem, "none">, string> = {
  pendente: "📍 Preenchimento de endereço pendente",
  qr: "📷 Leitura por QR Code",
};

const AddressQuickForm = forwardRef<AddressQuickFormHandle, AddressQuickFormProps>(
  function AddressQuickForm(
    {
      delivery,
      flowState = "idle",
      prepOrigem = "none",
      cidadePadrao,
      estadoPadrao,
      initialFreeText = "",
      knownDeliveries = [],
      hidePackageCard = false,
      showInputActions = true,
      submitLabel = "Salvar e próximo",
      inlineFeedback = null,
      onFlowStateChange,
      onSaveAndNext,
      onDictate,
      onOcr,
      onCancel,
      externalParsed,
    },
    ref
  ) {
    const colors = useThemeColors();
    const [freeText, setFreeText] = useState(initialFreeText);
    const [destinatario, setDestinatario] = useState(delivery.cliente ?? "");
    const [complemento, setComplemento] = useState("");
    const [showOptional, setShowOptional] = useState(false);
    const [parsedInternal, setParsedInternal] = useState<Partial<AddressFormValues>>({});
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [didYouMean, setDidYouMean] = useState<AddressSuggestion | null>(null);
    const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
    const [autoApplied, setAutoApplied] = useState(false);
    const [selectedCoords, setSelectedCoords] = useState<GeocodeResult | null>(null);
    const [searching, setSearching] = useState(false);
    const [resolvingPlace, setResolvingPlace] = useState(false);
    const [searchEmpty, setSearchEmpty] = useState(false);
    const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
    const [selectedOrigem, setSelectedOrigem] = useState<AddressOrigem>("manual");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const freeTextRef = useRef<TextInput>(null);
    const lastSearchQueryRef = useRef("");
    const searchRequestIdRef = useRef(0);
    const parsedInternalRef = useRef(parsedInternal);
    parsedInternalRef.current = parsedInternal;

    useImperativeHandle(ref, () => ({
      focusAddress: () => freeTextRef.current?.focus(),
    }));

    const defaults = useMemo(
      () => ({ cidade: cidadePadrao, estado: estadoPadrao }),
      [cidadePadrao, estadoPadrao]
    );

    const applySuggestionRef = useRef<(s: AddressSuggestion, fromAuto?: boolean) => void>(() => {});
    const runSearchRef = useRef<
      (vals: Partial<AddressFormValues>, options?: { autoApply?: boolean }) => Promise<void>
    >(async () => {});

    const applySuggestion = useCallback(
      async (s: AddressSuggestion, fromAuto = false) => {
        if (!isSelectableAddressSuggestion(s)) return;

        let resolved = s;
        if (isGooglePendingSuggestion(s)) {
          setResolvingPlace(true);
          onFlowStateChange?.("searching");
          const query = buildSearchQuery(parsedInternalRef.current, defaults);
          const full = await resolveGooglePlaceSuggestion(s, {
            query,
            hints: parsedInternalRef.current,
            defaults,
          });
          setResolvingPlace(false);
          onFlowStateChange?.("idle");
          if (!full) {
            Alert.alert(
              "Endereço",
              "Nenhum endereço encontrado. Verifique rua, número e cidade."
            );
            return;
          }
          resolved = full;
          resetAddressSessionToken();
        }

        const parsedNumero = (parsedInternalRef.current.numero ?? "").trim();
        const vals: AddressFormValues = sanitizeAddressFormValues({
          ...resolved.values,
          numero: (resolved.values.numero ?? "").trim() || parsedNumero,
          destinatario: destinatario.trim() || delivery.cliente || "",
          complemento: complemento.trim(),
        });
        const origem: AddressOrigem =
          resolved.provider === "google_places" ? "google_places" : "suggestion";
        setParsedInternal(vals);
        setSelectedCoords({ latitude: resolved.latitude, longitude: resolved.longitude });
        setFreeText(formatSelectedAddress({ ...resolved, values: vals }));
        setSelectedSuggestionId(resolved.id);
        setSelectedOrigem(origem);
        setAutoApplied(fromAuto);
        setSuggestions([resolved]);
        setSearchEmpty(false);
      },
      [destinatario, complemento, delivery.cliente, defaults, onFlowStateChange]
    );
    applySuggestionRef.current = (s, fromAuto) => {
      void applySuggestion(s, fromAuto);
    };

    const runSearch = useCallback(
      async (
        vals: Partial<AddressFormValues>,
        options?: { autoApply?: boolean }
      ) => {
        if (!needsAddressEnrichment(vals)) {
          setSuggestions([]);
          setDidYouMean(null);
          setSearching(false);
          onFlowStateChange?.("idle");
          return;
        }
        const query = buildSearchQuery(vals, defaults);
        if (query === lastSearchQueryRef.current) {
          setSearching(false);
          onFlowStateChange?.("idle");
          return;
        }
        if (query.replace(/\s/g, "").length < 4) {
          setSuggestions([]);
          setDidYouMean(null);
          setSearchEmpty(false);
          setSearching(false);
          onFlowStateChange?.("idle");
          return;
        }
        lastSearchQueryRef.current = query;
        resetAddressSessionToken();
        const requestId = ++searchRequestIdRef.current;
        setSearching(true);
        setSearchEmpty(false);
        setSearchErrorMessage(null);
        onFlowStateChange?.("searching");
        try {
          const local = findLocalAddressSuggestions(vals, knownDeliveries, defaults);
          if (local.length > 0) {
            setSuggestions(filterSelectableSuggestions(local));
          }
          const { suggestions: remote, didYouMean: dym } = await searchAddressSuggestions(query, {
            hints: vals,
            defaults,
          });
          if (requestId !== searchRequestIdRef.current) return;

          const localIds = new Set(local.map((s) => s.id));
          let merged = filterSelectableSuggestions([
            ...local,
            ...remote.filter((s) => !localIds.has(s.id)),
          ]);
          let finalDym = dym;

          if (merged.length === 0 && !finalDym) {
            const hadExtra = (vals.numero ?? "").trim() || (vals.bairro ?? "").trim();
            const relaxedQuery = buildSearchQuery(
              { ...vals, numero: "", bairro: "" },
              defaults
            );
            if (hadExtra && relaxedQuery !== query && relaxedQuery.replace(/\s/g, "").length >= 4) {
              const relaxed = await searchAddressSuggestions(relaxedQuery, {
                hints: vals,
                defaults,
              });
              if (requestId !== searchRequestIdRef.current) return;
              merged = filterSelectableSuggestions(relaxed.suggestions);
              finalDym = relaxed.didYouMean;
            }
          }

          setSuggestions(merged);
          setDidYouMean(finalDym);
          setSearchEmpty(merged.length === 0 && !finalDym);

          if (
            options?.autoApply &&
            merged.length === 1 &&
            isSelectableAddressSuggestion(merged[0]) &&
            !isGooglePendingSuggestion(merged[0])
          ) {
            applySuggestionRef.current(merged[0], true);
          } else {
            setAutoApplied(false);
            setSelectedSuggestionId(null);
          }
        } catch (err) {
          if (requestId !== searchRequestIdRef.current) return;
          setSuggestions([]);
          setDidYouMean(null);
          setSearchEmpty(true);
          setSearchErrorMessage(
            err instanceof AddressSearchError
              ? err.message
              : "Não foi possível buscar sugestões. Tente novamente."
          );
        } finally {
          if (requestId === searchRequestIdRef.current) {
            setSearching(false);
            onFlowStateChange?.("idle");
          }
        }
      },
      [defaults, knownDeliveries, onFlowStateChange]
    );
    runSearchRef.current = runSearch;

    const runParse = useCallback(
      (text: string, options?: { autoApply?: boolean }) => {
        if (!text.trim()) {
          setParsedInternal({});
          setSuggestions([]);
          setDidYouMean(null);
          setSelectedSuggestionId(null);
          setAutoApplied(false);
          setSelectedCoords(null);
          lastSearchQueryRef.current = "";
          resetAddressSessionToken();
          setSearchEmpty(false);
          setSearchErrorMessage(null);
          return;
        }
        resetAddressSessionToken();
        onFlowStateChange?.("parsing");
        const parsed = parseFreeTextAddress(text, defaults);
        const vals = parsedToFormValues(parsed);
        setParsedInternal(vals);
        onFlowStateChange?.("idle");

        if (searchRef.current) clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => {
          void runSearchRef.current(vals, { autoApply: options?.autoApply });
        }, 500);
      },
      [defaults, onFlowStateChange]
    );

    useEffect(() => {
      setFreeText(initialFreeText);
      setDestinatario(delivery.cliente ?? "");
      setComplemento("");
      setParsedInternal({});
      setSuggestions([]);
      setDidYouMean(null);
      setSelectedSuggestionId(null);
      setAutoApplied(false);
      setSelectedCoords(null);
      setSearchEmpty(false);
      setSearchErrorMessage(null);
      setResolvingPlace(false);
      setSelectedOrigem("manual");
      resetAddressSessionToken();
      lastSearchQueryRef.current = "";
      searchRequestIdRef.current += 1;

      if (initialFreeText.trim()) {
        const parsed = parseFreeTextAddress(initialFreeText, defaults);
        const vals = parsedToFormValues(parsed);
        setParsedInternal(vals);
        if (needsAddressEnrichment(vals)) {
          void runSearchRef.current(vals);
        }
      }
    }, [delivery.id_saida]);

    useEffect(() => {
      if (!externalParsed) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (searchRef.current) clearTimeout(searchRef.current);

      const vals = parsedToFormValues(externalParsed);
      const summary = formatAddressSummary(vals);
      const rawText = (externalParsed.rawText ?? "").trim();
      const text = rawText && !rawText.includes("\n") ? rawText : summary || rawText;
      if (text) setFreeText(text);
      if (vals.destinatario) setDestinatario(vals.destinatario);
      if (vals.complemento) setComplemento(vals.complemento);
      setParsedInternal(vals);
      lastSearchQueryRef.current = "";
      void runSearchRef.current(vals, { autoApply: true });
    }, [externalParsed]);

    const handleFreeTextChange = (text: string) => {
      searchRequestIdRef.current += 1;
      lastSearchQueryRef.current = "";
      setFreeText(text);
      setSelectedSuggestionId(null);
      setAutoApplied(false);
      setSelectedCoords(null);
      setSelectedOrigem("manual");
      setSearchEmpty(false);
      setSearchErrorMessage(null);
      resetAddressSessionToken();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runParse(text), 500);
    };

    const resolveDestinatario = (): string => {
      const fromField = destinatario.trim();
      if (fromField) return fromField;
      const fromDelivery = (delivery.cliente ?? "").trim();
      if (fromDelivery) return fromDelivery;
      const fromParsed = (parsedInternal.destinatario ?? "").trim();
      if (fromParsed) return fromParsed;
      return "—";
    };

    const buildValues = (): AddressFormValues => {
      if (selectedSuggestionId && (parsedInternal.rua || parsedInternal.cidade)) {
        return {
          destinatario: resolveDestinatario(),
          rua: (parsedInternal.rua ?? "").trim(),
          numero: (parsedInternal.numero ?? "").trim(),
          complemento: complemento.trim() || (parsedInternal.complemento ?? "").trim(),
          bairro: (parsedInternal.bairro ?? "").trim(),
          cidade: (parsedInternal.cidade ?? "").trim(),
          estado: (parsedInternal.estado ?? "").trim(),
          cep: (parsedInternal.cep ?? "").replace(/\D/g, "").slice(0, 8),
        };
      }

      const fromParse = parsedInternal;
      const merged = parseFreeTextAddress(freeText, defaults);
      const base = parsedToFormValues(merged);
      return {
        destinatario: resolveDestinatario() || base.destinatario || fromParse.destinatario || "",
        rua: base.rua || fromParse.rua || "",
        numero: base.numero || fromParse.numero || "",
        complemento: complemento.trim() || base.complemento || fromParse.complemento || "",
        bairro: base.bairro || fromParse.bairro || "",
        cidade: base.cidade || fromParse.cidade || "",
        estado: base.estado || fromParse.estado || "",
        cep: base.cep || fromParse.cep || "",
      };
    };

    const validateValues = (vals: AddressFormValues): string | null => {
      const missing: string[] = [];
      if (!vals.rua.trim()) missing.push("rua");
      if (!vals.numero.trim()) missing.push("número");
      if (!vals.bairro.trim()) missing.push("bairro");
      if (!vals.cidade.trim()) missing.push("cidade");
      if (!vals.estado.trim()) missing.push("estado");
      if (vals.cep.replace(/\D/g, "").length < 8) missing.push("CEP (8 dígitos)");
      if (missing.length === 0) return null;
      const selectableCount = filterSelectableSuggestions(suggestions).length;
      if (selectableCount > 0 && !selectedSuggestionId) {
        return "Selecione uma das sugestões de endereço abaixo.";
      }
      return `Faltam: ${missing.join(", ")}. Aguarde a busca ou use o modo avançado.`;
    };

    const executeSave = async () => {
      const vals = buildValues();
      onFlowStateChange?.("saving");
      try {
        const origem: AddressOrigem =
          selectedSuggestionId &&
          isValidGeocodeCoords(selectedCoords?.latitude, selectedCoords?.longitude)
            ? selectedOrigem
            : "manual";
        await onSaveAndNext(vals, selectedCoords, origem);
      } finally {
        onFlowStateChange?.("idle");
      }
    };

    const handleSave = async (skipNumeroWarn = false) => {
      const vals = buildValues();
      const hasStreet = !!(vals.rua.trim() || vals.bairro.trim());
      if (!skipNumeroWarn && hasStreet && !vals.numero.trim()) {
        Alert.alert(
          "Endereço sem número",
          "Este endereço parece estar sem número.\nDeseja salvar mesmo assim?",
          [
            { text: "Corrigir", style: "cancel", onPress: () => freeTextRef.current?.focus() },
            { text: "Salvar mesmo assim", onPress: () => void handleSave(true) },
          ]
        );
        return;
      }
      if (!skipNumeroWarn) {
        const validationError = validateValues(vals);
        if (validationError) {
          Alert.alert("Endereço incompleto", validationError);
          return;
        }
      }
      await executeSave();
    };

    const inputLocked =
      flowState === "geocoding" ||
      flowState === "saving" ||
      flowState === "listening";

    const previewVals = buildValues();
    const selectableSuggestionCount = filterSelectableSuggestions(suggestions).length;
    const visualStatus = deriveAddressVisualStatus({
      freeText,
      vals: previewVals,
      selectedCoords,
      hasSelectedSuggestion: !!selectedSuggestionId,
      searching,
      resolvingPlace,
      suggestionCount: selectableSuggestionCount,
      searchEmpty,
      hasDidYouMean: !!didYouMean,
    });
    const showValidationKinds = new Set(["missing_number", "not_located"]);

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: { flex: 1 },
          modeBadge: {
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            marginBottom: 12,
          },
          modeBadgePendente: { backgroundColor: colors.primary + "18" },
          modeBadgeQr: { backgroundColor: colors.warning + "22" },
          modeBadgeText: { fontSize: 12, fontWeight: "700", color: colors.text },
          qrHint: {
            fontSize: 12,
            color: colors.textSecondary,
            marginBottom: 12,
            lineHeight: 17,
          },
          codigoCard: {
            backgroundColor: colors.primary + "12",
            borderWidth: 1,
            borderColor: colors.primary + "44",
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
          },
          codigoLabel: {
            fontSize: 11,
            fontWeight: "700",
            color: colors.textSecondary,
            letterSpacing: 0.5,
          },
          codigoValue: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 4 },
          pedido: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
          sectionLabel: {
            fontSize: 11,
            fontWeight: "700",
            color: colors.primary,
            letterSpacing: 0.5,
            marginBottom: 8,
            textTransform: "uppercase",
          },
          label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 6 },
          input: {
            borderWidth: 1,
            borderColor: colors.inputBorder,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: colors.inputBackground,
            color: colors.text,
            minHeight: 88,
            textAlignVertical: "top",
          },
          inputLocated: { borderColor: colors.success, borderWidth: 2 },
          inputSingle: { minHeight: 44, textAlignVertical: "center" },
          validationHint: { fontSize: 13, marginTop: 8, marginBottom: 4 },
          validationSuccess: { color: colors.success },
          validationWarning: { color: colors.warning },
          validationInfo: { color: colors.textSecondary },
          methodsSection: { marginTop: 4, marginBottom: 16 },
          methodsLabel: {
            fontSize: 11,
            fontWeight: "700",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: 10,
          },
          methodsRow: { flexDirection: "row", gap: 8 },
          methodCard: {
            flex: 1,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.backgroundCard,
            paddingVertical: 12,
            paddingHorizontal: 6,
            alignItems: "center",
          },
          methodIcon: { marginBottom: 6 },
          methodTitle: { fontSize: 12, fontWeight: "700", color: colors.text, textAlign: "center" },
          methodSub: {
            fontSize: 10,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: 2,
          },
          optionalToggle: { marginBottom: 8, marginTop: 4 },
          optionalText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
          inlineFeedback: {
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
          },
          inlineFeedbackSuccess: { backgroundColor: colors.success + "18" },
          inlineFeedbackWarning: { backgroundColor: colors.warning + "18" },
          inlineFeedbackInfo: { backgroundColor: colors.primary + "12" },
          inlineFeedbackText: { fontSize: 13, fontWeight: "600", color: colors.text },
          saveBtn: {
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.primary,
            marginTop: 8,
          },
          saveBtnDisabled: { opacity: 0.6 },
          saveBtnText: { fontSize: 17, fontWeight: "700", color: colors.primaryContrast },
          cancel: { alignItems: "center", paddingVertical: 14 },
          cancelText: { fontSize: 16, color: colors.textSecondary },
          status: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, textAlign: "center" },
        }),
      [colors]
    );

    const statusLabel =
      flowState === "listening"
        ? "🎤 Ouvindo endereço…"
        : flowState === "parsing"
          ? "🔄 Processando endereço…"
          : resolvingPlace
            ? "Carregando endereço…"
            : searching || flowState === "searching"
              ? "Buscando endereço…"
              : flowState === "geocoding"
                ? "Localizando no mapa…"
                : flowState === "saving"
                  ? "Salvando…"
                  : null;

    const validationStyle =
      visualStatus.kind === "located" || visualStatus.kind === "valid"
        ? styles.validationSuccess
        : visualStatus.kind === "missing_number" || visualStatus.kind === "not_located"
          ? styles.validationWarning
          : visualStatus.kind === "select_suggestion"
            ? styles.validationInfo
            : null;
    const showValidationHint =
      showValidationKinds.has(visualStatus.kind) && validationStyle;

    const showModeBadge = prepOrigem === "pendente" || prepOrigem === "qr";

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          {showModeBadge && (
            <View
              style={[
                styles.modeBadge,
                prepOrigem === "qr" ? styles.modeBadgeQr : styles.modeBadgePendente,
              ]}
            >
              <Text style={styles.modeBadgeText}>{PREP_MODE_LABEL[prepOrigem]}</Text>
            </View>
          )}

          {prepOrigem === "qr" && (
            <Text style={styles.qrHint}>
              Após salvar, a câmera será aberta para o próximo QR Code.
            </Text>
          )}

          {!hidePackageCard && (
            <View style={styles.codigoCard}>
              <Text style={styles.codigoLabel}>PACOTE / ETIQUETA</Text>
              <Text style={styles.codigoValue}>{delivery.codigo || "—"}</Text>
              <Text style={styles.pedido}>Pedido {delivery.id_saida}</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Endereço</Text>
          <TextInput
            ref={freeTextRef}
            style={[
              styles.input,
              visualStatus.kind === "located" ? styles.inputLocated : undefined,
            ]}
            placeholder="Ex.: Av. Paulista, Bela Vista, 1000"
            placeholderTextColor={colors.placeholder}
            value={freeText}
            onChangeText={handleFreeTextChange}
            multiline
            editable={!inputLocked}
          />

          <AddressSuggestionList
            suggestions={suggestions}
            loading={searching || resolvingPlace}
            selectedId={selectedSuggestionId}
            autoApplied={autoApplied}
            didYouMean={didYouMean}
            searchEmpty={searchEmpty}
            emptyMessage={searchErrorMessage}
            onSelect={(s) => void applySuggestion(s, false)}
            onSelectDidYouMean={(s) => void applySuggestion(s, false)}
          />

          {showValidationHint ? (
            <Text style={[styles.validationHint, validationStyle]}>{visualStatus.message}</Text>
          ) : null}

          {inlineFeedback ? (
            <View
              style={[
                styles.inlineFeedback,
                inlineFeedback.tone === "success"
                  ? styles.inlineFeedbackSuccess
                  : inlineFeedback.tone === "warning"
                    ? styles.inlineFeedbackWarning
                    : styles.inlineFeedbackInfo,
              ]}
            >
              <Text style={styles.inlineFeedbackText}>{inlineFeedback.message}</Text>
            </View>
          ) : null}

          {showInputActions && (
            <View style={styles.methodsSection}>
              <Text style={styles.methodsLabel}>COMO PREENCHER?</Text>
              <View style={styles.methodsRow}>
                <TouchableOpacity
                  style={styles.methodCard}
                  onPress={onDictate}
                  disabled={inputLocked || searching}
                >
                  <Ionicons
                    name="mic-outline"
                    size={22}
                    color={colors.primary}
                    style={styles.methodIcon}
                  />
                  <Text style={styles.methodTitle}>Falar</Text>
                  <Text style={styles.methodSub}>Dite o endereço</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.methodCard}
                  onPress={onOcr}
                  disabled={inputLocked || searching}
                >
                  <Ionicons
                    name="camera-outline"
                    size={22}
                    color={colors.primary}
                    style={styles.methodIcon}
                  />
                  <Text style={styles.methodTitle}>Foto / OCR</Text>
                  <Text style={styles.methodSub}>Fotografe a etiqueta</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.methodCard}
                  onPress={() => freeTextRef.current?.focus()}
                  disabled={inputLocked || searching}
                >
                  <Ionicons
                    name="keypad-outline"
                    size={22}
                    color={colors.primary}
                    style={styles.methodIcon}
                  />
                  <Text style={styles.methodTitle}>Digitar</Text>
                  <Text style={styles.methodSub}>Digite manualmente</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.optionalToggle}
            onPress={() => setShowOptional((v) => !v)}
          >
            <Text style={styles.optionalText}>
              {showOptional ? "Ocultar opcionais" : "Destinatário e complemento (opcional)"}
            </Text>
          </TouchableOpacity>

          {showOptional && (
            <>
              <Text style={styles.label}>Destinatário</Text>
              <TextInput
                style={[styles.input, styles.inputSingle]}
                placeholder="Ex.: João"
                placeholderTextColor={colors.placeholder}
                value={destinatario}
                onChangeText={setDestinatario}
                editable={!inputLocked}
              />
              <Text style={[styles.label, { marginTop: 8 }]}>Complemento</Text>
              <TextInput
                style={[styles.input, styles.inputSingle]}
                placeholder="Ex.: Portão azul, Apto 12, Fundos…"
                placeholderTextColor={colors.placeholder}
                value={complemento}
                onChangeText={setComplemento}
                editable={!inputLocked}
                maxLength={120}
              />
            </>
          )}

          {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, (inputLocked || searching) && styles.saveBtnDisabled]}
            onPress={() => void handleSave()}
            disabled={inputLocked || searching || !freeText.trim()}
          >
            {flowState === "saving" || flowState === "geocoding" ? (
              <ActivityIndicator color={colors.primaryContrast} />
            ) : (
              <Text style={styles.saveBtnText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>

          {onCancel && (
            <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={inputLocked}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
);

export default AddressQuickForm;
