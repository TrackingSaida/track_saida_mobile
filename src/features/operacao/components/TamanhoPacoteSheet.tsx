import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import { formatApiError } from "../../../utils/formatApiError";
import {
  definirTamanhoPacote,
  listarCategoriasG,
  type CategoriaG,
  type TamanhoPacoteResult,
} from "../pacoteGApi";

type Props = {
  visible: boolean;
  idSaida: number | null;
  codigo?: string | null;
  /** Categoria atual (null = Normal). */
  categoriaAtualId?: number | null;
  onClose: () => void;
  onSaved: (result: TamanhoPacoteResult) => void;
};

export default function TamanhoPacoteSheet({
  visible,
  idSaida,
  codigo,
  categoriaAtualId = null,
  onClose,
  onSaved,
}: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [categorias, setCategorias] = useState<CategoriaG[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<number | null>(categoriaAtualId ?? null);

  useEffect(() => {
    if (!visible) return;
    setSelecionada(categoriaAtualId ?? null);
    setErro(null);
    let cancelado = false;
    setCarregando(true);
    void listarCategoriasG()
      .then((itens) => {
        if (!cancelado) setCategorias(itens);
      })
      .catch((err) => {
        if (!cancelado) setErro(formatApiError(err, "Não foi possível carregar os tamanhos."));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [visible, categoriaAtualId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: 20,
          paddingBottom: Math.max(20, insets.bottom + 12),
          maxHeight: "80%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text },
        sub: { fontSize: 14, color: colors.textSecondary, marginTop: 2, marginBottom: 14 },
        opcao: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginBottom: 8,
        },
        opcaoAtiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        opcaoNome: { fontSize: 16, fontWeight: "700", color: colors.text },
        opcaoDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        erro: { color: "#dc3545", fontSize: 14, marginTop: 4 },
        vazio: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
        acoes: { flexDirection: "row", gap: 10, marginTop: 12 },
        btnSec: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          alignItems: "center",
        },
        btnSecTexto: { fontWeight: "600", color: colors.text },
        btnPri: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center" },
        btnPriTexto: { color: colors.primaryContrast, fontSize: 16, fontWeight: "700" },
      }),
    [colors, insets.bottom]
  );

  const opcoes: Array<{ id: number | null; nome: string; descricao?: string | null }> = [
    { id: null, nome: "Normal", descricao: "Sem adicional de pacote grande" },
    ...categorias.map((c) => ({ id: c.id, nome: c.nome, descricao: c.descricao })),
  ];
  const mudou = (selecionada ?? null) !== (categoriaAtualId ?? null);

  const salvar = async () => {
    if (idSaida == null || salvando) return;
    if (!mudou) {
      onClose();
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await definirTamanhoPacote(idSaida, selecionada);
      const nome =
        selecionada == null ? null : res.categoria_g_nome || categorias.find((c) => c.id === selecionada)?.nome || null;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved({ categoria_g_id: selecionada, categoria_g_nome: nome });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível alterar o tamanho do pacote.");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Tamanho do pacote</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {codigo || "—"}
          </Text>
          {carregando ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {opcoes.map((op) => {
                const ativa = (selecionada ?? null) === op.id;
                return (
                  <TouchableOpacity
                    key={op.id ?? "normal"}
                    style={[styles.opcao, ativa && styles.opcaoAtiva]}
                    onPress={() => setSelecionada(op.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ativa }}
                  >
                    <Ionicons
                      name={ativa ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={ativa ? colors.primary : colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.opcaoNome}>{op.nome}</Text>
                      {op.descricao ? <Text style={styles.opcaoDesc}>{op.descricao}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {!categorias.length && !erro ? (
                <Text style={styles.vazio}>Nenhum tamanho de pacote grande cadastrado.</Text>
              ) : null}
            </ScrollView>
          )}
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          <View style={styles.acoes}>
            <TouchableOpacity style={styles.btnSec} onPress={onClose} accessibilityRole="button">
              <Text style={styles.btnSecTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPri, (salvando || carregando) && { opacity: 0.6 }]}
              onPress={() => void salvar()}
              disabled={salvando || carregando}
              accessibilityRole="button"
            >
              {salvando ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={styles.btnPriTexto}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
