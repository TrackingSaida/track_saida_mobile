import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { decodeJwtPayload } from "../utils/jwt";
import { isMotoboyRole } from "../utils/role";

export type MaisStackParamList = {
  MaisInicio: undefined;
  MeusDados: undefined;
  Preferencia: undefined;
  MinhasEntregas: undefined;
  MinhasEntregasDia: { data: string };
  EntregaDetail: { idSaida: number };
};

type Props = NativeStackScreenProps<MaisStackParamList, "MaisInicio"> & {
  onLogout: () => Promise<void>;
};

export default function MaisScreen({ navigation, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: 48 },
        header: {
          backgroundColor: colors.backgroundCard,
          padding: 24,
          marginBottom: 12,
          alignItems: "center",
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        avatar: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.inputBackground,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 12,
        },
        avatarText: { fontSize: 24, fontWeight: "600", color: colors.textSecondary },
        greeting: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
        nome: { fontSize: 18, fontWeight: "600", color: colors.text },
        menu: {
          backgroundColor: colors.backgroundCard,
          paddingHorizontal: 16,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 8 },
        menuIcon: { fontSize: 20, marginRight: 16 },
        menuText: { fontSize: 16, color: colors.text, flex: 1 },
        separator: { height: 1, backgroundColor: colors.separator, marginLeft: 44 },
      }),
    [colors]
  );
  const token = useAuthStore((s) => s.token);
  const claims = token ? decodeJwtPayload(token) : {};
  const nome = claims.username || "Usuário";
  const role = claims.role as number | undefined;
  const showMotoboyMenu = isMotoboyRole(role);

  const handleSair = async () => {
    await onLogout();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(24, insets.top) }]}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{nome.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.greeting}>Olá!</Text>
        <Text style={styles.nome}>{nome}</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("MeusDados")} activeOpacity={0.7}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuText}>Meus dados</Text>
        </TouchableOpacity>
        <View style={styles.separator} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Preferencia")} activeOpacity={0.7}>
          <Text style={styles.menuIcon}>⚙</Text>
          <Text style={styles.menuText}>Preferência (Modo Escuro ou Claro)</Text>
        </TouchableOpacity>
        {showMotoboyMenu ? (
          <>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("MinhasEntregas")} activeOpacity={0.7}>
              <Text style={styles.menuIcon}>📋</Text>
              <Text style={styles.menuText}>Minhas Entregas</Text>
            </TouchableOpacity>
          </>
        ) : null}
        <View style={styles.separator} />
        <TouchableOpacity style={styles.menuItem} onPress={handleSair} activeOpacity={0.7}>
          <Text style={styles.menuIcon}>↪</Text>
          <Text style={styles.menuText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
