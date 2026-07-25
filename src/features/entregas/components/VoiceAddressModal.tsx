import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

export type VoiceModalPhase = "listening" | "processing" | "success" | "failed";

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
  const startRecognitionRef = useRef<(notifyParentRetry?: boolean) => Promise<void>>(
    async () => {}
  );
  /** Ignora error/end gerados por abort() intencional (restart / unmount). */
  const suppressAbortNoiseRef = useRef(false);
  const sessionActiveRef = useRef(false);
  /** Invalida callbacks atrasados quando a sessão é substituída. */
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const { ExpoSpeechRecognitionModule: SR, useSpeechRecognitionEvent } = speechModule;

  const stopQuietly = () => {
    suppressAbortNoiseRef.current = true;
    sessionActiveRef.current = false;
    try {
      SR.abort();
    } catch {
      /* sessão pode já ter encerrado */
    }
  };

  const showFailed = () => {
    // Garante que o mic do sistema pare junto com a UI de falha.
    stopQuietly();
    setPhase("failed");
  };

  useSpeechRecognitionEvent("result", (event) => {
    const t = event.results?.[0]?.transcript;
    if (typeof t === "string") transcriptRef.current = t;
  });

  useSpeechRecognitionEvent("end", () => {
    if (suppressAbortNoiseRef.current) return;
    if (!sessionActiveRef.current) return;

    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    sessionActiveRef.current = false;

    if (text) {
      setPhase("success");
      setTimeout(() => onDone(text), 400);
      return;
    }
    showFailed();
  });

  useSpeechRecognitionEvent("error", (event) => {
    // abort() sempre emite "aborted" — não é falha de entendimento.
    // Tratar isso como "não entendi" abre o alerta enquanto o mic segue ativo (loop).
    if (event?.error === "aborted" || suppressAbortNoiseRef.current) {
      return;
    }
    if (!sessionActiveRef.current) return;

    sessionActiveRef.current = false;
    showFailed();
  });

  const startRecognition = async (notifyParentRetry = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const generation = ++generationRef.current;

    try {
      setPhase("listening");
      transcriptRef.current = "";
      if (notifyParentRetry) onRetry?.();

      // Só aborta sessão anterior (retry). Nunca aborta "no vazio" no 1º start —
      // isso gerava error "aborted" e o alerta falso assim que o usuário tocava em Ditar.
      if (sessionActiveRef.current) {
        stopQuietly();
        await new Promise((r) => setTimeout(r, 250));
      }

      if (generation !== generationRef.current) return;

      const result = await SR.requestPermissionsAsync();
      if (generation !== generationRef.current) return;
      if (!result.granted) {
        onCancel();
        return;
      }
      if (!SR.isRecognitionAvailable()) {
        Alert.alert("Não disponível", "Reconhecimento de voz não é suportado neste dispositivo.");
        onCancel();
        return;
      }

      suppressAbortNoiseRef.current = false;
      sessionActiveRef.current = true;
      await SR.start({ lang: "pt-BR", continuous: false, interimResults: true });
    } catch {
      if (generation !== generationRef.current) return;
      sessionActiveRef.current = false;
      Alert.alert("Erro", "Não foi possível iniciar o reconhecimento de voz.");
      onCancel();
    } finally {
      busyRef.current = false;
    }
  };
  startRecognitionRef.current = startRecognition;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await startRecognition(false);
    })();
    return () => {
      cancelled = true;
      generationRef.current += 1;
      stopQuietly();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- monta uma vez por abertura do modal
  }, [SR]);

  const handleRetry = () => {
    void startRecognitionRef.current(true);
  };

  const handleManual = () => {
    generationRef.current += 1;
    stopQuietly();
    onFocusManual?.();
    onCancel();
  };

  const handleClose = () => {
    generationRef.current += 1;
    stopQuietly();
    onCancel();
  };

  const phaseMessage =
    phase === "success"
      ? "✓ Endereço reconhecido"
      : phase === "processing"
        ? "🔄 Processando endereço…"
        : phase === "failed"
          ? "Não consegui entender o endereço informado.\nToque em Tentar novamente e fale rua, bairro e número."
          : "🎤 Ouvindo endereço…\n\nDiga rua, bairro e número.\nEx.: Av. Paulista, Bela Vista, 1000";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalBox}>
          <View style={styles.headerRow}>
            <Text style={[modalStyles.modalTitle, styles.titleFlex]}>Falar endereço</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Fechar"
            >
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {phase === "listening" ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 12 }} />
          ) : null}

          <Text style={modalStyles.modalMessage}>{phaseMessage}</Text>

          {phase === "failed" ? (
            <View style={styles.failedActions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleRetry}>
                <Text style={styles.primaryBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleManual}>
                <Text style={styles.secondaryBtnText}>Digitar manualmente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={modalStyles.modalBtnCancel} onPress={handleClose}>
              <Text style={modalStyles.modalBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  titleFlex: { flex: 1, marginBottom: 0 },
  closeX: {
    fontSize: 20,
    fontWeight: "600",
    color: "#9CA3AF",
    paddingHorizontal: 4,
    lineHeight: 24,
  },
  failedActions: { marginTop: 12, gap: 8 },
  primaryBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  secondaryBtnText: { color: "#E5E7EB", fontWeight: "600", fontSize: 15 },
});
