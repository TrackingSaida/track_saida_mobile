import React, { useEffect, useState, useCallback } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useThemeColors } from "../theme/colors";
import {
  registerBackgroundLocationDisclosureHandler,
  type BackgroundLocationDisclosureDecision,
} from "../services/location/backgroundLocationDisclosure";

const TITLE = "Localização durante a rota";

const BODY =
  "O ROTEVO coleta dados de localização para permitir o acompanhamento da rota ativa do entregador, inclusive em segundo plano, quando o app está fechado ou não está em uso.\n\n" +
  "A localização é utilizada para registrar o trajeto e acompanhar a execução das entregas durante uma rota ativa.\n\n" +
  "Esses dados não são utilizados para publicidade.";

/**
 * Declaração em destaque (Play Store) antes de qualquer prompt de localização
 * no fluxo de BACKGROUND_LOCATION. Montar uma vez na árvore autenticada.
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
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={[styles.title, { color: colors.text }]}>{TITLE}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{BODY}</Text>
          </ScrollView>
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
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 12,
    padding: 20,
    maxHeight: "85%",
  },
  scrollContent: {
    flexGrow: 0,
    paddingBottom: 4,
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
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
