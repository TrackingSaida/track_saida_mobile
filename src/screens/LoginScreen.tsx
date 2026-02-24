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
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { motoboyLogin } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { offerBiometricAfterLogin } from "../utils/biometricOffer";

const SAVED_IDENTIFIER_KEY = "saved_login_identifier";
const SAVED_PASSWORD_KEY = "saved_login_password";
const REMEMBER_CREDENTIALS_KEY = "remember_credentials";

type Props = {
  onLoginSuccess: () => void;
  onSelectSubBase: (identifier: string, password: string, subBases: string[]) => void;
};

export default function LoginScreen({ onLoginSuccess, onSelectSubBase }: Props) {
  const setToken = useAuthStore((s) => s.setToken);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const requiresBiometricUnlock = useAuthStore((s) => s.requiresBiometricUnlock);
  const unlockWithBiometric = useAuthStore((s) => s.unlockWithBiometric);
  const colors = useThemeColors();
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
        const shouldRemember = (await SecureStore.getItemAsync(REMEMBER_CREDENTIALS_KEY)) === "true";
        if (!shouldRemember) {
          if (!cancelled) setRestored(true);
          return;
        }
        const savedId = await SecureStore.getItemAsync(SAVED_IDENTIFIER_KEY);
        const savedPwd = await SecureStore.getItemAsync(SAVED_PASSWORD_KEY);
        if (!cancelled && savedId != null) {
          setIdentifier(savedId);
          setPassword(savedPwd ?? "");
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

  const saveOrClearCredentials = async (id: string, pwd: string, remember: boolean) => {
    try {
      if (remember) {
        await SecureStore.setItemAsync(REMEMBER_CREDENTIALS_KEY, "true");
        await SecureStore.setItemAsync(SAVED_IDENTIFIER_KEY, id);
        await SecureStore.setItemAsync(SAVED_PASSWORD_KEY, pwd);
      } else {
        await SecureStore.deleteItemAsync(REMEMBER_CREDENTIALS_KEY);
        await SecureStore.deleteItemAsync(SAVED_IDENTIFIER_KEY);
        await SecureStore.deleteItemAsync(SAVED_PASSWORD_KEY);
      }
    } catch {
      // ignore
    }
  };

  const handleLogin = async () => {
    const id = identifier.trim();
    const pwd = password.trim();
    if (!id || !pwd) {
      Alert.alert("Erro", "Preencha usuário e senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await motoboyLogin(id, pwd);
      if (res.multiple_sub_base && res.sub_bases && res.sub_bases.length > 1) {
        onSelectSubBase(id, pwd, res.sub_bases);
      } else if (res.access_token) {
        await saveOrClearCredentials(id, pwd, rememberMe);
        await setToken(res.access_token);
        await offerBiometricAfterLogin(setBiometricEnabled, onLoginSuccess);
      } else {
        Alert.alert("Erro", "Resposta inesperada do servidor.");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Login ou senha incorretos.";
      Alert.alert("Erro", String(msg || "Falha no login."));
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setBiometricLoading(true);
    try {
      const success = await unlockWithBiometric();
      if (!success) {
        Alert.alert("Biometria", "Biometria negada ou cancelada. Tente novamente ou entre com usuário e senha.");
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
          width: 180,
          height: 180,
        },
        title: {
          fontSize: 22,
          fontWeight: "700",
          marginBottom: 24,
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
          alignItems: "center",
        },
        buttonDisabled: { opacity: 0.7 },
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
              />
            </View>
            <Text style={styles.title}>Tracking Saidas</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={22} color={colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="E-mail, usuário ou contato"
                placeholderTextColor={colors.placeholder}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible((v) => !v)}
                style={styles.passwordToggle}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
              <Text style={styles.rememberLabel}>Lembrar</Text>
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryContrast} size="small" />
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
                  <Text style={styles.buttonBiometricText}>Entrar com biometria</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
