import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import * as ImagePicker from "expo-image-picker";
import { getEntrega, getMotivosAusencia, marcarEntregue, marcarAusente } from "../api";
import type { EntregaListItem, MotivoAusencia } from "../types";
import { useDeliveryStore } from "../../../store/deliveryStore";
import AddressForm, { type AddressFormValues, type AddressOrigem } from "../components/AddressForm";
import { parseOcrToAddress, parseVoiceToAddress } from "../utils/ocrAddress";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

type Props = NativeStackScreenProps<RootStackParamList, "EntregaDetail">;

export default function EntregaDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { idSaida } = route.params;
  const [entrega, setEntrega] = useState<EntregaListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalAusente, setModalAusente] = useState(false);
  const [modalEndereco, setModalEndereco] = useState(false);
  const [modalEnderecoOpcoes, setModalEnderecoOpcoes] = useState(false);
  const [ocrInitialValues, setOcrInitialValues] = useState<Partial<AddressFormValues> | null>(null);
  const [enderecoOrigem, setEnderecoOrigem] = useState<AddressOrigem>("manual");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [vozListening, setVozListening] = useState(false);
  const vozTranscriptRef = useRef("");
  const vozPendingRef = useRef(false);
  const [motivos, setMotivos] = useState<MotivoAusencia[]>([]);
  const [motivoId, setMotivoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const saveAddress = useDeliveryStore((s) => s.saveAddress);

  useSpeechRecognitionEvent("result", (event) => {
    const t = event.results?.[0]?.transcript;
    if (typeof t === "string" && vozPendingRef.current) vozTranscriptRef.current = t;
  });
  useSpeechRecognitionEvent("end", () => {
    if (!vozPendingRef.current) return;
    vozPendingRef.current = false;
    setVozListening(false);
    const text = vozTranscriptRef.current.trim();
    vozTranscriptRef.current = "";
    if (!text) return;
    const parsed = parseVoiceToAddress(text);
    setOcrInitialValues({ ...parsed, destinatario: parsed.destinatario ?? entrega?.cliente ?? "" });
    setEnderecoOrigem("voz");
    setModalEndereco(true);
  });
  useSpeechRecognitionEvent("error", () => {
    if (vozPendingRef.current) {
      vozPendingRef.current = false;
      setVozListening(false);
      Alert.alert("Erro", "Não foi possível reconhecer a fala.");
    }
  });

  const load = async () => {
    setLoading(true);
    try {
      const [e, m] = await Promise.all([getEntrega(idSaida), getMotivosAusencia()]);
      setEntrega(e);
      setMotivos(m);
      if (m.length) setMotivoId(m[0].id);
    } catch {
      setEntrega(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [idSaida]);

  const handleEntregue = async () => {
    setSaving(true);
    try {
      await marcarEntregue(idSaida);
      Alert.alert("Sucesso", "Entrega marcada como entregue.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Erro ao salvar.";
      Alert.alert("Erro", String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleAbrirAusente = () => setModalAusente(true);

  const handleAbrirEndereco = () => setModalEnderecoOpcoes(true);

  const handleDigitarEndereco = () => {
    setModalEnderecoOpcoes(false);
    setOcrInitialValues(null);
    setEnderecoOrigem("manual");
    setModalEndereco(true);
  };

  const handleOcrEndereco = async () => {
    setModalEnderecoOpcoes(false);
    let extractTextFromImage: (uri: string) => Promise<string[]>;
    let isSupported: boolean;
    try {
      const ocrModule = await import("expo-text-extractor");
      extractTextFromImage = ocrModule.extractTextFromImage;
      isSupported = ocrModule.isSupported;
    } catch {
      Alert.alert(
        "OCR não disponível",
        "O leitor de texto (OCR) funciona apenas em versão de desenvolvimento (build nativo). Use 'Digitar' ou 'Voz' para preencher o endereço."
      );
      return;
    }
    if (!isSupported) {
      Alert.alert("Não disponível", "Reconhecimento de texto não é suportado neste dispositivo.");
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão", "É necessário permitir o uso da câmera para escanear.");
      return;
    }
    setOcrLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setOcrLoading(false);
        return;
      }
      const lines = await extractTextFromImage(result.assets[0].uri);
      const parsed = parseOcrToAddress(lines);
      const nomeOriginal = (entrega?.cliente ?? "").trim();
      const nomeOcr = (parsed.destinatario ?? "").trim();
      const openFormWithDest = (dest: string) => {
        setOcrInitialValues({ ...parsed, destinatario: dest });
        setEnderecoOrigem("ocr");
        setModalEndereco(true);
        setOcrLoading(false);
      };
      if (nomeOcr && nomeOriginal && nomeOcr.toLowerCase() !== nomeOriginal.toLowerCase()) {
        Alert.alert(
          "Atualizar nome do destinatário?",
          `O texto lido foi: "${nomeOcr}". O cadastro atual é: "${nomeOriginal}".`,
          [
            { text: "Manter original", onPress: () => openFormWithDest(nomeOriginal) },
            { text: "Sim", onPress: () => openFormWithDest(nomeOcr) },
          ],
          { onDismiss: () => setOcrLoading(false) }
        );
        return;
      }
      openFormWithDest(nomeOcr || nomeOriginal);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível ler o texto da imagem.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleVozEndereco = async () => {
    setModalEnderecoOpcoes(false);
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert("Permissão", "É necessário permitir o uso do microfone.");
        return;
      }
      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        Alert.alert("Não disponível", "Reconhecimento de voz não é suportado neste dispositivo.");
        return;
      }
      vozTranscriptRef.current = "";
      vozPendingRef.current = true;
      setVozListening(true);
      await ExpoSpeechRecognitionModule.start({
        lang: "pt-BR",
        continuous: false,
        interimResults: false,
      });
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar o reconhecimento de voz.");
      setVozListening(false);
      vozPendingRef.current = false;
    }
  };

  const handleSalvarEndereco = async (vals: AddressFormValues) => {
    const updated = await saveAddress(idSaida, {
      ...vals,
      origem: enderecoOrigem,
    });
    setEntrega(updated);
    setModalEndereco(false);
    setOcrInitialValues(null);
    setEnderecoOrigem("manual");
  };

  const handleConfirmarAusente = async () => {
    if (motivoId == null) {
      Alert.alert("Atenção", "Selecione um motivo.");
      return;
    }
    const motivo = motivos.find((m) => m.id === motivoId);
    if (motivo?.descricao.trim().toLowerCase() === "outro" && !observacao.trim()) {
      Alert.alert("Atenção", "Informe a observação quando o motivo for 'Outro'.");
      return;
    }
    setSaving(true);
    try {
      await marcarAusente(idSaida, motivoId, observacao.trim() || undefined);
      setModalAusente(false);
      setObservacao("");
      Alert.alert("Sucesso", "Entrega marcada como ausente.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Erro ao salvar.";
      Alert.alert("Erro", String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !entrega) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const telefone = entrega.contato?.replace(/\D/g, "") || "";
  const linkTel = telefone.length >= 10 ? `tel:+55${telefone}` : null;
  const statusNorm = (entrega.status || "").toUpperCase();
  const podeFinalizar = statusNorm === "EM_ROTA";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(16, insets.top) }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Detalhe da entrega</Text>
      </View>

      {!podeFinalizar && (
        <View style={styles.avisoRota}>
          <Text style={styles.avisoRotaText}>
            Inicie a rota na tela de escaneamento para poder finalizar esta entrega.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Código</Text>
        <Text style={styles.value}>{entrega.codigo || "—"}</Text>

        <Text style={styles.label}>Cliente</Text>
        <Text style={styles.value}>{entrega.cliente || "—"}</Text>

        <Text style={styles.label}>Endereço</Text>
        <Text style={styles.value}>{entrega.endereco || "—"}</Text>
        {entrega.bairro ? <Text style={styles.valueSec}>{entrega.bairro}</Text> : null}

        <Text style={styles.label}>Telefone</Text>
        {linkTel ? (
          <TouchableOpacity onPress={() => Linking.openURL(linkTel)}>
            <Text style={styles.link}>{entrega.contato || "—"}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.value}>{entrega.contato || "—"}</Text>
        )}

        <TouchableOpacity style={styles.btnEndereco} onPress={handleAbrirEndereco}>
          <Text style={styles.btnEnderecoText}>
            {entrega.possui_endereco ? "Editar Endereço" : "Adicionar Endereço"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.btnEntregue, (saving || !podeFinalizar) && styles.btnDisabled]}
        onPress={handleEntregue}
        disabled={saving || !podeFinalizar}
      >
        <Text style={styles.btnEntregueText}>
          {saving ? "Salvando…" : "Marcar como entregue"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnAusente, (saving || !podeFinalizar) && styles.btnDisabled]}
        onPress={handleAbrirAusente}
        disabled={saving || !podeFinalizar}
      >
        <Text style={styles.btnAusenteText}>Marcar como ausente</Text>
      </TouchableOpacity>

      <Modal visible={modalEnderecoOpcoes} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Adicionar Endereço</Text>
            <Text style={styles.modalMessage}>Como deseja preencher o endereço?</Text>
            <TouchableOpacity style={styles.radio} onPress={handleDigitarEndereco} disabled={ocrLoading}>
              <Text style={styles.radioText}>Digitar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.radio} onPress={handleOcrEndereco} disabled={ocrLoading}>
              <Text style={styles.radioText}>{ocrLoading ? "Abrindo câmera…" : "Leitor (OCR)"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.radio}
              onPress={handleVozEndereco}
              disabled={vozListening}
            >
              <Text style={styles.radioText}>
                {vozListening ? "Ouvindo… Fale o endereço." : "Voz"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalEnderecoOpcoes(false)}>
              <Text style={styles.modalBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalEndereco} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.modalBoxForm]}>
            <Text style={styles.modalTitle}>Endereço</Text>
            <AddressForm
              idSaida={idSaida}
              initialValues={{
                destinatario: "",
                rua: "",
                numero: "",
                complemento: "",
                bairro: "",
                cidade: "",
                estado: "",
                cep: "",
                ...(ocrInitialValues ?? {
                  destinatario: entrega.cliente ?? "",
                  rua: (entrega as { endereco?: string }).endereco?.split(",")[0] ?? "",
                  bairro: entrega.bairro ?? "",
                }),
              }}
              origem={enderecoOrigem}
              onSave={handleSalvarEndereco}
              onCancel={() => {
                setModalEndereco(false);
                setOcrInitialValues(null);
                setEnderecoOrigem("manual");
              }}
              submitLabel="Salvar"
            />
          </View>
        </View>
      </Modal>

      <Modal visible={modalAusente} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Motivo da ausência</Text>
            {motivos.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.radio, motivoId === m.id && styles.radioActive]}
                onPress={() => setMotivoId(m.id)}
              >
                <Text style={styles.radioText}>{m.descricao}</Text>
              </TouchableOpacity>
            ))}
            {motivoId !== null && motivos.find((m) => m.id === motivoId)?.descricao.trim().toLowerCase() === "outro" && (
              <TextInput
                style={styles.input}
                placeholder="Observação (obrigatório)"
                value={observacao}
                onChangeText={setObservacao}
                multiline
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalAusente(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnOk} onPress={handleConfirmarAusente} disabled={saving}>
                <Text style={styles.modalBtnOkText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { marginBottom: 16 },
  backText: { fontSize: 16, color: "#0d6efd", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  avisoRota: {
    backgroundColor: "#fff3cd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  avisoRotaText: { fontSize: 14, color: "#856404" },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: { fontSize: 12, color: "#666", marginTop: 12, marginBottom: 4 },
  value: { fontSize: 16, color: "#333" },
  valueSec: { fontSize: 14, color: "#666", marginTop: 2 },
  link: { fontSize: 16, color: "#0d6efd" },
  btnEntregue: {
    backgroundColor: "#198754",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  btnAusente: {
    backgroundColor: "#dc3545",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnEntregueText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  btnAusenteText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 12, padding: 24 },
  modalBoxForm: { flex: 1, margin: 0, justifyContent: "center" },
  modalMessage: { fontSize: 16, color: "#333", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  btnEndereco: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0d6efd",
    alignItems: "center",
  },
  btnEnderecoText: { color: "#0d6efd", fontSize: 16, fontWeight: "600" },
  radio: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8, backgroundColor: "#f5f5f5" },
  radioActive: { backgroundColor: "#0d6efd" },
  radioText: { fontSize: 16 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginTop: 12, minHeight: 80 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 24, gap: 12 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 20 },
  modalBtnCancelText: { color: "#666" },
  modalBtnOk: { backgroundColor: "#0d6efd", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalBtnOkText: { color: "#fff", fontWeight: "600" },
});
