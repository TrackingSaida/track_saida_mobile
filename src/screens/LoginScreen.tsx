import React, { useMemo, useState } from "react";
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
} from "react-native";
import { motoboyLogin } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { offerBiometricAfterLogin } from "../utils/biometricOffer";

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
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: colors.background,
        },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 24,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        },
        title: {
          fontSize: 22,
          fontWeight: "700",
          marginBottom: 24,
          textAlign: "center",
          color: colors.text,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
          fontSize: 16,
          color: colors.text,
        },
        button: {
          backgroundColor: colors.primary,
          borderRadius: 8,
          padding: 14,
          alignItems: "center",
          marginTop: 8,
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
          borderRadius: 8,
          padding: 14,
          alignItems: "center",
          marginTop: 12,
        },
        buttonBiometricText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
      }),
    [colors]
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Login Motoboy</Text>
        <TextInput
          style={styles.input}
          placeholder="E-mail, usuário ou contato"
          placeholderTextColor={colors.placeholder}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor={colors.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
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
      </View>
    </KeyboardAvoidingView>
  );
}
