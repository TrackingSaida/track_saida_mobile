import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { ParsedAddress } from "../utils/ocrAddress";
import type { AddressSuggestion } from "../utils/addressSuggestions";
import AddressSuggestionList from "./AddressSuggestionList";

interface AddressPreviewSheetProps {
  visible: boolean;
  source: "voice" | "ocr";
  parsed: ParsedAddress | null;
  suggestions?: AddressSuggestion[];
  suggestionsLoading?: boolean;
  selectedSuggestionId?: string | null;
  autoApplied?: boolean;
  didYouMean?: AddressSuggestion | null;
  onSelectSuggestion?: (suggestion: AddressSuggestion) => void;
  onSaveAndNext: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onClose: () => void;
}

function formatPreview(parsed: ParsedAddress): string {
  const line1 = [parsed.rua, parsed.numero].filter(Boolean).join(", ");
  const line2 = [parsed.bairro, parsed.cidade, parsed.estado].filter(Boolean).join(" — ");
  const cep = parsed.cep ? `CEP ${parsed.cep}` : "";
  return [line1, line2, cep].filter(Boolean).join("\n");
}

export default function AddressPreviewSheet({
  visible,
  source,
  parsed,
  suggestions = [],
  suggestionsLoading,
  selectedSuggestionId,
  autoApplied,
  didYouMean,
  onSelectSuggestion,
  onSaveAndNext,
  onEdit,
  onRetry,
  onClose,
}: AddressPreviewSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          maxHeight: "85%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
        subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
        previewBox: {
          backgroundColor: colors.inputBackground,
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
        },
        previewLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
        previewText: { fontSize: 16, color: colors.text, lineHeight: 24 },
        fieldRow: { marginBottom: 6 },
        fieldLabel: { fontSize: 11, color: colors.textSecondary },
        fieldValue: { fontSize: 14, color: colors.text },
        btn: {
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginBottom: 8,
        },
        btnText: { fontSize: 16, fontWeight: "600", color: colors.primaryContrast },
        btnOutline: {
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.primary,
          marginBottom: 8,
        },
        btnOutlineText: { fontSize: 16, fontWeight: "600", color: colors.primary },
        cancel: { alignItems: "center", paddingVertical: 12 },
        cancelText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  if (!parsed) return null;

  const canSave =
    !suggestionsLoading &&
    (suggestions.length === 0 || selectedSuggestionId != null || autoApplied);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Endereço identificado</Text>
          <Text style={styles.subtitle}>
            {source === "voice" ? "Reconhecido por voz" : "Lido da foto"}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Resumo</Text>
              <Text style={styles.previewText}>{formatPreview(parsed) || parsed.rawText || "—"}</Text>
            </View>

            {onSelectSuggestion && (
              <AddressSuggestionList
                suggestions={suggestions}
                loading={suggestionsLoading}
                selectedId={selectedSuggestionId}
                autoApplied={autoApplied}
                didYouMean={didYouMean}
                onSelect={onSelectSuggestion}
                onSelectDidYouMean={onSelectSuggestion}
              />
            )}

            {parsed.destinatario ? (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Destinatário</Text>
                <Text style={styles.fieldValue}>{parsed.destinatario}</Text>
              </View>
            ) : null}
            {parsed.rua ? (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Rua</Text>
                <Text style={styles.fieldValue}>{parsed.rua}</Text>
              </View>
            ) : null}
            {parsed.numero ? (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Número</Text>
                <Text style={styles.fieldValue}>{parsed.numero}</Text>
              </View>
            ) : null}
          </ScrollView>
          <TouchableOpacity
            style={[styles.btn, !canSave && { opacity: 0.5 }]}
            onPress={onSaveAndNext}
            disabled={!canSave}
          >
            <Text style={styles.btnText}>Salvar e próximo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={onEdit}>
            <Text style={styles.btnOutlineText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={onRetry}>
            <Text style={styles.btnOutlineText}>
              {source === "voice" ? "Repetir voz" : "Tirar outra foto"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
