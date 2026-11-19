import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import EntregaCodigoHeader from "../../entregas/components/EntregaCodigoHeader";
import { codigoExibicaoEntrega } from "../../entregas/utils/codigoExibicaoEntrega";
import type { SaidaListItem } from "../saidasApi";
import { statusVisualSaida } from "../utils/operacaoStatusUtils";
import ChipTamanhoG from "./ChipTamanhoG";

type Props = {
  item: SaidaListItem;
  onPress: () => void;
  compact?: boolean;
};

function strField(item: SaidaListItem, key: string): string | null {
  const v = item[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export default function ConsultaCodigoCard({ item, onPress, compact = false }: Props) {
  const colors = useThemeColors();
  const sv = statusVisualSaida(item.status as string);
  const dataEntrada = typeof item.data === "string" ? item.data : null;
  const codigo = codigoExibicaoEntrega({
    codigo: item.codigo,
    codigo_exibicao: strField(item, "codigo_exibicao"),
    id_saida: typeof item.id_saida === "number" ? item.id_saida : undefined,
  });
  const cliente = strField(item, "cliente") || strField(item, "destinatario");
  const bairro = strField(item, "bairro");
  const endereco = strField(item, "endereco") || strField(item, "endereco_formatado");

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
        codigo={codigo || item.codigo}
        servico={item.servico}
        exibicao={sv.label}
        data={dataEntrada}
        compact={compact}
        statusBadgeBg={sv.bg}
        statusBadgeFg={sv.fg}
        style={{ marginBottom: compact ? 8 : 10 }}
      />
      {item.is_grande && item.categoria_g_nome ? (
        <ChipTamanhoG nome={item.categoria_g_nome} style={{ marginBottom: 6 }} />
      ) : null}
      {cliente ? <Text style={styles.meta}>{cliente}</Text> : null}
      {bairro ? <Text style={styles.meta}>{bairro}</Text> : null}
      {endereco && !compact ? <Text style={styles.meta}>{endereco}</Text> : null}
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
