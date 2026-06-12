import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export type QuickFormFlowState =
  | "idle"
  | "listening"
  | "parsing"
  | "searching"
  | "geocoding"
  | "saving";

interface AddressQuickFormProps {
  delivery: EntregaListItem;
  flowState?: QuickFormFlowState;
  cidadePadrao?: string;
  estadoPadrao?: string;
  initialFreeText?: string;
  knownDeliveries?: EntregaListItem[];
  hidePackageCard?: boolean;
  showInputActions?: boolean;
  submitLabel?: string;
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

export default function AddressQuickForm({
  delivery,
  flowState = "idle",
  cidadePadrao,
  estadoPadrao,
  initialFreeText = "",
  knownDeliveries = [],
  hidePackageCard = false,
  showInputActions = true,
  submitLabel = "Salvar e próximo",
  onFlowStateChange,
  onSaveAndNext,
  onDictate,
  onOcr,
  onCancel,
  externalParsed,
}: AddressQuickFormProps) {
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

        // Vazio com número/bairro nos hints: tentar uma vez com query relaxada
        // (rua + cidade/estado) — o número do usuário é re-mesclado via hints.
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
    // Resetar formulário apenas ao trocar de pedido — não quando runSearch/parse mudam.
  }, [delivery.id_saida]);

  useEffect(() => {
    if (!externalParsed) return;

    // Cancelar parse/busca pendentes de digitação anterior.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchRef.current) clearTimeout(searchRef.current);

    const vals = parsedToFormValues(externalParsed);
    const summary = formatAddressSummary(vals);
    const rawText = (externalParsed.rawText ?? "").trim();
    // OCR multilinha: exibir o resumo estruturado, não o dump da etiqueta.
    const text = rawText && !rawText.includes("\n") ? rawText : summary || rawText;
    if (text) setFreeText(text);
    if (vals.destinatario) setDestinatario(vals.destinatario);
    if (vals.complemento) setComplemento(vals.complemento);
    // Usa o parse estruturado (voz/OCR) como hints da busca — não re-parsear o texto bruto.
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

  const handleSave = async () => {
    const vals = buildValues();
    const validationError = validateValues(vals);
    if (validationError) {
      Alert.alert("Endereço incompleto", validationError);
      return;
    }
    onFlowStateChange?.("saving");
    try {
      const origem: AddressOrigem =
        selectedSuggestionId && isValidGeocodeCoords(selectedCoords?.latitude, selectedCoords?.longitude)
          ? selectedOrigem
          : "manual";
      await onSaveAndNext(vals, selectedCoords, origem);
    } finally {
      onFlowStateChange?.("idle");
    }
  };

  const inputLocked =
    flowState === "geocoding" ||
    flowState === "saving" ||
    flowState === "listening";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        codigoCard: {
          backgroundColor: colors.primary + "18",
          borderWidth: 2,
          borderColor: colors.primary,
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        },
        codigoLabel: {
          fontSize: 11,
          fontWeight: "600",
          color: colors.textSecondary,
          textTransform: "uppercase",
        },
        codigoValue: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 4 },
        pedido: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 10,
          padding: 12,
          fontSize: 16,
          backgroundColor: colors.inputBackground,
          color: colors.text,
          minHeight: 88,
          textAlignVertical: "top",
        },
        inputSingle: { minHeight: 44, textAlignVertical: "center" },
        actionsRow: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 16 },
        actionBtn: {
          flex: 1,
          paddingVertical: 10,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        actionBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
        optionalToggle: { marginBottom: 8 },
        optionalText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
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
        parsedPreview: {
          backgroundColor: colors.inputBackground,
          borderRadius: 8,
          padding: 10,
          marginBottom: 12,
        },
        parsedPreviewText: { fontSize: 13, color: colors.text, lineHeight: 18 },
      }),
    [colors]
  );

  const statusLabel =
    flowState === "listening"
      ? "Ouvindo…"
      : flowState === "parsing"
        ? "Interpretando endereço…"
        : resolvingPlace
          ? "Carregando endereço…"
          : searching || flowState === "searching"
            ? "Buscando endereço…"
            : flowState === "geocoding"
            ? "Localizando no mapa…"
            : flowState === "saving"
              ? "Salvando…"
              : null;

  const previewVals = buildValues();
  const showParsedPreview =
    (previewVals.rua || previewVals.numero) &&
    (selectedSuggestionId || autoApplied || !needsAddressEnrichment(previewVals));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
        {!hidePackageCard && (
          <View style={styles.codigoCard}>
            <Text style={styles.codigoLabel}>Pacote / etiqueta</Text>
            <Text style={styles.codigoValue}>{delivery.codigo || "—"}</Text>
            <Text style={styles.pedido}>Pedido {delivery.id_saida}</Text>
          </View>
        )}

        <Text style={styles.label}>
          {showInputActions
            ? "Digite, dite ou fotografe: rua, bairro e número"
            : "Digite o endereço (rua, bairro e número)"}
        </Text>
        <TextInput
          ref={freeTextRef}
          style={styles.input}
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

        {showParsedPreview && (
          <View style={styles.parsedPreview}>
            <Text style={styles.parsedPreviewText}>
              {[previewVals.rua, previewVals.numero].filter(Boolean).join(", ")}
              {previewVals.bairro ? `\n${previewVals.bairro}` : ""}
              {previewVals.cidade
                ? `\n${[previewVals.cidade, previewVals.estado, previewVals.cep].filter(Boolean).join(" · ")}`
                : ""}
            </Text>
          </View>
        )}

        {showInputActions && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={onDictate} disabled={inputLocked || searching}>
              <Text style={styles.actionBtnText}>Ditar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onOcr} disabled={inputLocked || searching}>
              <Text style={styles.actionBtnText}>Foto/OCR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => freeTextRef.current?.focus()}
              disabled={inputLocked || searching}
            >
              <Text style={styles.actionBtnText}>Digitar</Text>
            </TouchableOpacity>
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
              placeholder="Opcional"
              placeholderTextColor={colors.placeholder}
              value={destinatario}
              onChangeText={setDestinatario}
              editable={!inputLocked}
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Complemento</Text>
            <TextInput
              style={[styles.input, styles.inputSingle]}
              placeholder="Bloco, apto…"
              placeholderTextColor={colors.placeholder}
              value={complemento}
              onChangeText={setComplemento}
              editable={!inputLocked}
            />
          </>
        )}

        {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, (inputLocked || searching) && styles.saveBtnDisabled]}
          onPress={handleSave}
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
