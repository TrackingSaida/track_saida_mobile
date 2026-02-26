import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Modal, Alert } from "react-native";

/** Só montado após import dinâmico do módulo; evita crash no Expo Go. */
export default function VoiceAddressModal({
  speechModule,
  modalStyles,
  onDone,
  onCancel,
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
}) {
  const transcriptRef = useRef("");
  const { ExpoSpeechRecognitionModule: SR, useSpeechRecognitionEvent } = speechModule;

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
    let cancelled = false;
    (async () => {
      try {
        const result = await SR.requestPermissionsAsync();
        if (!result.granted || cancelled) return onCancel();
        if (!SR.isRecognitionAvailable()) {
          Alert.alert("Não disponível", "Reconhecimento de voz não é suportado neste dispositivo.");
          return onCancel();
        }
        if (cancelled) return;
        await SR.start({ lang: "pt-BR", continuous: false, interimResults: false });
      } catch {
        if (!cancelled) Alert.alert("Erro", "Não foi possível iniciar o reconhecimento de voz.");
        onCancel();
      }
    })();
    return () => {
      cancelled = true;
      try {
        SR.abort();
      } catch {}
    };
  }, [SR]);

  return (
    <Modal visible transparent animationType="fade">
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalBox}>
          <Text style={modalStyles.modalTitle}>Voz</Text>
          <Text style={modalStyles.modalMessage}>Ouvindo… Fale o endereço.</Text>
          <TouchableOpacity style={modalStyles.modalBtnCancel} onPress={onCancel}>
            <Text style={modalStyles.modalBtnCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
