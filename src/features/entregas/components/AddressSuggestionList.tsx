import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import type { AddressSuggestion } from "../utils/addressSuggestions";
import {
  filterSelectableSuggestions,
  formatSuggestionLines,
  isDisplayableDidYouMean,
} from "../utils/addressSuggestions";

interface AddressSuggestionListProps {
  suggestions: AddressSuggestion[];
  loading?: boolean;
  selectedId?: string | null;
  autoApplied?: boolean;
  didYouMean?: AddressSuggestion | null;
  searchEmpty?: boolean;
  emptyMessage?: string | null;
  onSelect: (suggestion: AddressSuggestion) => void;
  onSelectDidYouMean?: (suggestion: AddressSuggestion) => void;
}

const SEARCH_EMPTY_MESSAGE =
  "Nenhum endereço encontrado. Verifique rua, número e cidade.";

export default function AddressSuggestionList({
  suggestions,
  loading,
  selectedId,
  autoApplied,
  didYouMean,
  searchEmpty,
  emptyMessage,
  onSelect,
  onSelectDidYouMean,
}: AddressSuggestionListProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginBottom: 12 },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        },
        headerText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
        autoBadge: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.success + "22",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          marginBottom: 8,
          alignSelf: "flex-start",
        },
        autoBadgeText: { fontSize: 12, fontWeight: "600", color: colors.success },
        dymWrap: {
          borderWidth: 1,
          borderColor: colors.primary + "55",
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
          backgroundColor: colors.primary + "10",
        },
        dymTitle: { fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: 6 },
        dymText: { fontSize: 14, color: colors.text, lineHeight: 20 },
        dymSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
        card: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 10,
          padding: 12,
          marginBottom: 8,
          backgroundColor: colors.inputBackground,
        },
        cardSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + "12",
        },
        cardLine1: { fontSize: 14, fontWeight: "700", color: colors.text, lineHeight: 20 },
        cardLine2: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
        cardLine3: { fontSize: 13, color: colors.text, marginTop: 2, lineHeight: 18 },
        cardLine4: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        cardBadge: {
          alignSelf: "flex-start",
          marginTop: 6,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          backgroundColor: colors.primary + "18",
        },
        cardBadgeText: { fontSize: 11, fontWeight: "600", color: colors.primary },
        loader: { paddingVertical: 12, alignItems: "center" },
        emptyText: {
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 20,
          marginTop: 4,
        },
      }),
    [colors]
  );

  const selectableSuggestions = filterSelectableSuggestions(suggestions);
  const showDidYouMean =
    didYouMean &&
    isDisplayableDidYouMean(didYouMean) &&
    !selectableSuggestions.some((s) => s.id === didYouMean.id);

  if (loading && selectableSuggestions.length === 0 && !showDidYouMean) {
    return (
      <View style={styles.wrap}>
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.headerText, { marginTop: 8 }]}>Buscando endereço…</Text>
        </View>
      </View>
    );
  }

  if (searchEmpty && selectableSuggestions.length === 0 && !showDidYouMean) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.emptyText}>{emptyMessage || SEARCH_EMPTY_MESSAGE}</Text>
      </View>
    );
  }

  if (selectableSuggestions.length === 0 && !showDidYouMean) return null;

  const dymLines = showDidYouMean ? formatSuggestionLines(didYouMean!) : null;
  const onlyDidYouMean = selectableSuggestions.length === 0 && showDidYouMean;

  return (
    <View style={styles.wrap}>
      {onlyDidYouMean && (
        <View style={styles.header}>
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.headerText}>Nenhum endereço exato — você quis dizer?</Text>
        </View>
      )}

      {showDidYouMean && (
        <TouchableOpacity
          style={styles.dymWrap}
          onPress={() => onSelectDidYouMean?.(didYouMean!)}
        >
          <Text style={styles.dymTitle}>Você quis dizer?</Text>
          <Text style={styles.dymText}>
            {dymLines?.line1 || suggestionShortLabel(didYouMean!)}
          </Text>
          {dymLines?.line3 ? <Text style={styles.dymSub}>{dymLines.line3}</Text> : null}
        </TouchableOpacity>
      )}

      {selectableSuggestions.length > 0 && (
        <View style={styles.header}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text style={styles.headerText}>
            {selectableSuggestions.length === 1
              ? "Endereço encontrado"
              : "Selecione o endereço"}
          </Text>
        </View>
      )}

      {loading && selectableSuggestions.length > 0 && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {autoApplied && (
        <View style={styles.autoBadge}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.autoBadgeText}>Sugestão aplicada</Text>
        </View>
      )}

      {selectableSuggestions.map((s) => {
        const selected = selectedId === s.id;
        const lines = formatSuggestionLines(s);
        const isLocal = s.provider === "local";
        return (
          <TouchableOpacity
            key={s.id}
            style={[styles.card, selected && styles.cardSelected]}
            onPress={() => onSelect(s)}
          >
            {isLocal ? <Text style={styles.cardMeta}>{s.label}</Text> : null}
            {lines.line1 ? <Text style={styles.cardLine1}>{lines.line1}</Text> : null}
            {lines.line2 ? <Text style={styles.cardLine2}>{lines.line2}</Text> : null}
            {lines.line3 ? <Text style={styles.cardLine3}>{lines.line3}</Text> : null}
            {lines.line4 ? <Text style={styles.cardLine4}>{lines.line4}</Text> : null}
            {lines.distance ? <Text style={styles.cardMeta}>{lines.distance}</Text> : null}
            {lines.badge ? (
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>{lines.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}

    </View>
  );
}

function suggestionShortLabel(s: AddressSuggestion): string {
  const lines = formatSuggestionLines(s);
  return [lines.line1, lines.line3].filter(Boolean).join(" · ");
}
