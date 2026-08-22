import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useThemeColors } from "../../../theme/colors";
import { formatApiError } from "../../../utils/formatApiError";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import {
  listarLeiturasColeta,
  removerLeituraColeta,
  type LeituraColetaItem,
  type TotaisColetaBase,
} from "../coletasApi";
import { hojeOperacaoLocal } from "../utils/coletaSituacaoUi";
import type { ColetasFluxoParamList } from "../../../navigation/staffStackTypes";

function formatHorario(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function LeiturasColetaScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<ColetasFluxoParamList>>();
  const route = useRoute<RouteProp<ColetasFluxoParamList, "LeiturasColeta">>();
  const { baseId, baseNome, dataOperacao } = route.params;
  const dataRef = dataOperacao || hojeOperacaoLocal();

  const [itens, setItens] = useState<LeituraColetaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 32 },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
        empty: { paddingVertical: 40, alignItems: "center" },
        emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: "center" },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.border,
        },
        codigo: { fontSize: 15, fontWeight: "700", color: colors.text },
        meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
        row: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8, flexWrap: "wrap" },
        chip: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: colors.background,
        },
        chipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
        btnRemover: {
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: "rgba(220,53,69,0.12)",
        },
        btnRemoverText: { color: "#dc3545", fontWeight: "700", fontSize: 13 },
        btnDisabled: { opacity: 0.5 },
        footer: { paddingVertical: 16, alignItems: "center" },
        bloqueio: { fontSize: 12, color: colors.textSecondary, marginTop: 6, fontStyle: "italic" },
      }),
    [colors]
  );

  const carregar = useCallback(
    async (opts?: { reset?: boolean; cursorValue?: string | null }) => {
      const reset = opts?.reset !== false && !opts?.cursorValue;
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const payload = await listarLeiturasColeta({
          baseId,
          dataOperacao: dataRef,
          limit: 40,
          cursor: opts?.cursorValue ?? null,
        });
        setItens((prev) => (opts?.cursorValue ? [...prev, ...payload.itens] : payload.itens));
        setCursor(payload.next_cursor);
        setHasMore(Boolean(payload.has_more && payload.next_cursor));
      } catch (error) {
        Alert.alert("Erro", formatApiError(error, "Não foi possível carregar as leituras."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [baseId, dataRef]
  );

  useFocusEffect(
    useCallback(() => {
      void carregar({ reset: true });
    }, [carregar])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void carregar({ reset: true });
  }, [carregar]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore || loading || !cursor) return;
    void carregar({ reset: false, cursorValue: cursor });
  }, [carregar, cursor, hasMore, loading, loadingMore]);

  const aplicarTotaisNaVolta = useCallback(
    (totais: TotaisColetaBase) => {
      navigation.navigate({
        name: "LeituraColetas",
        params: { baseId, baseNome },
        merge: true,
      });
      // Totais são aplicados na tela anterior via focus + resumo; guardamos em route params opcionalmente.
      // A tela de leitura recarrega o resumo no focus.
      void totais;
    },
    [baseId, baseNome, navigation]
  );

  const confirmarRemover = useCallback(
    (item: LeituraColetaItem) => {
      if (!item.pode_remover) {
        Alert.alert("Remoção indisponível", item.motivo_bloqueio || "Esta leitura não pode ser removida.");
        return;
      }
      Alert.alert(
        "Remover leitura",
        `Remover o código ${item.codigo}? Esta ação atualiza os totais da coleta.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Remover",
            style: "destructive",
            onPress: () => {
              void (async () => {
                const snapshot = item;
                setRemovendoId(item.id_saida);
                setItens((prev) => prev.filter((x) => x.id_saida !== item.id_saida));
                try {
                  const result = await removerLeituraColeta(item.id_saida);
                  aplicarTotaisNaVolta(result.totais);
                } catch (error) {
                  setItens((prev) => {
                    if (prev.some((x) => x.id_saida === snapshot.id_saida)) return prev;
                    return [snapshot, ...prev];
                  });
                  Alert.alert(
                    "Não foi possível remover",
                    formatApiError(error, "A leitura foi restaurada na lista.")
                  );
                } finally {
                  setRemovendoId(null);
                }
              })();
            },
          },
        ]
      );
    },
    [aplicarTotaisNaVolta]
  );

  const renderItem = useCallback(
    ({ item }: { item: LeituraColetaItem }) => (
      <View style={styles.card}>
        <Text style={styles.codigo}>{item.codigo}</Text>
        <Text style={styles.meta}>
          {item.servico || "Serviço"} · {formatHorario(item.horario)} · {item.operador}
        </Text>
        <View style={styles.row}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{item.situacao}</Text>
          </View>
        </View>
        {!item.pode_remover && item.motivo_bloqueio ? (
          <Text style={styles.bloqueio}>{item.motivo_bloqueio}</Text>
        ) : null}
        {item.pode_remover ? (
          <TouchableOpacity
            style={[styles.btnRemover, removendoId === item.id_saida && styles.btnDisabled]}
            onPress={() => confirmarRemover(item)}
            disabled={removendoId === item.id_saida}
            accessibilityRole="button"
            accessibilityLabel={`Remover leitura ${item.codigo}`}
          >
            {removendoId === item.id_saida ? (
              <ActivityIndicator size="small" color="#dc3545" />
            ) : (
              <Text style={styles.btnRemoverText}>Remover</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    ),
    [confirmarRemover, removendoId, styles]
  );

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Leituras"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <Text style={[styles.subtitle, { paddingHorizontal: 16 }]}>
        {baseNome} · {dataRef}
      </Text>
      {loading && itens.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(item) => String(item.id_saida)}
          renderItem={renderItem}
          contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma leitura registrada nesta base hoje.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
