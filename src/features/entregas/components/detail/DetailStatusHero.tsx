import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "../../../../theme/colors";
import type { EntregaListItem } from "../../types";
import EntregaCodigoHeader from "../EntregaCodigoHeader";
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
        subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
      }),
    [colors, accent]
  );

  return (
    <View style={styles.wrap}>
      <EntregaCodigoHeader
        codigo={entrega.codigo ?? `Pedido ${entrega.id_saida}`}
        servico={entrega.servico}
        exibicao={entrega.exibicao ?? statusLabelUpper(kind)}
        data={entrega.data}
        tentativa={entrega.tentativa}
      />
      {autoSubtitle ? <Text style={styles.subtitle}>{autoSubtitle}</Text> : null}
    </View>
  );
}
