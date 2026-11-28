import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import type { MaisStackParamList } from "../../../screens/MaisScreen";
import { listAvisos, type AvisoItem } from "../api";
import { useAvisosUnreadStore } from "../../../store/avisosUnreadStore";
import { useAvisosCacheStore } from "../../../store/avisosCacheStore";
import { usePedidosRecusadosStore } from "../../../store/pedidosRecusadosStore";
import { useAuthStore } from "../../../store/authStore";
import { isAdminRole } from "../../../utils/role";

type Props = NativeStackScreenProps<MaisStackParamList, "Avisos">;

export default function AvisosScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [items, setItems] = useState<AvisoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshUnread = useAvisosUnreadStore((s) => s.refresh);
  const role = useAuthStore((s) => s.currentUser?.role) as number | undefined;
  const recusadosTotal = usePedidosRecusadosStore((s) => s.total);
  const refreshRecusados = usePedidosRecusadosStore((s) => s.refresh);
  const mostrarFaixaRecusados = isAdminRole(role) && recusadosTotal > 0;

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const rows = await listAvisos();
      const cached = useAvisosCacheStore.getState().list();
      const byId = new Map<number, AvisoItem>();
      for (const row of cached) byId.set(row.id, row);
      for (const row of rows) {
        byId.set(row.id, row);
        useAvisosCacheStore.getState().upsert(row);
      }
      setItems(
        [...byId.values()].sort((a, b) => {
          const ta = a.criado_em || "";
          const tb = b.criado_em || "";
          if (ta !== tb) return tb.localeCompare(ta);
          return b.id - a.id;
        })
      );
      void refreshUnread();
    } catch {
      const cached = useAvisosCacheStore.getState().list();
      setItems(
        [...cached].sort((a, b) => {
          const ta = a.criado_em || "";
          const tb = b.criado_em || "";
          if (ta !== tb) return tb.localeCompare(ta);
          return b.id - a.id;
        })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUnread]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshRecusados();
    }, [load, refreshRecusados])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: space.md,
          marginHorizontal: space.md,
          marginBottom: space.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        unread: { borderColor: colors.primary, borderWidth: 2 },
        title: { fontSize: 16, fontWeight: "800", color: colors.text },
        badge: {
          alignSelf: "flex-start",
          marginTop: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 8,
          backgroundColor: "#FEE2E2",
        },
        badgeText: { fontSize: 11, fontWeight: "800", color: "#B91C1C" },
        preview: { marginTop: 8, color: colors.textSecondary, fontSize: 14 },
        empty: { textAlign: "center", color: colors.textSecondary, marginTop: 40 },
        faixaRecusado: {
          marginHorizontal: space.md,
          marginBottom: space.sm,
          marginTop: space.sm,
          borderRadius: 12,
          padding: space.md,
          backgroundColor: "rgba(220, 53, 69, 0.1)",
          borderWidth: 1,
          borderColor: "rgba(220, 53, 69, 0.35)",
        },
        faixaRecusadoTitle: { fontSize: 16, fontWeight: "800", color: "#B91C1C" },
        faixaRecusadoSub: { marginTop: 4, fontSize: 13, color: colors.textSecondary },
      }),
    [colors]
  );

  const goPedidosRecusados = () => {
    const tabNav = navigation.getParent()?.getParent();
    (tabNav as { navigate: (a: string, b?: object) => void } | undefined)?.navigate("Inicio", {
      screen: "PedidosRecusados",
    });
  };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Avisos" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
          ListHeaderComponent={
            mostrarFaixaRecusados ? (
              <TouchableOpacity style={styles.faixaRecusado} onPress={goPedidosRecusados}>
                <Text style={styles.faixaRecusadoTitle}>
                  {recusadosTotal === 1
                    ? "1 pedido recusado"
                    : `${recusadosTotal} pedidos recusados`}
                </Text>
                <Text style={styles.faixaRecusadoSub}>Toque para ver a lista e cancelar na consulta.</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            mostrarFaixaRecusados ? null : (
              <Text style={styles.empty}>Nenhum aviso por enquanto.</Text>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.lido && styles.unread]}
              onPress={() =>
                navigation.navigate("AvisoDetail", {
                  avisoId: item.id,
                  titulo: item.titulo,
                  mensagem: item.mensagem,
                  prioridade: item.prioridade,
                })
              }
            >
              <Text style={styles.title}>{item.titulo}</Text>
              {item.prioridade === "urgente" ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>URGENTE</Text>
                </View>
              ) : null}
              <Text style={styles.preview} numberOfLines={2}>
                {item.mensagem}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
