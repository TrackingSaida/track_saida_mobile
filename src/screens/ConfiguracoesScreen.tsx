import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore, type ThemeMode } from "../store/themeStore";
import { useAuthStore } from "../store/authStore";
import { useMotoboyPrefsStore } from "../store/motoboyPrefsStore";
import { useThemeColors } from "../theme/colors";
import ScreenHeaderBar from "../components/ScreenHeaderBar";
import { getBiometricEnabled } from "../services/settingsService";
import SettingsSection from "../components/settings/SettingsSection";
import SettingsToggleRow from "../components/settings/SettingsToggleRow";
import { isMotoboyRole } from "../utils/role";
import type { MaisStackParamList } from "./MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "Configuracoes">;

const APP_VERSION =
  Constants.expoConfig?.version ??
  (typeof Constants.nativeAppVersion === "string" ? Constants.nativeAppVersion : null) ??
  "1.3.0";

export default function ConfiguracoesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const role = useAuthStore((s) => s.currentUser?.role);
  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const setSomenteHojePendentes = useMotoboyPrefsStore((s) => s.setSomenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const setRoteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.setRoteirizacaoHabilitada);
  const colors = useThemeColors();
  const showOperacao = isMotoboyRole(role);
  const [biometricEnabled, setBiometricEnabledLocal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBiometricEnabled().then((enabled) => setBiometricEnabledLocal(enabled));
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 32 },
        themeOption: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        themeOptionLast: { borderBottomWidth: 0 },
        themeRadio: {
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: colors.separator,
          marginRight: 12,
          alignItems: "center",
          justifyContent: "center",
        },
        themeRadioActive: { borderColor: colors.primary },
        themeRadioDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.primary,
        },
        themeOptionText: { fontSize: 15, color: colors.text, fontWeight: "500" },
        themeOptionTextActive: { fontWeight: "700", color: colors.text },
        aboutRow: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        aboutRowLast: { borderBottomWidth: 0 },
        aboutLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
        aboutValue: { fontSize: 15, fontWeight: "600", color: colors.text },
        savingOverlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.overlay,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 20,
        },
      }),
    [colors]
  );

  const runWithSave = useCallback(async (action: () => Promise<void>) => {
    setSaving(true);
    try {
      await action();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a configuração. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSelectTheme = async (mode: ThemeMode) => {
    if (mode === theme) return;
    await runWithSave(() => setTheme(mode));
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
    await runWithSave(async () => {
      await setBiometricEnabled(value);
      setBiometricEnabledLocal(value);
    });
  };

  const handleSomenteHojeToggle = async (value: boolean) => {
    await runWithSave(() => setSomenteHojePendentes(value));
  };

  const handleRoteirizacaoToggle = async (value: boolean) => {
    await runWithSave(() => setRoteirizacaoHabilitada(value));
  };

  const renderThemeOption = (mode: ThemeMode, label: string, isLast = false) => {
    const active = theme === mode;
    return (
      <TouchableOpacity
        key={mode}
        style={[styles.themeOption, isLast && styles.themeOptionLast]}
        onPress={() => void handleSelectTheme(mode)}
        activeOpacity={0.7}
        disabled={saving}
      >
        <View style={[styles.themeRadio, active && styles.themeRadioActive]}>
          {active ? <View style={styles.themeRadioDot} /> : null}
        </View>
        <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Configurações"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title="Aparência">
          {renderThemeOption("light", "Modo Claro")}
          {renderThemeOption("dark", "Modo Escuro", true)}
        </SettingsSection>

        <SettingsSection title="Segurança">
          <SettingsToggleRow
            label="Login por biometria"
            description="Utilizar biometria para acessar o aplicativo."
            value={biometricEnabled}
            onValueChange={(value) => void handleBiometricToggle(value)}
            disabled={saving}
            isLast
          />
        </SettingsSection>

        {showOperacao ? (
          <SettingsSection title="Operação">
            <SettingsToggleRow
              label="Mostrar apenas pedidos de hoje"
              description="Exibir apenas entregas previstas para o dia atual."
              value={somenteHojePendentes}
              onValueChange={(value) => void handleSomenteHojeToggle(value)}
              disabled={saving}
            />
            <SettingsToggleRow
              label="Habilitar preparação de rota"
              description="Exibe recursos para organizar, agrupar e otimizar entregas em rotas."
              value={roteirizacaoHabilitada}
              onValueChange={(value) => void handleRoteirizacaoToggle(value)}
              disabled={saving}
              isLast
            />
          </SettingsSection>
        ) : null}

        <SettingsSection title="Sobre">
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Versão do aplicativo</Text>
            <Text style={styles.aboutValue}>Versão {APP_VERSION}</Text>
          </View>
          <View style={[styles.aboutRow, styles.aboutRowLast]}>
            <Text style={styles.aboutLabel}>Ambiente</Text>
            <Text style={styles.aboutValue}>{__DEV__ ? "Desenvolvimento" : "Produção"}</Text>
          </View>
        </SettingsSection>
      </ScrollView>

      {saving ? (
        <View style={styles.savingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}
