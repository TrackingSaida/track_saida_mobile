import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import type { MaisStackParamList } from "../../../screens/MaisScreen";
import { getAviso, marcarAvisoLido, type AvisoItem } from "../api";

type Props = NativeStackScreenProps<MaisStackParamList, "AvisoDetail">;

export default function AvisoDetailScreen({ navigation, route }: Props) {
  const { avisoId } = route.params;
  const colors = useThemeColors();
  const [item, setItem] = useState<AvisoItem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const aviso = await getAviso(avisoId);
      setItem(aviso);
      if (!aviso.lido) {
        await marcarAvisoLido(avisoId);
      }
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [avisoId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: { padding: space.lg },
        title: { fontSize: 22, fontWeight: "800", color: colors.text },
        badge: {
          alignSelf: "flex-start",
          marginTop: 10,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: "#FEE2E2",
        },
        badgeText: { fontSize: 12, fontWeight: "800", color: "#B91C1C" },
        msg: { marginTop: 18, fontSize: 16, lineHeight: 24, color: colors.text },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Aviso" onBack={() => navigation.goBack()} />
      {loading || !item ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>{item.titulo}</Text>
          {item.prioridade === "urgente" ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>URGENTE</Text>
            </View>
          ) : null}
          <Text style={styles.msg}>{item.mensagem}</Text>
        </ScrollView>
      )}
    </View>
  );
}
