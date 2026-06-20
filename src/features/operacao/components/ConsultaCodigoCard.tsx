import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import EntregaCodigoHeader from "../../entregas/components/EntregaCodigoHeader";
import type { SaidaListItem } from "../saidasApi";
import { statusVisualSaida } from "../utils/operacaoStatusUtils";

type Props = {
  item: SaidaListItem;
  onPress: () => void;
  compact?: boolean;
};

export default function ConsultaCodigoCard({ item, onPress, compact = false }: Props) {
  const colors = useThemeColors();
  const sv = statusVisualSaida(item.status as string);
  const dataEntrada = typeof item.data === "string" ? item.data : null;

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
      <EntregaCodigoHeader
        codigo={item.codigo}
        servico={item.servico}
        exibicao={sv.label}
        data={dataEntrada}
        compact={compact}
        style={{ marginBottom: compact ? 8 : 10 }}
      />
      {item.entregador ? <Text style={styles.meta}>Entregador: {item.entregador}</Text> : null}
      {!compact ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ver detalhes</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
