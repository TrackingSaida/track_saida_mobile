import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/colors";

export default function ColetaServicoBadges({
  shopee,
  mercadoLivre,
  avulso,
  total,
}: {
  shopee: number;
  mercadoLivre: number;
  avulso: number;
  total?: number;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      <View style={[styles.badge, styles.shopee]}>
        <Text style={[styles.value, { color: colors.text }]}>{shopee}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Shopee</Text>
      </View>
      <View style={[styles.badge, styles.flex]}>
        <Text style={[styles.value, { color: colors.text }]}>{mercadoLivre}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Flex</Text>
      </View>
      <View style={[styles.badge, styles.avulso]}>
        <Text style={[styles.value, { color: colors.text }]}>{avulso}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Avulso</Text>
      </View>
      {typeof total === "number" ? (
        <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.chipBackground }]}>
          <Text style={[styles.value, { color: colors.text }]}>{total}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Total</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  shopee: {
    backgroundColor: "rgba(238,77,45,0.10)",
    borderColor: "rgba(238,77,45,0.45)",
  },
  flex: {
    backgroundColor: "rgba(218,165,32,0.12)",
    borderColor: "rgba(218,165,32,0.55)",
  },
  avulso: {
    backgroundColor: "rgba(99,102,241,0.10)",
    borderColor: "rgba(99,102,241,0.45)",
  },
  value: {
    fontSize: 16,
    fontWeight: "800",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
});
