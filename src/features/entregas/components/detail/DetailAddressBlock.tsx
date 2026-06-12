import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useThemeColors } from "../../../../theme/colors";
import type { EntregaListItem } from "../../types";
import { formatAddressLines } from "./detailFormatters";
import DetailInfoBlock from "./DetailInfoBlock";

type Props = {
  entrega: EntregaListItem;
  editable?: boolean;
  onEditPress?: () => void;
  onNavigatePress?: () => void;
  showPhone?: boolean;
};

export default function DetailAddressBlock({
  entrega,
  editable = false,
  onEditPress,
  onNavigatePress,
  showPhone = true,
}: Props) {
  const colors = useThemeColors();
  const lines = formatAddressLines(entrega);
  const telefone = entrega.contato?.replace(/\D/g, "") || "";
  const linkTel = telefone.length >= 10 ? `tel:+55${telefone}` : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        line: { fontSize: 15, color: colors.text, fontWeight: "500", lineHeight: 22 },
        empty: { fontSize: 15, color: colors.textSecondary, fontStyle: "italic" },
        phone: { fontSize: 15, color: colors.primary, fontWeight: "600", marginTop: 4 },
        btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
        btnOutline: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: "center",
        },
        btnOutlineText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
        btnSecondary: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          alignItems: "center",
        },
        btnSecondaryText: { color: colors.text, fontSize: 14, fontWeight: "700" },
      }),
    [colors]
  );

  return (
    <DetailInfoBlock title="Endereço" icon="location-outline">
      {!lines.hasAddress ? (
        <Text style={styles.empty}>Sem endereço cadastrado</Text>
      ) : (
        <>
          {lines.streetLine ? <Text style={styles.line}>{lines.streetLine}</Text> : null}
          {lines.complemento ? <Text style={styles.line}>{lines.complemento}</Text> : null}
          {lines.bairro ? <Text style={styles.line}>{lines.bairro}</Text> : null}
          {lines.cityStateCep ? <Text style={styles.line}>{lines.cityStateCep}</Text> : null}
        </>
      )}

      {showPhone && linkTel ? (
        <TouchableOpacity onPress={() => Linking.openURL(linkTel)}>
          <Text style={styles.phone}>{entrega.contato!.trim()}</Text>
        </TouchableOpacity>
      ) : null}

      {(editable && onEditPress) || onNavigatePress ? (
        <View style={styles.btnRow}>
          {editable && onEditPress ? (
            <TouchableOpacity style={styles.btnOutline} onPress={onEditPress}>
              <Text style={styles.btnOutlineText}>
                {entrega.possui_endereco ? "Editar Endereço" : "Adicionar Endereço"}
              </Text>
            </TouchableOpacity>
          ) : null}
          {onNavigatePress && lines.hasAddress ? (
            <TouchableOpacity style={styles.btnSecondary} onPress={onNavigatePress}>
              <Text style={styles.btnSecondaryText}>Navegar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </DetailInfoBlock>
  );
}
