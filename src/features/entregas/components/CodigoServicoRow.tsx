import React, { useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { codigoExibicaoEntrega } from "../utils/codigoExibicaoEntrega";
import { servicoCanalLogo } from "../utils/servicoCanalLogo";

type Props = {
  codigo?: string | null;
  codigo_exibicao?: string | null;
  id_saida?: number;
  servico?: string | null;
  onPress?: () => void;
};

export default function CodigoServicoRow({
  codigo,
  codigo_exibicao,
  id_saida,
  servico,
  onPress,
}: Props) {
  const colors = useThemeColors();
  const logo = servicoCanalLogo(servico);
  const label = codigoExibicaoEntrega({ codigo, codigo_exibicao, id_saida });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.backgroundCard,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          marginBottom: 8,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        logo: { width: 28, height: 28, borderRadius: 6 },
        codigo: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
      }),
    [colors]
  );

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
    >
      {logo ? (
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : null}
      <Text style={styles.codigo} numberOfLines={1}>
        {label || "—"}
      </Text>
    </TouchableOpacity>
  );
}
