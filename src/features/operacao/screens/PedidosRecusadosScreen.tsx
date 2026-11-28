import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import CodigoServicoRow from "../../entregas/components/CodigoServicoRow";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import { formatApiError } from "../../../utils/formatApiError";
import type { InicioStackParamList } from "../../../navigation/staffStackTypes";
import { listPedidosRecusados, type PedidoRecusadoItem } from "../pedidosRecusadosApi";
import { usePedidosRecusadosStore } from "../../../store/pedidosRecusadosStore";

type Props = NativeStackScreenProps<InicioStackParamList, "PedidosRecusados">;

export default function PedidosRecusadosScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const refreshCount = usePedidosRecusadosStore((s) => s.refresh);
  const [items, setItems] = useState<PedidoRecusadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setErro(null);
      try {
        const res = await listPedidosRecusados();
        setItems(res.items);
        void refreshCount();
      } catch (err) {
        setErro(formatApiError(err, "Não foi possível carregar os pedidos recusados."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshCount]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: { flex: 1, paddingHorizontal: space.md, paddingTop: space.sm },
        hint: { color: colors.textSecondary, fontSize: 14, marginBottom: space.md, lineHeight: 20 },
        empty: { textAlign: "center", color: colors.textSecondary, marginTop: 40 },
        erro: { color: colors.danger, textAlign: "center", marginTop: 24, paddingHorizontal: space.md },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Pedidos recusados" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.hint}>
          Destinatário recusou a entrega. Toque no código para abrir o detalhe e cancelar na consulta.
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : erro ? (
          <Text style={styles.erro}>{erro}</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id_saida)}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
            }
            ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido recusado na fila.</Text>}
            renderItem={({ item }) => (
              <CodigoServicoRow
                codigo={item.codigo}
                codigo_exibicao={item.codigo_exibicao}
                id_saida={item.id_saida}
                servico={item.servico}
                onPress={() =>
                  navigation.navigate("ConsultaCodigos", { abrirIdSaida: item.id_saida })
                }
              />
            )}
          />
        )}
      </View>
    </View>
  );
}
