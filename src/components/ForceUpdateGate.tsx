import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { getColors } from "../theme/colors";
import {
  fetchAppVersionPolicy,
  installedAppVersion,
  openPlayStore,
  shouldEnforceAppUpdate,
} from "../services/appUpdate/fetchAppVersionPolicy";
import { isUpdateRequired, type AppVersionPolicy } from "../services/appUpdate/versionPolicy";

/**
 * Bloqueia o app quando a versão instalada está abaixo do piso publicado no backend.
 * Sem rede, o uso continua. A última política recebida segue valendo.
 */
export default function ForceUpdateGate() {
  const role = useAuthStore((s) => s.currentUser?.role);
  const theme = useThemeStore((s) => s.theme);
  const colors = getColors(theme);
  const [policy, setPolicy] = useState<AppVersionPolicy | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);

  const refresh = useCallback(async () => {
    if (!shouldEnforceAppUpdate()) return;
    const next = await fetchAppVersionPolicy();
    if (next) setPolicy(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const installed = installedAppVersion();
  const blocked = policy != null && isUpdateRequired(installed, policy, role);

  useEffect(() => {
    if (!blocked) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [blocked]);

  const onUpdate = async () => {
    setOpening(true);
    setOpenError(false);
    try {
      await openPlayStore(policy?.storeUrl);
    } catch {
      setOpenError(true);
    } finally {
      setOpening(false);
    }
  };

  return (
    <Modal visible={blocked} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <SafeAreaView
        style={[styles.screen, { backgroundColor: colors.loginGradientStart }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Atualização necessária</Text>
          <Text style={styles.body}>
            {policy?.message ||
              "Há uma nova versão do ROTEVO. Atualize para continuar usando o aplicativo."}
          </Text>
          {installed ? <Text style={styles.version}>Versão instalada: {installed}</Text> : null}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => void onUpdate()}
            disabled={opening}
            accessibilityRole="button"
          >
            {opening ? (
              <ActivityIndicator color={colors.primaryContrast} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryContrast }]}>Atualizar agora</Text>
            )}
          </TouchableOpacity>
          {openError ? (
            <Text style={styles.error}>Não foi possível abrir a loja. Tente de novo.</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
  },
  body: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 12,
  },
  version: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginBottom: 28,
  },
  button: {
    borderRadius: 10,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonText: { fontSize: 17, fontWeight: "700" },
  error: {
    color: "#ffd0d0",
    fontSize: 14,
    marginTop: 14,
  },
});
