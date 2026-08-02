import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
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
import { isMotoboyRole, isStaffOperacaoRole } from "../utils/role";
import type { MaisStackParamList } from "./MaisScreen";
import {
  clearSearchCityCaches,
  resolveCityFromGps,
  resolveSearchCityDefaults,
} from "../features/entregas/utils/resolveSearchCityDefaults";
import { getNotifPrefs, patchNotifPrefs, type NotifPrefs } from "../services/push/pushApi";

type Props = NativeStackScreenProps<MaisStackParamList, "Configuracoes">;

const APP_VERSION =
  Constants.expoConfig?.version ??
  (typeof Constants.nativeAppVersion === "string" ? Constants.nativeAppVersion : null) ??
  "1.4.0";

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
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const setCidadePadrao = useMotoboyPrefsStore((s) => s.setCidadePadrao);
  const colors = useThemeColors();
  const showOperacao = isMotoboyRole(role);
  const showStaffNotif = isStaffOperacaoRole(role);
  const [biometricEnabled, setBiometricEnabledLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs | null>(null);
  const [cidadeDraft, setCidadeDraft] = useState(cidadePadrao);
  const [estadoDraft, setEstadoDraft] = useState(estadoPadrao || "SP");
  const [gpsCityLabel, setGpsCityLabel] = useState<string>("Detectando…");

  useEffect(() => {
    getBiometricEnabled().then((enabled) => setBiometricEnabledLocal(enabled));
  }, []);

  useEffect(() => {
    void getNotifPrefs()
      .then(setNotifPrefs)
      .catch(() => setNotifPrefs(null));
  }, []);

  useEffect(() => {
    setCidadeDraft(cidadePadrao);
    setEstadoDraft(estadoPadrao || "SP");
  }, [cidadePadrao, estadoPadrao]);

  useEffect(() => {
    if (!showOperacao) return;
    let cancelled = false;
    void (async () => {
      clearSearchCityCaches();
      const gps = await resolveCityFromGps({ forceRefresh: true });
      const resolved = await resolveSearchCityDefaults({
        cidadePadrao: cidadePadrao || undefined,
        estadoPadrao: estadoPadrao || undefined,
        forceRefresh: true,
      });
      if (cancelled) return;
      if (gps?.cidade) {
        setGpsCityLabel(`${gps.cidade}${gps.estado ? `/${gps.estado}` : ""}`);
      } else {
        setGpsCityLabel("Não foi possível detectar (ative a localização)");
      }
      if (!cidadePadrao && resolved.source === "gps" && resolved.cidade) {
        // só atualiza o rótulo; não grava preferência automática
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showOperacao, cidadePadrao, estadoPadrao]);

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
        cityHelp: {
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 18,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
        },
        cityGps: {
          fontSize: 13,
          color: colors.text,
          fontWeight: "600",
          paddingHorizontal: 16,
          paddingBottom: 10,
        },
        cityInputRow: {
          paddingHorizontal: 16,
          paddingBottom: 10,
          gap: 8,
        },
        cityInput: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: colors.text,
        },
        cityActions: {
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 16,
          paddingBottom: 14,
        },
        cityBtn: {
          flex: 1,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: "center",
          backgroundColor: colors.primary,
        },
        cityBtnSecondary: {
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        cityBtnText: { fontSize: 14, fontWeight: "700", color: colors.primaryContrast },
        cityBtnTextSecondary: { fontSize: 14, fontWeight: "700", color: colors.text },
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

  const handleSaveCidadeForcada = async () => {
    const cidade = cidadeDraft.trim();
    const estado = (estadoDraft.trim() || "SP").toUpperCase().slice(0, 2);
    if (!cidade) {
      Alert.alert("Cidade", "Informe a cidade ou use a localização automática.");
      return;
    }
    await runWithSave(async () => {
      await setCidadePadrao(cidade, estado);
      clearSearchCityCaches();
    });
    Alert.alert("Salvo", "A busca de endereço vai priorizar esta cidade.");
  };

  const handleUsarLocalizacao = async () => {
    await runWithSave(async () => {
      await setCidadePadrao("", estadoPadrao || "SP");
      clearSearchCityCaches();
      const gps = await resolveCityFromGps({ forceRefresh: true });
      if (gps?.cidade) {
        setGpsCityLabel(`${gps.cidade}${gps.estado ? `/${gps.estado}` : ""}`);
        setCidadeDraft("");
      } else {
        Alert.alert(
          "Localização",
          "Não foi possível detectar a cidade. Verifique a permissão de localização do aparelho."
        );
      }
    });
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

        {notifPrefs && showStaffNotif ? (
          <SettingsSection title="Notificações">
            <SettingsToggleRow
              label="Reconferência de saídas"
              description="Avisar quando um motoboy precisar de reconferência."
              value={notifPrefs.reconferir_saida}
              onValueChange={(value) =>
                void runWithSave(async () => {
                  setNotifPrefs(await patchNotifPrefs({ reconferir_saida: value }));
                })
              }
              disabled={saving}
              isLast
            />
          </SettingsSection>
        ) : null}

        {showOperacao ? (
          <>
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

            <SettingsSection title="Cidade da busca">
              <Text style={styles.cityHelp}>
                Por padrão o app usa a cidade da sua localização atual. Só force uma cidade se
                trabalhar sempre na mesma região sem GPS confiável.
              </Text>
              <Text style={styles.cityGps}>Localização atual: {gpsCityLabel}</Text>
              <View style={styles.cityInputRow}>
                <TextInput
                  style={styles.cityInput}
                  placeholder="Forçar cidade (opcional)"
                  placeholderTextColor={colors.placeholder}
                  value={cidadeDraft}
                  onChangeText={setCidadeDraft}
                  editable={!saving}
                />
                <TextInput
                  style={styles.cityInput}
                  placeholder="UF"
                  placeholderTextColor={colors.placeholder}
                  value={estadoDraft}
                  onChangeText={setEstadoDraft}
                  maxLength={2}
                  autoCapitalize="characters"
                  editable={!saving}
                />
              </View>
              <View style={styles.cityActions}>
                <TouchableOpacity
                  style={[styles.cityBtn, styles.cityBtnSecondary]}
                  onPress={() => void handleUsarLocalizacao()}
                  disabled={saving}
                >
                  <Text style={styles.cityBtnTextSecondary}>Usar localização</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cityBtn}
                  onPress={() => void handleSaveCidadeForcada()}
                  disabled={saving}
                >
                  <Text style={styles.cityBtnText}>Forçar cidade</Text>
                </TouchableOpacity>
              </View>
            </SettingsSection>
          </>
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
