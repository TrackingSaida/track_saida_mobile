import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { getColors } from "../theme/colors";

type Props = {
  onRelogin: () => void;
};

export function SessionExpiredModal({ onRelogin }: Props) {
  const visible = useAuthStore((s) => s.sessionExpiredVisible);
  const dismiss = useAuthStore((s) => s.dismissSessionExpired);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const colors = getColors(theme);
  const [loading, setLoading] = React.useState(false);

  const handleRelogin = async () => {
    setLoading(true);
    try {
      await logout({ revokeRemote: false });
      dismiss();
      onRelogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.title, { color: colors.text }]}>Sessão expirada</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Sua sessão expirou. Entre novamente para continuar. Sua rota no servidor foi preservada.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleRelogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryContrast} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryContrast }]}>Entrar novamente</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 12,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
