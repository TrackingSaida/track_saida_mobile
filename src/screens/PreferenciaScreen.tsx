import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore, type ThemeMode } from "../store/themeStore";
import { useAuthStore } from "../store/authStore";
import { useMotoboyPrefsStore } from "../store/motoboyPrefsStore";
import { useThemeColors } from "../theme/colors";
import type { MaisStackParamList } from "./MaisScreen";

const BIOMETRIC_ENABLED_KEY = "biometric_enabled";

type Props = NativeStackScreenProps<MaisStackParamList, "Preferencia">;

export default function PreferenciaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const setSomenteHojePendentes = useMotoboyPrefsStore((s) => s.setSomenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const setRoteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.setRoteirizacaoHabilitada);
  const colors = useThemeColors();
  const [biometricEnabled, setBiometricEnabledLocal] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY).then((v) => setBiometricEnabledLocal(v === "true"));
  }, []);

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
          padding: 8,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        option: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, marginBottom: 4 },
        optionActive: { backgroundColor: colors.primary },
        optionText: { fontSize: 16, color: colors.text },
        optionTextActive: { color: colors.primaryContrast, fontWeight: "600" },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 8,
          marginBottom: 4,
        },
        rowLabel: { fontSize: 16, color: colors.text },
      }),
    [colors]
  );

  const handleSelect = async (mode: ThemeMode) => {
    await setTheme(mode);
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const [compatible, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!compatible || !enrolled) {
        Alert.alert(
          "Biometria indisponível",
          "Configure impressão digital ou Face ID no dispositivo para usar login por biometria."
        );
        return;
      }
    }
    await setBiometricEnabled(value);
    setBiometricEnabledLocal(value);
    if (!value) {
      Alert.alert(
        "Login por biometria desativado",
        "Na próxima abertura você poderá entrar com senha. Para ativar de novo, faça login e ative nas preferências."
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(24, insets.top) }]}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Preferência</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.option, theme === "light" && styles.optionActive]}
          onPress={() => handleSelect("light")}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, theme === "light" && styles.optionTextActive]}>Modo Claro</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, theme === "dark" && styles.optionActive]}
          onPress={() => handleSelect("dark")}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, theme === "dark" && styles.optionTextActive]}>Modo Escuro</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Login por biometria</Text>
          <Switch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            trackColor={{ false: colors.separator, true: colors.primary }}
            thumbColor={colors.backgroundCard}
          />
        </View>
      </View>
      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Pendentes: somente pedidos de hoje</Text>
          <Switch
            value={somenteHojePendentes}
            onValueChange={(value) => void setSomenteHojePendentes(value)}
            trackColor={{ false: colors.separator, true: colors.primary }}
            thumbColor={colors.backgroundCard}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Criar roteirização</Text>
          <Switch
            value={roteirizacaoHabilitada}
            onValueChange={(value) => void setRoteirizacaoHabilitada(value)}
            trackColor={{ false: colors.separator, true: colors.primary }}
            thumbColor={colors.backgroundCard}
          />
        </View>
      </View>
    </ScrollView>
  );
}
