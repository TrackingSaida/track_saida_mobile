import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import type { SaidaListItem } from "../saidasApi";
import { coresBadgeServico, statusVisualSaida } from "../utils/operacaoStatusUtils";

type Props = {
  item: SaidaListItem;
  onPress: () => void;
  compact?: boolean;
};

export default function ConsultaCodigoCard({ item, onPress, compact = false }: Props) {
  const colors = useThemeColors();
  const sv = statusVisualSaida(item.status as string);
  const servicoColors = item.servico ? coresBadgeServico(item.servico) : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: 14,
          padding: compact ? 14 : 16,
          backgroundColor: colors.backgroundCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 10,
        },
        codigo: {
          fontSize: compact ? 16 : 20,
          fontWeight: "800",
          color: colors.text,
          flex: 1,
        },
        rowTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
        badge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
        },
        badgeText: { fontSize: 11, fontWeight: "800" },
        meta: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
        footer: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          marginTop: 8,
          gap: 4,
        },
        footerText: { fontSize: 13, fontWeight: "700", color: colors.primary },
      }),
    [colors, compact]
  );

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.codigo} numberOfLines={1}>
          {item.codigo || "—"}
        </Text>
        <View style={[styles.badge, { backgroundColor: sv.bg }]}>
          <Text style={[styles.badgeText, { color: sv.fg }]}>{sv.label}</Text>
        </View>
      </View>
      {item.entregador ? <Text style={styles.meta}>Entregador: {item.entregador}</Text> : null}
      {item.servico && servicoColors ? (
        <Text style={styles.meta}>Serviço: {item.servico}</Text>
      ) : null}
      {!compact ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ver detalhes</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
