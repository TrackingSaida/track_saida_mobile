import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Modal, Alert, StyleSheet } from "react-native";
import {
  ExpoSpeechRecognitionModule as SR,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export type VoiceConsultaModalProps = {
  visible: boolean;
  onDone: (text: string) => void;
  onCancel: () => void;
  overlayBg: string;
  cardBg: string;
  textColor: string;
  secondaryColor: string;
};

/**
 * Reconhecimento de voz para o campo de código.
 * Requer build nativo com expo-speech-recognition (não funciona no Expo Go sem dev client).
 */
export default function VoiceConsultaModal({
  visible,
  onDone,
  onCancel,
  overlayBg,
  cardBg,
  textColor,
  secondaryColor,
}: VoiceConsultaModalProps) {
  const transcriptRef = useRef("");

  useSpeechRecognitionEvent("result", (event) => {
    const t = event.results?.[0]?.transcript;
    if (typeof t === "string") transcriptRef.current = t;
  });
  useSpeechRecognitionEvent("end", () => {
    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    if (text) onDone(text);
    else onCancel();
  });
  useSpeechRecognitionEvent("error", () => {
    Alert.alert("Erro", "Não foi possível reconhecer a fala.");
    onCancel();
  });

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await SR.requestPermissionsAsync();
        if (!result.granted || cancelled) {
          onCancel();
          return;
        }
        if (!SR.isRecognitionAvailable()) {
          Alert.alert("Indisponível", "Reconhecimento de voz não é suportado neste dispositivo.");
          onCancel();
          return;
        }
        await SR.start({ lang: "pt-BR", continuous: false, interimResults: false });
      } catch {
        Alert.alert("Erro", "Não foi possível iniciar o reconhecimento de voz.");
        onCancel();
      }
    })();
    return () => {
      cancelled = true;
      try {
        SR.abort();
      } catch {
        /* noop */
      }
    };
  }, [visible, onCancel]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
        <View style={[styles.box, { backgroundColor: cardBg }]}>
          <Text style={[styles.title, { color: textColor }]}>Voz</Text>
          <Text style={[styles.msg, { color: secondaryColor }]}>Fale o código…</Text>
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: secondaryColor }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  box: {
    borderRadius: 14,
    padding: 22,
    width: "100%",
    maxWidth: 340,
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  msg: { fontSize: 15, marginBottom: 16 },
  cancelBtn: { alignSelf: "flex-start" },
  cancelText: { fontSize: 16, fontWeight: "600" },
});
