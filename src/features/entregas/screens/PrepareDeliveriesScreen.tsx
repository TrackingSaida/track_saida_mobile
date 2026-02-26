import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import { useDeliveryStore } from "../../../store/deliveryStore";
import AddressForm, { type AddressFormValues, type AddressOrigem, type AddressCandidate } from "../components/AddressForm";
import VoiceAddressModal from "../components/VoiceAddressModal";
import type { EntregaListItem } from "../types";
import { servicoTipo, SERVICO_ORDER } from "../utils/servico";
import { parseOcrToAddress, parseVoiceToAddress } from "../utils/ocrAddress";

type Props = NativeStackScreenProps<RootStackParamList, "PrepareDeliveries">;

export default function PrepareDeliveriesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 24 },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        header: { marginBottom: 24 },
        backText: { fontSize: 16, color: colors.primary, marginBottom: 8 },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        card: {
          backgroundColor: colors.backgroundCard,
          padding: 20,
          borderRadius: 12,
          marginBottom: 24,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        totalLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
        totalValue: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 16 },
        row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
        label: { fontSize: 14, color: colors.textSecondary },
        value: { fontSize: 16, fontWeight: "600", color: colors.text },
        btnSequencia: {
          backgroundColor: colors.primary,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 12,
        },
        btnDisabled: { opacity: 0.6 },
        btnSequenciaText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "600" },
        btnLista: {
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.primary,
        },
        btnListaText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
        modalWrap: { flex: 1, backgroundColor: colors.backgroundCard },
        modalHeader: {
          paddingHorizontal: 24,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        modalBackText: { fontSize: 16, color: colors.primary, marginBottom: 8 },
        modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
        modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
        codigoCard: {
          backgroundColor: colors.primary + "18",
          borderWidth: 2,
          borderColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginTop: 12,
          marginBottom: 8,
        },
        codigoLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 4, textTransform: "uppercase" },
        codigoValue: { fontSize: 22, fontWeight: "800", color: colors.text },
        modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
        btnPular: { paddingVertical: 8, paddingHorizontal: 12, marginLeft: 8 },
        btnPularText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
        ordemModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
        ordemModalBox: { backgroundColor: colors.backgroundCard, borderRadius: 12, padding: 20 },
        ordemModalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 16 },
        ordemBtn: { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginBottom: 10 },
        ordemBtnLast: { marginBottom: 0 },
        ordemBtnText: { fontSize: 16, fontWeight: "600", color: colors.primaryContrast },
        ordemBtnOutline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: "transparent" },
        ordemBtnOutlineText: { color: colors.primary },
        btnCriarRota: {
          backgroundColor: colors.primary,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 12,
        },
        btnCriarRotaText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "600" },
        voiceModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
        voiceModalBox: { backgroundColor: colors.backgroundCard, borderRadius: 12, padding: 20 },
        voiceModalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        voiceModalMessage: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
        voiceModalBtnCancel: { paddingVertical: 12, alignItems: "center" },
        voiceModalBtnCancelText: { fontSize: 16, color: colors.primary },
      }),
    [colors]
  );
  const {
    pendingDeliveries,
    deliveriesWithAddress,
    deliveriesWithoutAddress,
    loadDeliveries,
    saveAddress,
    loading,
    setRouteDeliveries,
    clearActiveRouteState,
    activeRouteId,
  } = useDeliveryStore();

  const [sequenciaAtiva, setSequenciaAtiva] = useState(false);
  const [showOrdemModal, setShowOrdemModal] = useState(false);
  /** Lista fixa de entregas sem endereço no início da sequência (permite pular e ordem por serviço). */
  const [sequenciaList, setSequenciaList] = useState<EntregaListItem[]>([]);
  const [sequenciaIndex, setSequenciaIndex] = useState(0);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [speechModule, setSpeechModule] = useState<{
    ExpoSpeechRecognitionModule: typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent: typeof import("expo-speech-recognition").useSpeechRecognitionEvent;
  } | null>(null);
  const voiceResolveRef = useRef<(v: AddressCandidate[] | AddressCandidate | null) => void>(() => {});
  const voiceRejectRef = useRef<() => void>(() => {});

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const total = pendingDeliveries.length;
  const comEndereco = deliveriesWithAddress.length;
  const semEndereco = deliveriesWithoutAddress.length;
  const sequenciaTotal = sequenciaList.length;
  const atual = sequenciaList[sequenciaIndex] ?? null;

  const handleIniciarSequencia = () => {
    if (semEndereco === 0) {
      setSequenciaAtiva(false);
      return;
    }
    setShowOrdemModal(true);
  };

  const handleEscolherOrdem = (porServico: boolean) => {
    setShowOrdemModal(false);
    const list = porServico
      ? [...deliveriesWithoutAddress].sort(
          (a, b) =>
            SERVICO_ORDER.indexOf(servicoTipo(a.servico)) - SERVICO_ORDER.indexOf(servicoTipo(b.servico))
        )
      : [...deliveriesWithoutAddress];
    setSequenciaList(list);
    setSequenciaIndex(0);
    setSequenciaAtiva(true);
  };

  const handleSalvarEndereco = async (vals: AddressFormValues, origemOverride?: AddressOrigem) => {
    if (!atual) return;
    try {
      await saveAddress(atual.id_saida, { ...vals, origem: origemOverride ?? "manual" });
      const nextIndex = sequenciaIndex + 1;
      setSequenciaIndex(nextIndex);
      if (nextIndex >= sequenciaList.length) {
        setSequenciaAtiva(false);
      }
    } catch (e) {
      Alert.alert("Erro ao salvar endereço", e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.");
    }
  };

  const handleRequestOcr = useCallback(async (): Promise<AddressCandidate[] | AddressCandidate | null> => {
    const isExpoGo = Constants.appOwnership === "expo";
    if (isExpoGo) {
      Alert.alert(
        "OCR no Expo Go",
        "O leitor por imagem (OCR) só funciona em build nativo. No Expo Go use a opção Digitar ou Voz para preencher o endereço."
      );
      return null;
    }
    let extractTextFromImage: (uri: string) => Promise<string[]>;
    let isSupported: boolean;
    try {
      const ocrModule = await import("expo-text-extractor");
      extractTextFromImage = ocrModule.extractTextFromImage;
      isSupported = ocrModule.isSupported;
    } catch {
      Alert.alert(
        "OCR não disponível",
        "O leitor de texto (OCR) funciona apenas em versão de desenvolvimento (build nativo). Use digitar ou Voz para preencher o endereço."
      );
      return null;
    }
    if (!isSupported) {
      Alert.alert("Não disponível", "Reconhecimento de texto não é suportado neste dispositivo.");
      return null;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão", "É necessário permitir o uso da câmera para escanear.");
      return null;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return null;
      const lines = await extractTextFromImage(result.assets[0].uri);
      const parsed = parseOcrToAddress(lines);
      return Object.keys(parsed).length > 0 ? parsed : null;
    } catch {
      Alert.alert("Erro", "Não foi possível ler o texto da imagem.");
      return null;
    }
  }, []);

  const handleRequestVoz = useCallback((): Promise<AddressCandidate[] | AddressCandidate | null> => {
    const isExpoGo = Constants.appOwnership === "expo";
    if (isExpoGo) {
      Alert.alert(
        "Voz no Expo Go",
        "O reconhecimento por voz só funciona em build nativo. No Expo Go use a opção Digitar ou Leitor (OCR) para preencher o endereço."
      );
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      voiceResolveRef.current = (v) => {
        setShowVoiceModal(false);
        setSpeechModule(null);
        resolve(v);
      };
      voiceRejectRef.current = () => {
        setShowVoiceModal(false);
        setSpeechModule(null);
        resolve(null);
      };
      (async () => {
        try {
          const mod = await import("expo-speech-recognition");
          setSpeechModule(mod);
          setShowVoiceModal(true);
        } catch {
          Alert.alert(
            "Voz não disponível",
            "O reconhecimento de voz funciona apenas em versão de desenvolvimento (build nativo). Use digitar ou Leitor (OCR) para preencher o endereço."
          );
          resolve(null);
        }
      })();
    });
  }, []);

  const handleVoiceDone = useCallback((transcript: string) => {
    const parsed = parseVoiceToAddress(transcript);
    if (Object.keys(parsed).length > 0) {
      voiceResolveRef.current(parsed);
    } else {
      voiceResolveRef.current(null);
    }
  }, []);

  const handleVoiceCancel = useCallback(() => {
    voiceRejectRef.current();
  }, []);

  const handleCriarRota = useCallback(() => {
    if (deliveriesWithAddress.length === 0) return;
    if (deliveriesWithoutAddress.length > 0) {
      const x = deliveriesWithoutAddress.length;
      Alert.alert(
        "Criar Rota",
        `${x} entrega${x !== 1 ? "s" : ""} não possuem endereço e não entrarão na rota.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Criar rota parcial",
            onPress: () => {
              try {
                if (activeRouteId !== null) clearActiveRouteState();
                setRouteDeliveries(deliveriesWithAddress);
                navigation.navigate("RouteBuilder");
              } catch (e) {
                console.error("[Criar rota parcial] crash:", e);
                Alert.alert(
                  "Erro",
                  `Erro ao criar rota: ${e instanceof Error ? e.message : String(e)}.`
                );
              }
            },
          },
          { text: "Adicionar endereços", onPress: () => {} },
        ]
      );
    } else {
      try {
        if (activeRouteId !== null) clearActiveRouteState();
        setRouteDeliveries(deliveriesWithAddress);
        navigation.navigate("RouteBuilder");
      } catch (e) {
        console.error("[Criar Rota] crash:", e);
        Alert.alert("Erro", `Erro ao criar rota: ${e instanceof Error ? e.message : String(e)}.`);
      }
    }
  }, [deliveriesWithAddress, deliveriesWithoutAddress, activeRouteId, clearActiveRouteState, setRouteDeliveries, navigation]);

  const handlePular = () => {
    const nextIndex = sequenciaIndex + 1;
    setSequenciaIndex(nextIndex);
    if (nextIndex >= sequenciaList.length) {
      setSequenciaAtiva(false);
    }
  };

  const handleFecharSequencia = () => setSequenciaAtiva(false);

  if (loading && total === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(16, insets.top), paddingBottom: 24 }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Preparar Rota</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.totalLabel}>Total de entregas</Text>
        <Text style={styles.totalValue}>{total}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Com endereço</Text>
          <Text style={styles.value}>{comEndereco}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Sem endereço</Text>
          <Text style={styles.value}>{semEndereco}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btnSequencia, semEndereco === 0 && styles.btnDisabled]}
        onPress={handleIniciarSequencia}
        disabled={semEndereco === 0}
      >
        <Text style={styles.btnSequenciaText}>Adicionar Endereços em Sequência</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnLista} onPress={() => navigation.navigate("EntregasList")}>
        <Text style={styles.btnListaText}>Ir para Pendentes</Text>
      </TouchableOpacity>

      {comEndereco > 0 && (
        <TouchableOpacity style={styles.btnCriarRota} onPress={handleCriarRota}>
          <Text style={styles.btnCriarRotaText}>Criar Rota / Iniciar Rota</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showOrdemModal} transparent animationType="fade">
        <View style={styles.ordemModalOverlay}>
          <View style={styles.ordemModalBox}>
            <Text style={styles.ordemModalTitle}>Como ordenar as entregas?</Text>
            <TouchableOpacity
              style={[styles.ordemBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleEscolherOrdem(false)}
            >
              <Text style={styles.ordemBtnText}>Sequencial</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ordemBtn, styles.ordemBtnLast, { backgroundColor: colors.primary }]}
              onPress={() => handleEscolherOrdem(true)}
            >
              <Text style={styles.ordemBtnText}>Por serviço (ML → Shopee → Avulso)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ordemBtn, styles.ordemBtnOutline, styles.ordemBtnLast]}
              onPress={() => setShowOrdemModal(false)}
            >
              <Text style={styles.ordemBtnOutlineText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={sequenciaAtiva && !!atual} animationType="slide">
        <View style={styles.modalWrap}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(16, insets.top) }]}>
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={handleFecharSequencia}>
                <Text style={styles.modalBackText}>← Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPular} onPress={handlePular}>
                <Text style={styles.btnPularText}>Pular</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.codigoCard}>
              <Text style={styles.codigoLabel}>Código do pedido</Text>
              <Text style={styles.codigoValue}>{atual?.codigo ?? "—"}</Text>
            </View>
            <Text style={styles.modalTitle}>
              Entrega {sequenciaIndex + 1} de {sequenciaTotal}
            </Text>
            <Text style={styles.modalSubtitle}>{atual?.cliente ? `Destinatário: ${atual.cliente}` : ""}</Text>
          </View>
          {atual && (
            <>
              <AddressForm
                idSaida={atual.id_saida}
                initialValues={{
                  destinatario: atual.cliente ?? "",
                  rua: "",
                  numero: "",
                  complemento: "",
                  bairro: atual.bairro ?? "",
                  cidade: "",
                  estado: "",
                  cep: "",
                }}
                origem="manual"
                onSave={handleSalvarEndereco}
                enableOnlyDestinatarioShortcut={false}
                onCancel={handleFecharSequencia}
                submitLabel="Salvar e próximo"
                showOcrVozIcons
                onRequestOcr={handleRequestOcr}
                onRequestVoz={handleRequestVoz}
              />
              {showVoiceModal && speechModule && (
                <VoiceAddressModal
                  speechModule={speechModule}
                  modalStyles={{
                    modalOverlay: styles.voiceModalOverlay,
                    modalBox: styles.voiceModalBox,
                    modalTitle: styles.voiceModalTitle,
                    modalMessage: styles.voiceModalMessage,
                    modalBtnCancel: styles.voiceModalBtnCancel,
                    modalBtnCancelText: styles.voiceModalBtnCancelText,
                  }}
                  onDone={handleVoiceDone}
                  onCancel={handleVoiceCancel}
                />
              )}
            </>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}
