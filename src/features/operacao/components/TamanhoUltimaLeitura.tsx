import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import ChipTamanhoG from "./ChipTamanhoG";
import TamanhoPacoteSheet from "./TamanhoPacoteSheet";
import type { TamanhoPacoteResult } from "../pacoteGApi";

type Props = {
  idSaida: number | null | undefined;
  codigo: string;
  categoriaId?: number | null;
  categoriaNome?: string | null;
  onAlterado: (res: TamanhoPacoteResult) => void;
  /** Avisa a tela para pausar o scanner enquanto o painel está aberto. */
  onAbertoChange?: (aberto: boolean) => void;
  /** Fundo escuro (rodapé da câmera). */
  escuro?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Atalho do scanner: marca o tamanho do último pacote lido sem ir em Consultar. */
export default function TamanhoUltimaLeitura({
  idSaida,
  codigo,
  categoriaId = null,
  categoriaNome = null,
  onAlterado,
  onAbertoChange,
  escuro = false,
  style,
}: Props) {
  const colors = useThemeColors();
  const [aberto, setAberto] = useState(false);
  if (idSaida == null) return null;

  const mudarAberto = (v: boolean) => {
    setAberto(v);
    onAbertoChange?.(v);
  };
  const cor = escuro ? "#fff" : colors.primary;

  return (
    <View style={[styles.row, style]}>
      <ChipTamanhoG nome={categoriaNome} />
      <TouchableOpacity
        style={[styles.btn, { borderColor: cor }]}
        onPress={() => mudarAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={`Tamanho do pacote ${codigo}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="cube-outline" size={15} color={cor} />
        <Text style={[styles.btnTexto, { color: cor }]}>Tamanho</Text>
      </TouchableOpacity>
      <TamanhoPacoteSheet
        visible={aberto}
        idSaida={idSaida}
        codigo={codigo}
        categoriaAtualId={categoriaNome ? categoriaId : null}
        onClose={() => mudarAberto(false)}
        onSaved={(res) => {
          mudarAberto(false);
          onAlterado(res);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnTexto: { fontSize: 13, fontWeight: "700" },
});
