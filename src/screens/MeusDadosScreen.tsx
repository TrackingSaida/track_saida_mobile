import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { decodeJwtPayload } from "../utils/jwt";
import ScreenHeaderBar from "../components/ScreenHeaderBar";
import type { MaisStackParamList } from "./MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "MeusDados">;

export default function MeusDadosScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 48 },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 16,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        row: { paddingVertical: 12 },
        label: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
        value: { fontSize: 16, color: colors.text },
        separator: { height: 1, backgroundColor: colors.separator },
      }),
    [colors]
  );
  const token = useAuthStore((s) => s.token);
  const claims = token ? decodeJwtPayload(token) : {};
  const username = claims.username ?? "—";
  const subBase = claims.sub_base ?? "—";

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Meu perfil"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Usuário</Text>
            <Text style={styles.value}>{username}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.label}>Base</Text>
            <Text style={styles.value}>{subBase}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
