import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "../../../../theme/colors";
import { servicoTipo } from "../../utils/servico";
import type { EntregaListItem } from "../../types";
import {
  formatDetailDateTimeLabel,
  resolveDetailStatusKind,
  statusLabelUpper,
  type DetailStatusKind,
} from "./detailFormatters";

type Props = {
  entrega: EntregaListItem;
  subtitle?: string | null;
};

function statusColor(kind: DetailStatusKind, colors: ReturnType<typeof useThemeColors>): string {
  switch (kind) {
    case "pendente":
      return colors.warning;
    case "ausente":
      return colors.danger;
    case "entregue":
      return colors.success;
    case "cancelado":
      return colors.textSecondary;
  }
}

export default function DetailStatusHero({ entrega, subtitle }: Props) {
  const colors = useThemeColors();
  const kind = resolveDetailStatusKind(entrega);
  const accent = statusColor(kind, colors);
  const servico = servicoTipo(entrega.servico);

  const autoSubtitle =
    subtitle ??
    (kind === "entregue"
      ? formatDetailDateTimeLabel("Finalizada às", entrega.data_hora_entrega)
      : null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: accent + "55",
          padding: 16,
          marginBottom: 12,
        },
        badge: {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: accent + "22",
          marginBottom: 10,
        },
        badgeText: { fontSize: 12, fontWeight: "800", color: accent, letterSpacing: 0.5 },
        codigo: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 4 },
        servico: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
        subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
      }),
    [colors, accent]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{statusLabelUpper(kind)}</Text>
      </View>
      <Text style={styles.codigo} numberOfLines={1} ellipsizeMode="middle">
        {entrega.codigo ?? `Pedido ${entrega.id_saida}`}
      </Text>
      <Text style={styles.servico}>{servico}</Text>
      {autoSubtitle ? <Text style={styles.subtitle}>{autoSubtitle}</Text> : null}
    </View>
  );
}
