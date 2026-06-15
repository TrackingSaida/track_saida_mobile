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
import { useThemeColors } from "../../../theme/colors";
import type { SaidaDetail, SaidaHistoricoItem } from "../saidasApi";
import OperacaoEmptyState from "./OperacaoEmptyState";
import {
  coresEventoHistorico,
  findLastHistoricoIndexByKeys,
  formatEventoTimestamp,
  iconEventoHistorico,
  isEventoAusencia,
  isEventoCancelamento,
  isEventoEntrega,
  labelEventoHistorico,
} from "../utils/operacaoHistoricoUtils";

type Props = {
  historico: SaidaHistoricoItem[];
  detail: SaidaDetail | null;
  comprovanteUris?: string[];
  comprovanteLoading?: boolean;
  onVerComprovante?: (index: number) => void;
};

function getDetailNested(detail: SaidaDetail | null) {
  return detail?.detail ?? null;
}

function formatDocumento(tipo?: string | null, numero?: string | null): string | null {
  const t = String(tipo ?? "").trim();
  const n = String(numero ?? "").trim();
  if (t && n) return `${t} ${n}`;
  if (n) return n;
  if (t) return t;
  return null;
}

function formatJustificativa(motivo?: string | null, observacao?: string | null): string | null {
  const parts = [String(motivo ?? "").trim(), String(observacao ?? "").trim()].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

export default function ConsultaPacoteHistoricoTimeline({
  historico,
  detail,
  comprovanteUris = [],
  comprovanteLoading,
  onVerComprovante,
}: Props) {
  const colors = useThemeColors();
  const nested = getDetailNested(detail);

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
        sectionTitle: {
          fontSize: 15,
          fontWeight: "700",
          color: colors.text,
          marginBottom: 14,
        },
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
        thumbRow: { flexDirection: "row", gap: 8, marginTop: 10 },
        thumbWrap: {
          borderRadius: 10,
          overflow: "hidden",
        },
        thumb: { width: 80, height: 80, borderRadius: 10 },
      }),
    [colors]
  );

  if (historico.length === 0) {
    return <OperacaoEmptyState message="Sem histórico disponível." icon="time-outline" />;
  }

  const recebedor = String(nested?.nome_recebedor ?? "").trim();
  const documento = formatDocumento(nested?.tipo_documento, nested?.numero_documento);
  const justificativa = formatJustificativa(nested?.motivo_ocorrencia, nested?.observacao_ocorrencia);

  return (
    <View style={{ marginTop: 4 }}>
      <Text style={styles.sectionTitle}>Histórico da movimentação</Text>
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

                {showEntregaExtras && (recebedor || documento) ? (
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
                  </View>
                ) : null}

                {(showAusenciaExtras || showCancelExtras) && justificativa ? (
                  <View style={styles.extraBlock}>
                    <Text style={styles.extraLabel}>
                      {showCancelExtras ? "Motivo:" : "Justificativa:"}
                    </Text>
                    <Text style={styles.extraValue}>{justificativa}</Text>
                  </View>
                ) : null}

                {comprovanteLoading && showEntregaExtras ? (
                  <View style={{ marginTop: 10 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null}

                {showComprovante && onVerComprovante ? (
                  <View style={styles.thumbRow}>
                    {comprovanteUris.map((uri, photoIndex) => (
                      <TouchableOpacity
                        key={`${photoIndex}-${uri.slice(0, 24)}`}
                        style={styles.thumbWrap}
                        onPress={() => onVerComprovante(photoIndex)}
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
    </View>
  );
}
