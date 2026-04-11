import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import {
  ExpoSpeechRecognitionModule as SR,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import type { ExpoSpeechRecognitionErrorEvent } from "expo-speech-recognition";

export type VoiceConsultaModalProps = {
  visible: boolean;
  onDone: (text: string) => void;
  onCancel: () => void;
  /** Aviso curto na tela principal (não bloqueante); microfone/erros de reconhecimento. */
  onVoiceNotice?: (message: string) => void;
  overlayBg: string;
  cardBg: string;
  textColor: string;
  secondaryColor: string;
};

function mensagemErroReconhecimento(ev: ExpoSpeechRecognitionErrorEvent): string {
  switch (ev.error) {
    case "not-allowed":
      return "Microfone ou reconhecimento de voz não autorizado. Ative nas definições do aparelho e tente de novo.";
    case "service-not-allowed":
      return "Reconhecimento de voz indisponível neste momento no dispositivo.";
    case "network":
      return "Falha de rede no reconhecimento de voz. Verifique a ligação e tente de novo.";
    case "language-not-supported":
      return "Idioma de voz não suportado. Contacte o suporte.";
    case "no-speech":
    case "speech-timeout":
      return "Não foi detetada fala. Aproxime-se do microfone e tente de novo.";
    case "audio-capture":
      return "Não foi possível usar o microfone. Verifique permissões e se outra app não está a usar o microfone.";
    case "busy":
      return "Reconhecimento ocupado. Aguarde um momento e tente de novo.";
    case "interrupted":
      return "Reconhecimento interrompido. Feche outras apps que usem áudio e tente de novo.";
    default:
      return "Não foi possível reconhecer a voz. Pode digitar o código ou usar a câmera.";
  }
}

/**
 * Reconhecimento de voz para o campo de código.
 * Requer build nativo com expo-speech-recognition (não funciona no Expo Go sem dev client).
 */
export default function VoiceConsultaModal({
  visible,
  onDone,
  onCancel,
  onVoiceNotice,
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
  useSpeechRecognitionEvent("error", (event) => {
    if (event?.error === "aborted") {
      onCancel();
      return;
    }
    console.error("[VoiceConsultaModal] recognition error event", event);
    onVoiceNotice?.(mensagemErroReconhecimento(event));
    onCancel();
  });

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await SR.requestPermissionsAsync();
        if (cancelled) return;
        if (!result.granted) {
          console.warn("[VoiceConsultaModal] speech permission not granted", result);
          onVoiceNotice?.(
            "É necessário permitir o microfone e o reconhecimento de voz para ditar o código. Ative nas definições do aparelho ou da app."
          );
          onCancel();
          return;
        }
        if (!SR.isRecognitionAvailable()) {
          console.warn("[VoiceConsultaModal] recognition not available on device");
          onVoiceNotice?.("Reconhecimento de voz não está disponível neste dispositivo. Use digitação ou câmera.");
          onCancel();
          return;
        }
        await SR.start({ lang: "pt-BR", continuous: false, interimResults: false });
      } catch (err) {
        console.error("[VoiceConsultaModal] failed to start recognition", err);
        onVoiceNotice?.(
          "Não foi possível iniciar a voz. Pode continuar a consultar por texto ou câmera."
        );
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
  }, [visible, onCancel, onVoiceNotice]);

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
