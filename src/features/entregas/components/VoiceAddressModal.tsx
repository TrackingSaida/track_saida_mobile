import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Modal, Alert, ActivityIndicator } from "react-native";

export type VoiceModalPhase = "listening" | "processing" | "success";

/** Só montado após import dinâmico do módulo; evita crash no Expo Go. */
export default function VoiceAddressModal({
  speechModule,
  modalStyles,
  onDone,
  onCancel,
  onRetry,
  onFocusManual,
}: {
  speechModule: {
    ExpoSpeechRecognitionModule: typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent: typeof import("expo-speech-recognition").useSpeechRecognitionEvent;
  };
  modalStyles: {
    modalOverlay: object;
    modalBox: object;
    modalTitle: object;
    modalMessage: object;
    modalBtnCancel: object;
    modalBtnCancelText: object;
  };
  onDone: (transcript: string) => void;
  onCancel: () => void;
  onRetry?: () => void;
  onFocusManual?: () => void;
}) {
  const transcriptRef = useRef("");
  const [phase, setPhase] = useState<VoiceModalPhase>("listening");
  const startRecognitionRef = useRef<() => Promise<void>>(async () => {});
  const { ExpoSpeechRecognitionModule: SR, useSpeechRecognitionEvent } = speechModule;

  const showNoSpeechAlert = () => {
    Alert.alert(
      "Endereço por voz",
      "Não consegui entender o endereço informado.",
      [
        {
          text: "Tentar novamente",
          onPress: () => {
            if (onRetry) {
              onRetry();
            } else {
              void startRecognitionRef.current();
            }
          },
        },
        {
          text: "Digitar manualmente",
          style: "cancel",
          onPress: () => {
            onFocusManual?.();
            onCancel();
          },
        },
      ]
    );
  };

  useSpeechRecognitionEvent("result", (event) => {
    const t = event.results?.[0]?.transcript;
    if (typeof t === "string") transcriptRef.current = t;
  });

  useSpeechRecognitionEvent("end", () => {
    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    if (text) {
      setPhase("success");
      setTimeout(() => onDone(text), 400);
    } else {
      setPhase("listening");
      showNoSpeechAlert();
    }
  });

  useSpeechRecognitionEvent("error", () => {
    setPhase("listening");
    showNoSpeechAlert();
  });

  const startRecognition = async () => {
    setPhase("listening");
    try {
      const result = await SR.requestPermissionsAsync();
      if (!result.granted) {
        onCancel();
        return;
      }
      if (!SR.isRecognitionAvailable()) {
        Alert.alert("Não disponível", "Reconhecimento de voz não é suportado neste dispositivo.");
        onCancel();
        return;
      }
      await SR.start({ lang: "pt-BR", continuous: false, interimResults: false });
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar o reconhecimento de voz.");
      onCancel();
    }
  };
  startRecognitionRef.current = startRecognition;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await startRecognition();
    })();
    return () => {
      cancelled = true;
      try {
        SR.abort();
      } catch {}
    };
  }, [SR]);

  const phaseMessage =
    phase === "success"
      ? "✓ Endereço reconhecido"
      : phase === "processing"
        ? "🔄 Processando endereço…"
        : "🎤 Ouvindo endereço…\n\nDiga rua, bairro e número.\nEx.: Av. Paulista, Bela Vista, 1000";

  return (
    <Modal visible transparent animationType="fade">
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalBox}>
          <Text style={modalStyles.modalTitle}>Falar endereço</Text>
          {phase === "listening" && phaseMessage.startsWith("🎤") ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 12 }} />
          ) : null}
          <Text style={modalStyles.modalMessage}>{phaseMessage}</Text>
          <TouchableOpacity style={modalStyles.modalBtnCancel} onPress={onCancel}>
            <Text style={modalStyles.modalBtnCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
