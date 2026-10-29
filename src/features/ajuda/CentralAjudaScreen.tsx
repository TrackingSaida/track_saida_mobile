import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../components/ScreenHeaderBar";
import AppText from "../../components/ui/AppText";
import { useFontScale } from "../../hooks/useFontScale";
import { useAuthStore } from "../../store/authStore";
import { useThemeColors } from "../../theme/colors";
import { radius, space } from "../../theme/spacing";
import { textStyle } from "../../theme/typography";
import type { MaisStackParamList } from "../../screens/MaisScreen";
import { abrirTutorial } from "./abrirTutorial";
import { listarTutoriais } from "./catalogo";
import TutorialCard from "./TutorialCard";
import {
  categoriasVisiveis,
  filtrarTutoriais,
  normalizarPapel,
  tutoriaisDoPerfil,
} from "./tutorialConsulta";
import { CATEGORIA_LABEL, type CategoriaTutorial, type Tutorial } from "./types";

type Props = NativeStackScreenProps<MaisStackParamList, "CentralAjuda">;

const LIME = "#C6F531";

export default function CentralAjudaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { ms } = useFontScale();
  const role = useAuthStore((s) => s.currentUser?.role);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaTutorial | "todos">("todos");
  const [tentativa, setTentativa] = useState(0);

  const carregamento = useMemo(() => {
    try {
      return {
        itens: tutoriaisDoPerfil(listarTutoriais(), normalizarPapel(role)),
        erro: false,
      };
    } catch {
      return { itens: [] as Tutorial[], erro: true };
    }
  }, [role, tentativa]);
  const doPerfil = carregamento.itens;
  const erro = carregamento.erro;

  const categorias = useMemo(() => categoriasVisiveis(doPerfil), [doPerfil]);
  const categoriaAtiva = categoria === "todos" || categorias.includes(categoria) ? categoria : "todos";
  const visiveis = useMemo(
    () => filtrarTutoriais(doPerfil, { categoria: categoriaAtiva, busca }),
    [doPerfil, categoriaAtiva, busca]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        list: { paddingHorizontal: space.md, paddingBottom: space.xxl + insets.bottom },
        brand: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.sm },
        pin: { width: 24, height: 24 },
        wordmark: {
          ...textStyle("bodySmall"),
          fontWeight: "800",
          letterSpacing: 0.8,
          color: colors.text,
        },
        lime: { color: LIME, fontWeight: "800" },
        intro: { ...textStyle("bodySmall"), color: colors.textSecondary, marginTop: 4, marginBottom: space.sm },
        search: {
          minHeight: ms(44),
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: radius.md,
          paddingHorizontal: space.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: space.sm,
        },
        input: {
          flex: 1,
          minWidth: 0,
          color: colors.text,
          fontSize: 15,
          paddingVertical: 10,
        },
        clear: { minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" },
        chips: { flexDirection: "row", gap: 8, marginBottom: space.sm },
        chip: {
          minHeight: ms(36),
          paddingHorizontal: 14,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.chipBackground,
          alignItems: "center",
          justifyContent: "center",
        },
        chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { ...textStyle("bodySmall"), fontWeight: "600", color: colors.text },
        chipTextOn: { color: colors.primaryContrast },
        empty: { alignItems: "center", paddingHorizontal: space.md, paddingTop: 36 },
        emptyTitle: { ...textStyle("subtitle"), fontWeight: "700", color: colors.text, textAlign: "center" },
        emptyBody: {
          ...textStyle("bodySmall"),
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: 6,
          marginBottom: 14,
        },
        retry: {
          minHeight: ms(44),
          paddingHorizontal: space.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        retryText: { ...textStyle("bodySmall"), color: colors.primary, fontWeight: "700" },
      }),
    [colors, insets.bottom, ms]
  );

  const abrir = useCallback((tutorial: Tutorial) => {
    void abrirTutorial(tutorial.youtubeVideoId);
  }, []);

  const header = (
    <View>
      <View style={styles.brand}>
        <Image
          source={require("../../../assets/logo-pin.png")}
          style={styles.pin}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <AppText style={styles.wordmark} accessibilityLabel="ROTEVO ENSINA">
          ROT<AppText style={styles.lime}>E</AppText>VO ENSINA
        </AppText>
      </View>
      <AppText style={styles.intro}>Aprenda a utilizar o ROTEVO com tutoriais rápidos.</AppText>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.input}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar tutorial..."
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Buscar tutorial..."
          returnKeyType="search"
        />
        {busca ? (
          <Pressable
            style={styles.clear}
            onPress={() => setBusca("")}
            accessibilityRole="button"
            accessibilityLabel="Limpar pesquisa"
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {!erro && categorias.length > 0 ? (
        <View style={styles.chips}>
          <Chip
            label="Todos"
            selected={categoriaAtiva === "todos"}
            onPress={() => setCategoria("todos")}
            styles={styles}
          />
          {categorias.map((item) => (
            <Chip
              key={item}
              label={CATEGORIA_LABEL[item]}
              selected={categoriaAtiva === item}
              onPress={() => setCategoria(item)}
              styles={styles}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Central de Ajuda"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <FlatList
        data={erro ? [] : visiveis}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TutorialCard tutorial={item} onPress={abrir} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EstadoVazio
            erro={erro}
            temCatalogo={doPerfil.length > 0}
            onLimpar={() => {
              setBusca("");
              setCategoria("todos");
            }}
            onTentar={() => setTentativa((valor) => valor + 1)}
            styles={styles}
          />
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: {
    chip: object;
    chipOn: object;
    chipText: object;
    chipTextOn: object;
  };
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <AppText style={[styles.chipText, selected && styles.chipTextOn]}>{label}</AppText>
    </Pressable>
  );
}

function EstadoVazio({
  erro,
  temCatalogo,
  onLimpar,
  onTentar,
  styles,
}: {
  erro: boolean;
  temCatalogo: boolean;
  onLimpar: () => void;
  onTentar: () => void;
  styles: {
    empty: object;
    emptyTitle: object;
    emptyBody: object;
    retry: object;
    retryText: object;
  };
}) {
  if (erro) {
    return (
      <View style={styles.empty}>
        <AppText style={styles.emptyTitle}>Não foi possível carregar os tutoriais.</AppText>
        <AppText style={styles.emptyBody}>Verifique a conexão e tente novamente.</AppText>
        <Pressable style={styles.retry} onPress={onTentar} accessibilityRole="button">
          <AppText style={styles.retryText}>Tentar novamente</AppText>
        </Pressable>
      </View>
    );
  }
  if (!temCatalogo) {
    return (
      <View style={styles.empty}>
        <AppText style={styles.emptyTitle}>Os tutoriais estarão disponíveis em breve.</AppText>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <AppText style={styles.emptyTitle}>Nenhum tutorial encontrado.</AppText>
      <AppText style={styles.emptyBody}>Tente pesquisar por outro assunto.</AppText>
      <Pressable style={styles.retry} onPress={onLimpar} accessibilityRole="button">
        <AppText style={styles.retryText}>Limpar pesquisa</AppText>
      </Pressable>
    </View>
  );
}
