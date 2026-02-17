import React, { useState } from "react";
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

type Props = {
  onLoginSuccess: () => void;
  onSelectSubBase: (identifier: string, password: string, subBases: string[]) => void;
};

export default function LoginScreen({ onLoginSuccess, onSelectSubBase }: Props) {
  const setToken = useAuthStore((s) => s.setToken);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
        onLoginSuccess();
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
          placeholderTextColor="#999"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
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
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#0d6efd",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
