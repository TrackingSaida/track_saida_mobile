import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../../components/ui/AppText";
import { useThemeColors } from "../../theme/colors";
import { radius, space } from "../../theme/spacing";
import { textStyle } from "../../theme/typography";
import { CATEGORIA_LABEL, type Tutorial } from "./types";
import { duracaoPorExtenso, formatarDuracao } from "./tutorialConsulta";
import { urlsDoVideo } from "./youtube";

type Props = {
  tutorial: Tutorial;
  onPress: (tutorial: Tutorial) => void;
};

export default function TutorialCard({ tutorial, onPress }: Props) {
  const colors = useThemeColors();
  const [miniaturaFalhou, setMiniaturaFalhou] = useState(false);
  const urls = urlsDoVideo(tutorial.youtubeVideoId);
  const mostrarImagem = Boolean(urls) && !miniaturaFalhou;
  const episodio = String(tutorial.episodio).padStart(2, "0");
  const duracao = formatarDuracao(tutorial.duracaoSegundos);
  const categoria = CATEGORIA_LABEL[tutorial.categoria];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space.sm,
          backgroundColor: colors.backgroundCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: 10,
          marginBottom: 10,
        },
        thumb: {
          width: 112,
          height: 84,
          borderRadius: 10,
          backgroundColor: "#0b0b0b",
          overflow: "hidden",
        },
        image: { width: "100%", height: "100%" },
        play: {
          position: "absolute",
          top: 28,
          left: 42,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 2,
        },
        duracao: {
          position: "absolute",
          right: 4,
          bottom: 4,
          backgroundColor: "rgba(0,0,0,0.72)",
          borderRadius: 4,
          paddingHorizontal: 4,
          paddingVertical: 1,
        },
        duracaoTexto: { ...textStyle("badge"), color: "#fff", fontWeight: "700" },
        meta: { flex: 1, minWidth: 0, alignItems: "flex-start" },
        episodio: { ...textStyle("label"), color: colors.textSecondary, fontWeight: "700" },
        titulo: { ...textStyle("bodySmall"), color: colors.text, fontWeight: "700", marginTop: 2 },
        descricao: { ...textStyle("caption"), color: colors.textSecondary, marginTop: 2, marginBottom: 6 },
        tag: {
          backgroundColor: colors.chipBackground,
          borderRadius: radius.full,
          paddingHorizontal: 8,
          minHeight: 20,
          justifyContent: "center",
        },
        tagTexto: { ...textStyle("label"), color: colors.textSecondary, fontWeight: "700" },
      }),
    [colors]
  );

  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(tutorial)}
      accessibilityRole="button"
      accessibilityLabel={`Assistir: ${tutorial.titulo}, ${duracaoPorExtenso(tutorial.duracaoSegundos)}, categoria ${categoria}`}
    >
      <View style={styles.thumb}>
        {mostrarImagem && urls ? (
          <Image
            source={{ uri: urls.miniatura }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setMiniaturaFalhou(true)}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={styles.play} accessibilityElementsHidden>
          <Ionicons name="play" size={14} color={colors.primaryContrast} />
        </View>
        <View style={styles.duracao}>
          <AppText style={styles.duracaoTexto}>{duracao}</AppText>
        </View>
      </View>
      <View style={styles.meta}>
        <AppText style={styles.episodio}>Episódio {episodio}</AppText>
        <AppText style={styles.titulo} numberOfLines={2}>
          {tutorial.titulo}
        </AppText>
        <AppText style={styles.descricao} numberOfLines={2}>
          {tutorial.descricao}
        </AppText>
        <View style={styles.tag}>
          <AppText style={styles.tagTexto}>{categoria}</AppText>
        </View>
      </View>
    </Pressable>
  );
}
