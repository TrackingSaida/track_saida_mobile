import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SituacaoBaseColeta } from "../coletasApi";
import { situacaoColetaBadgeColors, statusColetaLabel } from "../utils/coletaSituacaoUi";

export default function ColetaSituacaoBadge({
  status,
}: {
  status: SituacaoBaseColeta["status"];
}) {
  const c = situacaoColetaBadgeColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.fg }]}>{statusColetaLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "800",
    fontSize: 11,
  },
});
