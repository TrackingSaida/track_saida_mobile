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

interface AddressSuggestionListProps {
  suggestions: AddressSuggestion[];
  loading?: boolean;
  selectedId?: string | null;
  autoApplied?: boolean;
  onSelect: (suggestion: AddressSuggestion) => void;
}

export default function AddressSuggestionList({
  suggestions,
  loading,
  selectedId,
  autoApplied,
  onSelect,
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
        cardText: { fontSize: 14, color: colors.text, lineHeight: 20 },
        cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        loader: { paddingVertical: 12, alignItems: "center" },
      }),
    [colors]
  );

  if (loading) {
    return (
      <View style={styles.wrap}>
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.headerText, { marginTop: 8 }]}>Buscando endereço completo…</Text>
        </View>
      </View>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="location-outline" size={16} color={colors.primary} />
        <Text style={styles.headerText}>
          {suggestions.length === 1 ? "Endereço encontrado" : "Selecione o endereço"}
        </Text>
      </View>
      {autoApplied && (
        <View style={styles.autoBadge}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.autoBadgeText}>Sugestão aplicada</Text>
        </View>
      )}
      {suggestions.map((s) => {
        const selected = selectedId === s.id;
        const headline = [s.values.rua, s.values.numero].filter(Boolean).join(", ");
        const meta = [s.values.bairro, s.values.cidade, s.values.estado, s.values.cep]
          .filter(Boolean)
          .join(" · ");
        return (
          <TouchableOpacity
            key={s.id}
            style={[styles.card, selected && styles.cardSelected]}
            onPress={() => onSelect(s)}
          >
            <Text style={styles.cardText}>{headline || s.displayName}</Text>
            {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
