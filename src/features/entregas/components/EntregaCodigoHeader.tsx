import React, { useMemo } from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { SERVICO_COLORS, servicoTipo } from "../utils/servico";
import { formatEntradaDataBadge } from "./detail/detailFormatters";

type Props = {
  codigo?: string | null;
  servico?: string | null;
  exibicao?: string | null;
  data?: string | null;
  tentativa?: number | null;
  leftAccessory?: React.ReactNode;
  codigoFallback?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  /** Quando informado, usa cores suaves (ex.: consulta operador) em vez do mapa sólido do motoboy. */
  statusBadgeBg?: string;
  statusBadgeFg?: string;
};

function badgeColorForExibicao(exibicao: string, colors: ReturnType<typeof useThemeColors>): string {
  if (exibicao === "Pendente") return colors.warning;
  if (exibicao === "Entregue") return colors.success;
  if (exibicao === "Ausente") return colors.danger;
  if (exibicao === "Cancelado") return colors.textSecondary;
  return colors.placeholder;
}

export default function EntregaCodigoHeader({
  codigo,
  servico,
  exibicao,
  data,
  tentativa,
  leftAccessory,
  codigoFallback = "—",
  style,
  compact = false,
  statusBadgeBg,
  statusBadgeFg,
}: Props) {
  const colors = useThemeColors();
  const servicoLabel = servicoTipo(servico);
  const servicoColor = SERVICO_COLORS[servicoLabel] || colors.placeholder;
  const statusLabel = (exibicao || "—").trim() || "—";
  const useSoftStatus = Boolean(statusBadgeBg && statusBadgeFg);
  const statusColor = useSoftStatus ? statusBadgeBg! : badgeColorForExibicao(statusLabel, colors);
  const statusTextColor = useSoftStatus ? statusBadgeFg! : "#fff";
  const entradaLabel = formatEntradaDataBadge(data);
  const showEntradaBadge = entradaLabel !== "—";
  const badgeTextColor = servicoLabel === "Flex" ? "#6a5a00" : "#fff";
  const isAvulso = servicoLabel === "Avulso";
  const codigoEllipsize = isAvulso ? "tail" : "middle";
  const codigoLines = isAvulso && !compact ? 2 : 1;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
        left: { flex: 1, minWidth: 0 },
        codigo: {
          fontSize: compact ? 15 : 17,
          fontWeight: "700",
          color: colors.text,
          marginBottom: compact ? 0 : 0,
          flexShrink: 1,
        },
        rightCol: { alignItems: "flex-end", maxWidth: "48%" },
        badgesRow: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
        servicoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
        servicoBadgeText: { fontSize: 11, fontWeight: "600" },
        statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
        statusBadgeText: { fontSize: 12, color: "#fff", fontWeight: "600" },
        entradaBadge: {
          marginTop: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        },
        entradaBadgeText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
        tentativaBadge: { fontSize: 11, color: colors.textSecondary, marginLeft: 4 },
      }),
    [colors, compact]
  );

  return (
    <View style={[styles.row, style]}>
      {leftAccessory}
      <View style={styles.left}>
        <Text style={styles.codigo} numberOfLines={codigoLines} ellipsizeMode={codigoEllipsize}>
          {codigo?.trim() || codigoFallback}
        </Text>
      </View>
      <View style={styles.rightCol}>
        <View style={styles.badgesRow}>
          <View style={[styles.servicoBadge, { backgroundColor: servicoColor }]}>
            <Text style={[styles.servicoBadgeText, { color: badgeTextColor }]}>{servicoLabel}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusTextColor }]}>{statusLabel}</Text>
          </View>
          {(tentativa ?? 1) >= 2 && (
            <Text style={styles.tentativaBadge}>{tentativa}ª tentativa</Text>
          )}
        </View>
        {showEntradaBadge ? (
          <View style={styles.entradaBadge}>
            <Text style={styles.entradaBadgeText}>{entradaLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export { formatEntradaDataBadge };
