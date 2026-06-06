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
import type { AddressFormValues } from "./AddressForm";
import {
  parseFreeTextAddress,
  parsedToFormValues,
  type ParsedAddress,
} from "../utils/ocrAddress";
import {
  buildSearchQuery,
  findLocalAddressSuggestions,
  formatAddressSummary,
  needsAddressEnrichment,
  searchAddressSuggestions,
  type AddressSuggestion,
} from "../utils/addressSuggestions";
import AddressSuggestionList from "./AddressSuggestionList";

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
  onSaveAndNext: (values: AddressFormValues) => Promise<void>;
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
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freeTextRef = useRef<TextInput>(null);
  const lastSearchQueryRef = useRef("");

  const defaults = useMemo(
    () => ({ cidade: cidadePadrao, estado: estadoPadrao }),
    [cidadePadrao, estadoPadrao]
  );

  const applySuggestion = useCallback(
    (s: AddressSuggestion, fromAuto = false) => {
      const parsedNumero = (parsedInternal.numero ?? "").trim();
      const vals = {
        ...s.values,
        numero: (s.values.numero ?? "").trim() || parsedNumero,
        destinatario: destinatario.trim() || delivery.cliente || "",
        complemento: complemento.trim(),
      };
      setParsedInternal(vals);
      setFreeText(formatAddressSummary(vals));
      setSelectedSuggestionId(s.id);
      setAutoApplied(fromAuto);
      setSuggestions([s]);
    },
    [destinatario, complemento, delivery.cliente, parsedInternal.numero]
  );

  const runSearch = useCallback(
    async (vals: Partial<AddressFormValues>) => {
      if (!needsAddressEnrichment(vals)) {
        setSuggestions([]);
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
      lastSearchQueryRef.current = query;
      setSearching(true);
      onFlowStateChange?.("searching");
      const local = findLocalAddressSuggestions(vals, knownDeliveries, defaults);
      const remote = await searchAddressSuggestions(query, { hints: vals, defaults });
      const localIds = new Set(local.map((s) => s.id));
      const merged = [...local, ...remote.filter((s) => !localIds.has(s.id))];
      setSearching(false);
      onFlowStateChange?.("idle");
      setSuggestions(merged);
      if (merged.length === 1) {
        applySuggestion(merged[0], true);
      } else if (local.length === 1 && needsAddressEnrichment(vals)) {
        applySuggestion(local[0], true);
      } else {
        setAutoApplied(false);
        setSelectedSuggestionId(null);
      }
    },
    [defaults, knownDeliveries, onFlowStateChange, applySuggestion]
  );

  useEffect(() => {
    setFreeText(initialFreeText);
    setDestinatario(delivery.cliente ?? "");
    setComplemento("");
    setParsedInternal({});
    setSuggestions([]);
    setSelectedSuggestionId(null);
    setAutoApplied(false);
    lastSearchQueryRef.current = "";

    if (initialFreeText.trim()) {
      const parsed = parseFreeTextAddress(initialFreeText, defaults);
      const vals = parsedToFormValues(parsed);
      setParsedInternal(vals);
      if (needsAddressEnrichment(vals)) {
        void runSearch(vals);
      }
    }
  }, [delivery.id_saida, initialFreeText, delivery.cliente, defaults, runSearch]);

  useEffect(() => {
    if (!externalParsed) return;
    const vals = parsedToFormValues(externalParsed);
    setParsedInternal(vals);
    const summary = formatAddressSummary(vals);
    if (summary) setFreeText(summary);
    if (vals.destinatario) setDestinatario(vals.destinatario);
    if (vals.complemento) setComplemento(vals.complemento);
    void runSearch(vals);
  }, [externalParsed, runSearch]);

  const runParse = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setParsedInternal({});
        setSuggestions([]);
        setSelectedSuggestionId(null);
        setAutoApplied(false);
        lastSearchQueryRef.current = "";
        return;
      }
      onFlowStateChange?.("parsing");
      const parsed = parseFreeTextAddress(text, defaults);
      const vals = parsedToFormValues(parsed);
      setParsedInternal(vals);
      onFlowStateChange?.("idle");

      if (searchRef.current) clearTimeout(searchRef.current);
      searchRef.current = setTimeout(() => {
        void runSearch(vals);
      }, 500);
    },
    [defaults, onFlowStateChange, runSearch]
  );

  const handleFreeTextChange = (text: string) => {
    setFreeText(text);
    setSelectedSuggestionId(null);
    setAutoApplied(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runParse(text), 400);
  };

  const buildValues = (): AddressFormValues => {
    const fromParse = parsedInternal;
    const merged = parseFreeTextAddress(freeText, defaults);
    const base = parsedToFormValues(merged);
    return {
      destinatario: destinatario.trim() || base.destinatario || fromParse.destinatario || delivery.cliente || "",
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
    if (!vals.destinatario.trim()) missing.push("destinatário");
    if (!vals.rua.trim()) missing.push("rua");
    if (!vals.numero.trim()) missing.push("número");
    if (!vals.bairro.trim()) missing.push("bairro");
    if (!vals.cidade.trim()) missing.push("cidade");
    if (!vals.estado.trim()) missing.push("estado");
    if (vals.cep.replace(/\D/g, "").length < 8) missing.push("CEP (8 dígitos)");
    if (missing.length === 0) return null;
    if (suggestions.length > 0 && !selectedSuggestionId) {
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
      await onSaveAndNext(vals);
    } finally {
      onFlowStateChange?.("idle");
    }
  };

  const busy =
    flowState === "geocoding" ||
    flowState === "saving" ||
    flowState === "listening" ||
    searching;

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
        : searching || flowState === "searching"
          ? "Buscando endereço completo…"
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
          {showInputActions ? "Digite, dite ou fotografe o endereço" : "Digite o endereço"}
        </Text>
        <TextInput
          ref={freeTextRef}
          style={styles.input}
          placeholder="Ex.: Rua Dona Flor 123 Jandira"
          placeholderTextColor={colors.placeholder}
          value={freeText}
          onChangeText={handleFreeTextChange}
          multiline
          editable={!busy}
        />

        <AddressSuggestionList
          suggestions={suggestions}
          loading={searching}
          selectedId={selectedSuggestionId}
          autoApplied={autoApplied}
          onSelect={(s) => applySuggestion(s, false)}
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
            <TouchableOpacity style={styles.actionBtn} onPress={onDictate} disabled={busy}>
              <Text style={styles.actionBtnText}>Ditar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onOcr} disabled={busy}>
              <Text style={styles.actionBtnText}>Foto/OCR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => freeTextRef.current?.focus()}
              disabled={busy}
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
              editable={!busy}
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Complemento</Text>
            <TextInput
              style={[styles.input, styles.inputSingle]}
              placeholder="Bloco, apto…"
              placeholderTextColor={colors.placeholder}
              value={complemento}
              onChangeText={setComplemento}
              editable={!busy}
            />
          </>
        )}

        {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, busy && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={busy || !freeText.trim()}
        >
          {flowState === "saving" || flowState === "geocoding" ? (
            <ActivityIndicator color={colors.primaryContrast} />
          ) : (
            <Text style={styles.saveBtnText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={busy}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
