import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { decodeJwtPayload } from "../utils/jwt";
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
        backBtn: { marginBottom: 16 },
        backText: { fontSize: 16, color: colors.primary },
        title: { fontSize: 22, fontWeight: "700", marginBottom: 16, color: colors.text },
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(24, insets.top) }]}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Meus dados</Text>
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
  );
}
