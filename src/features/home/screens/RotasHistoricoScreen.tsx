import React, { useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import { useHomeRouteStore, type CompletedRouteSummary } from "../../../store/homeRouteStore";
import { getRotaResumo } from "../../entregas/api";
import {
  useDiaRotaConcluidaStore,
  VALOR_ROTA_LABEL,
} from "../../../store/diaRotaConcluidaStore";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";

type Props = NativeStackScreenProps<RootStackParamList, "RotasHistorico">;

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function RotasHistoricoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const history = useHomeRouteStore((s) => s.history);
  const hydrate = useHomeRouteStore((s) => s.hydrate);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        list: { padding: space.md },
        empty: {
          padding: space.xl,
          alignItems: "center",
        },
        emptyText: { color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          padding: space.lg,
          marginBottom: space.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cardTitle: { fontSize: typo.body, fontWeight: "700", color: colors.text },
        cardMeta: { marginTop: 4, color: colors.textSecondary, fontSize: typo.bodySmall },
        cardLink: { marginTop: space.sm, color: colors.primary, fontWeight: "700" },
      }),
    [colors]
  );

  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate])
  );

  const openResumo = useCallback(async (item: CompletedRouteSummary) => {
    const resumo = await getRotaResumo(item.rotaId);
    useDiaRotaConcluidaStore.getState().open({
      variant: "route",
      paradas: resumo.paradas,
      pedidos: resumo.pedidos,
      entregues: resumo.entregues,
      ausentes: resumo.ausentes,
      pendentes: resumo.pendentes,
      valorRota: String(resumo.valor_total ?? "0"),
      valorLabel: VALOR_ROTA_LABEL,
    });
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Histórico de rotas"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhuma rota concluída registrada neste dispositivo.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.rotaId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => void openResumo(item)} activeOpacity={0.9}>
              <Text style={styles.cardTitle}>
                {item.paradas} paradas · {item.pedidos} pedidos
              </Text>
              <Text style={styles.cardMeta}>{formatDate(item.completedAt)}</Text>
              <Text style={styles.cardLink}>Ver resumo</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
