import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { motoboySelectSubBase } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { offerBiometricAfterLogin } from "../utils/biometricOffer";

type Props = {
  identifier: string;
  password: string;
  subBases: string[];
  onSuccess: () => void;
  onMustChangePassword?: (currentPassword: string) => void;
  onBack?: () => void;
};

export default function SelectSubBaseScreen({
  identifier,
  password,
  subBases,
  onSuccess,
  onMustChangePassword,
  onBack,
}: Props) {
  const setToken = useAuthStore((s) => s.setToken);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, padding: 24, backgroundColor: colors.background },
        title: { fontSize: 22, fontWeight: "700", marginBottom: 8, color: colors.text },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
        backBtn: { marginBottom: 16 },
        backBtnText: { fontSize: 16, color: colors.primary },
        loader: { marginTop: 48 },
        item: {
          backgroundColor: colors.backgroundCard,
          padding: 16,
          borderRadius: 8,
          marginBottom: 12,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        itemText: { fontSize: 16, color: colors.text },
      }),
    [colors]
  );
  const [loading, setLoading] = useState(false);

  const handleSelect = async (subBase: string) => {
    setLoading(true);
    try {
      const res = await motoboySelectSubBase(identifier, password, subBase);
      if (res.access_token) {
        await setToken(res.access_token);
        if (res.must_change_password && onMustChangePassword) {
          onMustChangePassword(password);
          return;
        }
        await offerBiometricAfterLogin(setBiometricEnabled, onSuccess);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Erro ao selecionar sub_base.";
      Alert.alert("Erro", String(msg || "Falha."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>Selecione a base</Text>
      <Text style={styles.subtitle}>
        Você possui acesso a mais de uma base. Escolha uma para continuar.
      </Text>
      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={subBases}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => handleSelect(item)}
              disabled={loading}
            >
              <Text style={styles.itemText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
