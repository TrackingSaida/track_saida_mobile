import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  nome?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** Chip do tamanho do pacote grande (G1, G2…). Não renderiza para pacote normal. */
export default function ChipTamanhoG({ nome, style }: Props) {
  const texto = String(nome || "").trim();
  if (!texto) return null;
  return (
    <View
      style={[styles.chip, style]}
      accessibilityLabel={`Pacote grande ${texto}`}
    >
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#fff3cd",
    borderWidth: 1,
    borderColor: "#f0c36d",
  },
  texto: { fontSize: 12, fontWeight: "800", color: "#7a4d00" },
});
