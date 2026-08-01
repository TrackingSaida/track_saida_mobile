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
  /** Outbox ainda enviando foto/status ao servidor. */
  awaitingSync?: boolean;
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

export default function DetailStatusHero({ entrega, subtitle, awaitingSync }: Props) {
  const colors = useThemeColors();
  const kind = resolveDetailStatusKind(entrega);
  const accent = awaitingSync ? colors.warning : statusColor(kind, colors);

  const autoSubtitle =
    subtitle ??
    (awaitingSync
      ? "Enviando comprovante ao servidor… não marque de novo."
      : kind === "entregue"
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
        syncBadge: {
          marginTop: 8,
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: colors.warning + "22",
        },
        syncBadgeText: { fontSize: 12, fontWeight: "700", color: colors.warning },
      }),
    [colors, accent]
  );

  return (
    <View style={styles.wrap}>
      <EntregaCodigoHeader
        codigo={entrega.codigo ?? `Pedido ${entrega.id_saida}`}
        servico={entrega.servico}
        exibicao={awaitingSync ? "Enviando…" : entrega.exibicao ?? statusLabelUpper(kind)}
        data={entrega.data}
        tentativa={entrega.tentativa}
      />
      {autoSubtitle ? <Text style={styles.subtitle}>{autoSubtitle}</Text> : null}
      {awaitingSync ? (
        <View style={styles.syncBadge}>
          <Text style={styles.syncBadgeText}>Aguardando confirmação</Text>
        </View>
      ) : null}
    </View>
  );
}
