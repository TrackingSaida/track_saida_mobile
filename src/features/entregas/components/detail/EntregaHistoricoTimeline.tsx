import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../../theme/colors";
import type { EntregaHistoricoItem, EntregaListItem } from "../../types";
import {
  coresEventoHistorico,
  findLastHistoricoIndexByKeys,
  formatEventoTimestamp,
  iconEventoHistorico,
  isEventoAusencia,
  isEventoCancelamento,
  isEventoEntrega,
  labelEventoHistorico,
} from "../../../operacao/utils/operacaoHistoricoUtils";

type Props = {
  historico: EntregaHistoricoItem[];
  entrega: EntregaListItem;
  comprovanteUris?: string[];
  comprovanteLoading?: boolean;
  onVerComprovante?: (index: number) => void;
};

function formatDocumento(tipo?: string | null, numero?: string | null): string | null {
  const t = String(tipo ?? "").trim();
  const n = String(numero ?? "").trim();
  if (t && n) return `${t} ${n}`;
  if (n) return n;
  if (t) return t;
  return null;
}

export default function EntregaHistoricoTimeline({
  historico,
  entrega,
  comprovanteUris = [],
  comprovanteLoading,
  onVerComprovante,
}: Props) {
  const colors = useThemeColors();

  const lastEntregaIndex = useMemo(
    () => findLastHistoricoIndexByKeys(historico, isEventoEntrega),
    [historico]
  );
  const lastAusenciaIndex = useMemo(
    () => findLastHistoricoIndexByKeys(historico, isEventoAusencia),
    [historico]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        empty: { fontSize: 14, color: colors.textSecondary, textAlign: "center", paddingVertical: 16 },
        track: {
          paddingLeft: 8,
          borderLeftWidth: 2,
          borderLeftColor: colors.inputBorder,
        },
        step: {
          flexDirection: "row",
          alignItems: "flex-start",
          marginBottom: 18,
          marginLeft: -17,
          gap: 10,
        },
        dot: {
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.backgroundCard,
          borderWidth: 2,
        },
        body: { flex: 1, paddingTop: 2 },
        label: { fontSize: 14, fontWeight: "700", color: colors.text, lineHeight: 20 },
        when: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
        who: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        extraBlock: { marginTop: 8, gap: 4 },
        extraLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
        extraValue: { fontSize: 13, color: colors.text, lineHeight: 18 },
        thumbRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
        thumb: { width: 80, height: 80, borderRadius: 10 },
      }),
    [colors]
  );

  if (historico.length === 0) {
    return <Text style={styles.empty}>Sem eventos registrados para este pedido.</Text>;
  }

  const recebedor = String(entrega.nome_recebedor ?? "").trim();
  const documento = formatDocumento(entrega.tipo_documento, entrega.numero_documento);
  const tipoRecebedor = String(entrega.tipo_recebedor ?? "").trim();
  const motivo = String(entrega.motivo_ocorrencia ?? "").trim();
  const observacao = String(entrega.observacao_ocorrencia ?? "").trim();
  const tentativa = entrega.tentativa ?? 1;

  return (
    <View style={styles.track}>
      {historico.map((item, index) => {
        const key = String(item.id ?? `${item.evento}-${item.timestamp}-${index}`);
        const palette = coresEventoHistorico(item.evento);
        const label = labelEventoHistorico(item.evento, item.acao_label);
        const quando = formatEventoTimestamp(item.timestamp);
        const quem = String(item.usuario_nome ?? "").trim();
        const showEntregaExtras = isEventoEntrega(item.evento) && index === lastEntregaIndex;
        const showAusenciaExtras = isEventoAusencia(item.evento) && index === lastAusenciaIndex;
        const showCancelExtras = isEventoCancelamento(item.evento);
        const showComprovante =
          comprovanteUris.length > 0 &&
          !comprovanteLoading &&
          onVerComprovante &&
          ((isEventoEntrega(item.evento) && index === lastEntregaIndex) ||
            (isEventoAusencia(item.evento) && index === lastAusenciaIndex));

        return (
          <View key={key} style={styles.step}>
            <View style={[styles.dot, { borderColor: palette.dot }]}>
              <Ionicons name={iconEventoHistorico(item.evento)} size={14} color={palette.dot} />
            </View>
            <View style={styles.body}>
              <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
              <Text style={styles.when}>{quando}</Text>
              {quem ? <Text style={styles.who}>por {quem}</Text> : null}

              {showEntregaExtras && (recebedor || documento || tipoRecebedor) ? (
                <View style={styles.extraBlock}>
                  {recebedor ? (
                    <Text style={styles.extraValue}>
                      <Text style={styles.extraLabel}>Recebedor: </Text>
                      {recebedor}
                    </Text>
                  ) : null}
                  {documento ? (
                    <Text style={styles.extraValue}>
                      <Text style={styles.extraLabel}>Documento: </Text>
                      {documento}
                    </Text>
                  ) : null}
                  {tipoRecebedor ? (
                    <Text style={styles.extraValue}>
                      <Text style={styles.extraLabel}>Tipo: </Text>
                      {tipoRecebedor}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {showAusenciaExtras ? (
                <View style={styles.extraBlock}>
                  {motivo ? (
                    <>
                      <Text style={styles.extraLabel}>Motivo:</Text>
                      <Text style={styles.extraValue}>{motivo}</Text>
                    </>
                  ) : null}
                  {observacao ? (
                    <>
                      <Text style={styles.extraLabel}>Observação:</Text>
                      <Text style={styles.extraValue}>{observacao}</Text>
                    </>
                  ) : null}
                  {tentativa >= 2 ? (
                    <Text style={styles.extraValue}>
                      <Text style={styles.extraLabel}>Tentativa: </Text>
                      {tentativa}ª tentativa
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {showCancelExtras && motivo ? (
                <View style={styles.extraBlock}>
                  <Text style={styles.extraLabel}>Motivo:</Text>
                  <Text style={styles.extraValue}>{motivo}</Text>
                </View>
              ) : null}

              {comprovanteLoading && showEntregaExtras ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} />
              ) : null}

              {showComprovante ? (
                <View style={styles.thumbRow}>
                  {comprovanteUris.map((uri, photoIndex) => (
                    <TouchableOpacity
                      key={`${photoIndex}-${uri.slice(0, 24)}`}
                      onPress={() => onVerComprovante?.(photoIndex)}
                      activeOpacity={0.88}
                      accessibilityLabel={`Ver comprovante ${photoIndex + 1}`}
                    >
                      <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
