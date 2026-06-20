import React, { useMemo } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import type { EntregaHistoricoItem, EntregaListItem } from "../../types";
import { useThemeColors } from "../../../../theme/colors";
import DetailInfoBlock, { DetailFieldRow } from "./DetailInfoBlock";
import { buildOperacaoResumoRows } from "../../utils/operacaoResumoUtils";

type Props = {
  entrega: EntregaListItem;
  historico: EntregaHistoricoItem[];
  onOpenTimeline: () => void;
};

export default function DetailOperacaoResumoBlock({ entrega, historico, onOpenTimeline }: Props) {
  const colors = useThemeColors();
  const rows = useMemo(
    () => buildOperacaoResumoRows(entrega, historico),
    [entrega, historico]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        link: {
          marginTop: 4,
          paddingVertical: 10,
          alignItems: "center",
        },
        linkText: {
          fontSize: 14,
          fontWeight: "700",
          color: colors.primary,
        },
      }),
    [colors.primary]
  );

  if (rows.length === 0) return null;

  return (
    <DetailInfoBlock title="Resumo da operação" icon="time-outline">
      {rows.map((row) => (
        <DetailFieldRow key={row.label} label={row.label} value={row.value} />
      ))}
      <TouchableOpacity style={styles.link} onPress={onOpenTimeline} activeOpacity={0.7}>
        <Text style={styles.linkText}>Ver linha do tempo</Text>
      </TouchableOpacity>
    </DetailInfoBlock>
  );
}
