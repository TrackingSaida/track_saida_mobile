import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { changePassword } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { formatApiError } from "../utils/formatApiError";

const MIN_PASSWORD_LENGTH = 8;

type Props = {
  onDone: () => void;
};

export default function ChangePasswordRequiredScreen({ onDone }: Props) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const colors = useThemeColors();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visibleNew, setVisibleNew] = useState(false);
  const [visibleConfirm, setVisibleConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const newP = newPassword.trim();
    const conf = confirmPassword.trim();
    if (newP.length < MIN_PASSWORD_LENGTH) {
      Alert.alert("Atenção", `A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (newP !== conf) {
      Alert.alert("Atenção", "Nova senha e confirmação não coincidem.");
      return;
    }
    if (!token) {
      Alert.alert("Erro", "Sessão inválida. Faça login novamente.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(token, newP);
      await logout();
      onDone();
    } catch (err: unknown) {
      Alert.alert("Erro", formatApiError(err, "Não foi possível alterar a senha. Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { flex: 1 },
        scrollContent: {
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
          minHeight: "100%",
        },
        title: {
          fontSize: 22,
          fontWeight: "700",
          marginBottom: 8,
          textAlign: "center",
          color: colors.text,
        },
        subtitle: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: 24,
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
        button: {
          backgroundColor: colors.primary,
          borderRadius: 10,
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
      }),
    [colors]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Trocar senha</Text>
        <Text style={styles.subtitle}>
          Sua conta exige definir uma nova senha antes de continuar.
        </Text>
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.placeholder} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nova senha (mín. 8 caracteres)"
            placeholderTextColor={colors.placeholder}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!visibleNew}
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={() => setVisibleNew((v) => !v)}
            style={styles.passwordToggle}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={visibleNew ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={colors.placeholder}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.placeholder} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirmar nova senha"
            placeholderTextColor={colors.placeholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!visibleConfirm}
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={() => setVisibleConfirm((v) => !v)}
            style={styles.passwordToggle}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={visibleConfirm ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={colors.placeholder}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryContrast} size="small" />
          ) : (
            <Text style={styles.buttonText}>Salvar e entrar com nova senha</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
