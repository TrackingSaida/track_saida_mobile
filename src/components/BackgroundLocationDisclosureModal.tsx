import React, { useEffect, useState, useCallback } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeColors } from "../theme/colors";
import {
  registerBackgroundLocationDisclosureHandler,
  type BackgroundLocationDisclosureDecision,
} from "../services/location/backgroundLocationDisclosure";

const TITLE = "Localização durante a rota";
const BODY =
  "Durante uma rota ativa, o ROTEVO utiliza sua localização mesmo quando o aplicativo estiver em segundo plano ou com a tela desligada. Isso permite manter a navegação e o andamento da rota. O rastreamento é encerrado ao finalizar ou cancelar a rota.";

/**
 * Modal de divulgação destacada (Play Store) antes da permissão de localização em segundo plano.
 * Montar uma vez na árvore autenticada.
 */
export default function BackgroundLocationDisclosureModal() {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);
  const [resolver, setResolver] = useState<
    ((decision: BackgroundLocationDisclosureDecision) => void) | null
  >(null);

  const resolve = useCallback(
    (decision: BackgroundLocationDisclosureDecision) => {
      setVisible(false);
      resolver?.(decision);
      setResolver(null);
    },
    [resolver]
  );

  useEffect(() => {
    registerBackgroundLocationDisclosureHandler(
      () =>
        new Promise<BackgroundLocationDisclosureDecision>((res) => {
          setResolver(() => res);
          setVisible(true);
        })
    );
    return () => {
      registerBackgroundLocationDisclosureHandler(null);
    };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => resolve("dismissed")}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.title, { color: colors.text }]}>{TITLE}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{BODY}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: colors.border }]}
              onPress={() => resolve("dismissed")}
              accessibilityRole="button"
              accessibilityLabel="Agora não"
            >
              <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Agora não</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
              onPress={() => resolve("continue")}
              accessibilityRole="button"
              accessibilityLabel="Continuar"
            >
              <Text style={[styles.btnPrimaryText, { color: colors.primaryContrast }]}>
                Continuar
              </Text>
            </TouchableOpacity>
          </View>
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
  body: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  actions: { flexDirection: "row", gap: 10 },
  btnSecondary: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnSecondaryText: { fontSize: 15, fontWeight: "600" },
  btnPrimary: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPrimaryText: { fontSize: 15, fontWeight: "600" },
});
