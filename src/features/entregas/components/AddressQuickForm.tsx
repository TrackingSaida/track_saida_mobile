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
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";
import type { AddressFormValues } from "./AddressForm";
import {
  parseFreeTextAddress,
  parsedToFormValues,
  type ParsedAddress,
} from "../utils/ocrAddress";

export type QuickFormFlowState =
  | "idle"
  | "listening"
  | "parsing"
  | "geocoding"
  | "saving";

interface AddressQuickFormProps {
  delivery: EntregaListItem;
  flowState?: QuickFormFlowState;
  cidadePadrao?: string;
  estadoPadrao?: string;
  initialFreeText?: string;
  onFlowStateChange?: (state: QuickFormFlowState) => void;
  onSaveAndNext: (values: AddressFormValues) => Promise<void>;
  onDictate: () => void;
  onOcr: () => void;
  onCancel?: () => void;
  /** Aplica endereço parseado (voz/OCR) nos campos internos. */
  externalParsed?: ParsedAddress | null;
}

export default function AddressQuickForm({
  delivery,
  flowState = "idle",
  cidadePadrao,
  estadoPadrao,
  initialFreeText = "",
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freeTextRef = useRef<TextInput>(null);

  const defaults = useMemo(
    () => ({ cidade: cidadePadrao, estado: estadoPadrao }),
    [cidadePadrao, estadoPadrao]
  );

  useEffect(() => {
    setFreeText(initialFreeText);
    setDestinatario(delivery.cliente ?? "");
    setComplemento("");
    setParsedInternal({});
  }, [delivery.id_saida, initialFreeText, delivery.cliente]);

  useEffect(() => {
    if (!externalParsed) return;
    const vals = parsedToFormValues(externalParsed);
    setParsedInternal(vals);
    const summary = [vals.rua, vals.numero, vals.bairro, vals.cidade, vals.estado]
      .filter(Boolean)
      .join(", ");
    if (summary) setFreeText(summary);
    if (vals.destinatario) setDestinatario(vals.destinatario);
    if (vals.complemento) setComplemento(vals.complemento);
  }, [externalParsed]);

  const runParse = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setParsedInternal({});
        return;
      }
      onFlowStateChange?.("parsing");
      const parsed = parseFreeTextAddress(text, defaults);
      setParsedInternal(parsedToFormValues(parsed));
      onFlowStateChange?.("idle");
    },
    [defaults, onFlowStateChange]
  );

  const handleFreeTextChange = (text: string) => {
    setFreeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runParse(text), 400);
  };

  const buildValues = (): AddressFormValues => {
    const fromParse = parsedInternal;
    const merged = parseFreeTextAddress(freeText, defaults);
    const base = parsedToFormValues(merged);
    return {
      destinatario: destinatario.trim() || base.destinatario || fromParse.destinatario || "",
      rua: base.rua || fromParse.rua || "",
      numero: base.numero || fromParse.numero || "",
      complemento: complemento.trim() || base.complemento || fromParse.complemento || "",
      bairro: base.bairro || fromParse.bairro || "",
      cidade: base.cidade || fromParse.cidade || "",
      estado: base.estado || fromParse.estado || "",
      cep: base.cep || fromParse.cep || "",
    };
  };

  const handleSave = async () => {
    const vals = buildValues();
    if (!vals.rua.trim()) {
      return;
    }
    onFlowStateChange?.("saving");
    try {
      await onSaveAndNext(vals);
    } finally {
      onFlowStateChange?.("idle");
    }
  };

  const busy = flowState === "geocoding" || flowState === "saving" || flowState === "listening";

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
      }),
    [colors]
  );

  const statusLabel =
    flowState === "listening"
      ? "Ouvindo…"
      : flowState === "parsing"
        ? "Interpretando endereço…"
        : flowState === "geocoding"
          ? "Localizando no mapa…"
          : flowState === "saving"
            ? "Salvando…"
            : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
        <View style={styles.codigoCard}>
          <Text style={styles.codigoLabel}>Pacote / etiqueta</Text>
          <Text style={styles.codigoValue}>{delivery.codigo || "—"}</Text>
          <Text style={styles.pedido}>Pedido {delivery.id_saida}</Text>
        </View>

        <Text style={styles.label}>Digite, dite ou fotografe o endereço</Text>
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
            <Text style={styles.saveBtnText}>Salvar e próximo</Text>
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
