import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { motoboyLogin, normalizeAuthError, userLogin } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { getSavedCredentials, saveOrClearCredentials } from "../services/savedCredentials";
import { useThemeColors } from "../theme/colors";
import { offerBiometricAfterLogin } from "../utils/biometricOffer";

type Props = {
  onLoginSuccess: () => void;
  onMustChangePassword?: () => void;
  onSelectSubBase: (identifier: string, password: string, subBases: string[]) => void;
};

export default function LoginScreen({ onLoginSuccess, onMustChangePassword, onSelectSubBase }: Props) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const requiresBiometricUnlock = useAuthStore((s) => s.requiresBiometricUnlock);
  const unlockWithBiometric = useAuthStore((s) => s.unlockWithBiometric);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const appVersion =
    Constants.expoConfig?.version ??
    (typeof Constants.nativeAppVersion === "string" ? Constants.nativeAppVersion : null) ??
    "1.4.0";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await getSavedCredentials();
        if (!cancelled && saved) {
          setIdentifier(saved.identifier);
          setPassword(saved.password);
          setRememberMe(true);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setRestored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
    const id = identifier.trim();
    const pwd = password.trim();
    if (!id || !pwd) {
      Alert.alert("Erro", "Preencha usuário e senha.");
      return;
    }
    setLoading(true);
    try {
      // Primeiro tenta login como motoboy (fluxo atual do app).
      // Se não for motoboy (403/404), cai para login de usuário normal (Admin/Operador) via /auth/token.
      try {
        const res = await motoboyLogin(id, pwd);
        if (res.multiple_sub_base && res.sub_bases && res.sub_bases.length > 1) {
          onSelectSubBase(id, pwd, res.sub_bases);
        } else if (res.access_token) {
          if (res.must_change_password && onMustChangePassword) {
            await setTokens(res.access_token, res.refresh_token);
            onMustChangePassword();
            return;
          }
          await saveOrClearCredentials(id, pwd, rememberMe);
          await setTokens(res.access_token, res.refresh_token);
          await offerBiometricAfterLogin(setBiometricEnabled, onLoginSuccess);
        } else {
          Alert.alert("Erro", "Resposta inesperada do servidor.");
        }
        return;
      } catch (err: unknown) {
        const authErr = normalizeAuthError(err, "Falha no login.");
        const status = authErr.status;
        const detail = (authErr.detail || "").toLowerCase();

        // 401: credenciais inválidas – não tenta outro tipo de login.
        if (status === 401) {
          Alert.alert("Erro", authErr.message || "Login ou senha incorretos.");
          return;
        }

        // Timeout/rede: evita fallback e exibe erro técnico amigável.
        if (authErr.code === "timeout" || authErr.code === "network") {
          Alert.alert("Erro", authErr.message || "Falha de conexão. Tente novamente.");
          return;
        }

        // 404 ou 403 de perfil não motoboy: tenta login normal (Admin/Operador).
        // Para outros 403 do fluxo motoboy (ex.: sem sub-base/owner), mostra a causa real.
        const shouldTryStaffFallback =
          status === 404 || (status === 403 && detail.includes("acesso restrito a motoboys"));

        if (shouldTryStaffFallback) {
          try {
            // remember=true: access longo no backend (mobile + biometria).
            const userRes = await userLogin(id, pwd, true);
            if (userRes.access_token) {
              if (userRes.must_change_password && onMustChangePassword) {
                await setTokens(userRes.access_token, null);
                onMustChangePassword();
                return;
              }
              // Com biometria, sempre persiste credenciais para reauth silenciosa se o JWT expirar.
              const persistCreds = rememberMe;
              await saveOrClearCredentials(id, pwd, persistCreds);
              await setTokens(userRes.access_token, null);
              await offerBiometricAfterLogin(async (enabled) => {
                await setBiometricEnabled(enabled);
                if (enabled) {
                  await saveOrClearCredentials(id, pwd, true);
                }
              }, onLoginSuccess);
              return;
            }
            Alert.alert("Erro", "Resposta inesperada do servidor.");
            return;
          } catch (errUser: unknown) {
            const userAuthErr = normalizeAuthError(errUser, "Falha no login.");
            Alert.alert("Erro", userAuthErr.message || "Falha no login.");
            return;
          }
        }

        // Outros erros inesperados do endpoint de motoboy.
        Alert.alert("Erro", authErr.message || "Falha no login.");
        return;
      }
    } catch (e: unknown) {
      const authErr = normalizeAuthError(e, "Falha inesperada ao entrar. Tente novamente.");
      Alert.alert("Erro", authErr.message || "Falha inesperada ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setBiometricLoading(true);
    try {
      const success = await unlockWithBiometric();
      if (!success) {
        Alert.alert(
          "Biometria",
          "Não foi possível restaurar a sessão. Entre com usuário e senha (marque “Lembrar” para a biometria renovar automaticamente)."
        );
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        gradient: { flex: 1 },
        scroll: { flex: 1 },
        scrollContent: {
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
          minHeight: "100%",
        },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 18,
          padding: 24,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 4,
        },
        logoContainer: {
          alignItems: "center",
          marginBottom: 16,
        },
        logo: {
          width: 88,
          height: 88,
        },
        title: {
          fontSize: 26,
          fontWeight: "800",
          marginTop: 8,
          letterSpacing: 1.5,
          textAlign: "center",
          color: colors.text,
        },
        tagline: {
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          textAlign: "center",
          color: colors.textSecondary,
          marginTop: 4,
        },
        welcome: {
          fontSize: 16,
          fontWeight: "600",
          marginTop: 18,
          marginBottom: 20,
          textAlign: "center",
          color: colors.text,
        },
        inputRow: {
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 10,
          paddingHorizontal: 14,
          marginBottom: 16,
          minHeight: 48,
        },
        inputIcon: { marginRight: 12 },
        input: {
          flex: 1,
          fontSize: 16,
          color: colors.text,
          paddingVertical: 12,
          paddingRight: 8,
        },
        passwordToggle: { padding: 4 },
        rememberRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 16,
        },
        rememberLabel: {
          fontSize: 16,
          color: colors.text,
          marginLeft: 10,
        },
        button: {
          backgroundColor: colors.primary,
          borderRadius: 10,
          padding: 14,
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
        },
        buttonDisabled: { opacity: 0.7 },
        buttonLoading: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
        buttonText: {
          color: colors.primaryContrast,
          fontSize: 16,
          fontWeight: "600",
        },
        buttonBiometric: {
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 10,
          padding: 14,
          alignItems: "center",
          marginTop: 12,
        },
        buttonBiometricText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
        footer: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: 8,
        },
        footerText: {
          fontSize: 12,
          color: "rgba(255,255,255,0.72)",
        },
      }),
    [colors]
  );

  if (!restored) {
    return null;
  }

  return (
    <LinearGradient
      colors={[colors.loginGradientStart, colors.loginGradientEnd]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../../assets/logo-pin.png")}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="ROTEVO"
              />
              <Text style={styles.title}>ROTEVO</Text>
              <Text style={styles.tagline}>Gestão Inteligente de Entregas</Text>
              <Text style={styles.welcome}>Bem-vindo de volta</Text>
            </View>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={22} color={colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="E-mail, usuário ou telefone"
                placeholderTextColor={colors.placeholder}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
              />
            </View>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                autoComplete="password"
                textContentType="password"
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible((v) => !v)}
                style={styles.passwordToggle}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
              >
                <Ionicons
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={colors.placeholder}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.rememberRow}>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: colors.separator, true: colors.primary }}
                thumbColor={colors.backgroundCard}
              />
              <Text style={styles.rememberLabel}>Lembrar-me</Text>
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator color={colors.primaryContrast} size="small" />
                  <Text style={styles.buttonText}>Entrando...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>
            {requiresBiometricUnlock && (
              <TouchableOpacity
                style={[styles.buttonBiometric, biometricLoading && styles.buttonDisabled]}
                onPress={handleBiometricUnlock}
                disabled={biometricLoading}
              >
                {biometricLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.buttonBiometricText}>Desbloquear app</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} ROTEVO</Text>
          <Text style={styles.footerText}>v{appVersion}</Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
