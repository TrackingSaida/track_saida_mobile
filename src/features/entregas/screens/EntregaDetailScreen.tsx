import React, { useEffect, useMemo, useState, useRef } from "react";
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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import * as ImagePicker from "expo-image-picker";
import { getEntrega, getMotivosAusencia, marcarEntregue, marcarAusente, fetchComprovanteImageDataUri } from "../api";
import {
  selectOrTakePhoto,
  preparePhoto,
  uploadDeliveryPhoto,
  MAX_PHOTOS,
} from "../../../services/deliveryPhotoService";
import type { EntregaListItem, MotivoAusencia } from "../types";
import { useDeliveryStore } from "../../../store/deliveryStore";
import AddressForm, { type AddressFormValues, type AddressOrigem } from "../components/AddressForm";
import FormEntregaConcluida from "../components/FormEntregaConcluida";
import { parseOcrToAddress, parseVoiceToAddress } from "../utils/ocrAddress";
import VoiceAddressModal from "../components/VoiceAddressModal";
import { runPostFinalizeFeedback } from "../utils/finalizeEntregaFeedback";

type Props = NativeStackScreenProps<RootStackParamList, "EntregaDetail">;

function FieldRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof StyleSheet.create> }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </>
  );
}

export default function EntregaDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingBottom: 48 },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        header: { marginBottom: 16 },
        backText: { fontSize: 16, color: colors.primary, marginBottom: 8 },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        tentativaLabel: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
        avisoRota: {
          backgroundColor: colors.warning,
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
        },
        avisoRotaText: { fontSize: 14, color: colors.text },
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
        label: { fontSize: 12, color: colors.textSecondary, marginTop: 12, marginBottom: 4 },
        value: { fontSize: 16, color: colors.text },
        valueSec: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
        link: { fontSize: 16, color: colors.primary },
        btnEntregue: {
          backgroundColor: colors.success,
          paddingVertical: 18,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 12,
        },
        btnAusente: { backgroundColor: colors.danger, paddingVertical: 18, borderRadius: 12, alignItems: "center" },
        btnNovaTentativa: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 12, alignItems: "center", marginBottom: 12 },
        btnDisabled: { opacity: 0.7 },
        btnEntregueText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "600" },
        btnAusenteText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "600" },
        btnNovaTentativaText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "600" },
        modalOverlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          padding: 24,
        },
        modalBox: { backgroundColor: colors.backgroundCard, borderRadius: 12, padding: 24 },
        modalBoxForm: { flex: 1, margin: 0, justifyContent: "center" },
        modalMessage: { fontSize: 16, color: colors.text, marginBottom: 16 },
        modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, color: colors.text },
        btnEndereco: {
          marginTop: 16,
          paddingVertical: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: "center",
        },
        btnEnderecoText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
        radio: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          marginBottom: 8,
          backgroundColor: colors.inputBackground,
        },
        radioActive: { backgroundColor: colors.primary },
        radioText: { fontSize: 16, color: colors.text },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
          minHeight: 80,
          color: colors.text,
        },
        modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 24, gap: 12 },
        modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 20 },
        modalBtnCancelText: { color: colors.textSecondary },
        modalBtnOk: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
        modalBtnOkText: { color: colors.primaryContrast, fontWeight: "600" },
        photoRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 12 },
        photoWrap: { width: 64, height: 64, borderRadius: 8, overflow: "hidden", backgroundColor: colors.inputBackground },
        photoImg: { width: 64, height: 64 },
        photoRemove: { position: "absolute" as const, top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, padding: 2 },
        photoStatus: { fontSize: 9, color: colors.textSecondary, marginTop: 2 },
        btnAddPhoto: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.inputBackground },
        btnAddPhotoText: { fontSize: 13, color: colors.primary },
      }),
    [colors]
  );
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
  const [vozLoading, setVozLoading] = useState(false);
  const [speechModule, setSpeechModule] = useState<typeof import("expo-speech-recognition") | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showEntregueModal, setShowEntregueModal] = useState(false);
  const [motivos, setMotivos] = useState<MotivoAusencia[]>([]);
  const [motivoId, setMotivoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  type PhotoItem = { uri: string; status: "idle" | "uploading" | "sent" | "error"; object_key?: string };
  const [ausentePhotos, setAusentePhotos] = useState<PhotoItem[]>([]);
  const [comprovanteThumb, setComprovanteThumb] = useState<string | null>(null);
  const [loadingComprovante, setLoadingComprovante] = useState(false);
  const [showComprovanteViewer, setShowComprovanteViewer] = useState(false);
  const saveAddress = useDeliveryStore((s) => s.saveAddress);
  const novaTentativa = useDeliveryStore((s) => s.novaTentativa);
  const load = async () => {
    setLoading(true);
    try {
      const [e, m] = await Promise.all([getEntrega(idSaida), getMotivosAusencia()]);
      setEntrega(e);
      setMotivos(m);
      if (m.length) setMotivoId(m[0].id);
      const exibirComprovante =
        !!e?.tem_comprovante || e?.exibicao === "Entregue" || e?.exibicao === "Ausente";
      if (exibirComprovante) {
        setLoadingComprovante(true);
        try {
          const dataUri = await fetchComprovanteImageDataUri(idSaida);
          setComprovanteThumb(dataUri);
        } catch {
          setComprovanteThumb(null);
        } finally {
          setLoadingComprovante(false);
        }
      } else {
        setComprovanteThumb(null);
      }
    } catch {
      setEntrega(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [idSaida]);

  const handleAbrirEntregueModal = () => setShowEntregueModal(true);

  const handleAbrirAusente = () => {
    setAusentePhotos([]);
    setModalAusente(true);
  };

  const addPhotoAusente = async () => {
    if (ausentePhotos.length >= MAX_PHOTOS) return;
    try {
      const picked = await selectOrTakePhoto();
      if (!picked) return;
      const prepared = await preparePhoto(picked.uri);
      setAusentePhotos((prev) => [...prev, { uri: prepared.uri, status: "idle" }]);
    } catch (e) {
      Alert.alert("Erro", (e as Error)?.message || "Não foi possível adicionar a foto.");
    }
  };

  const removePhotoAusente = (index: number) => {
    setAusentePhotos((prev) => prev.filter((_, i) => i !== index));
  };

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
    setVozLoading(true);
    try {
      const mod = await import("expo-speech-recognition");
      setSpeechModule(mod);
      setShowVoiceModal(true);
    } catch {
      Alert.alert(
        "Voz não disponível",
        "O reconhecimento de voz funciona apenas em versão de desenvolvimento (build nativo). Use 'Digitar' ou 'Leitor (OCR)' para preencher o endereço."
      );
    } finally {
      setVozLoading(false);
    }
  };

  const handleVoiceDone = (transcript: string) => {
    setShowVoiceModal(false);
    setSpeechModule(null);
    const parsed = parseVoiceToAddress(transcript);
    setOcrInitialValues({
      ...parsed,
      destinatario: parsed.destinatario ?? entrega?.cliente ?? "",
    });
    setEnderecoOrigem("voz");
    setModalEndereco(true);
  };

  const handleVoiceCancel = () => {
    setShowVoiceModal(false);
    setSpeechModule(null);
  };

  const handleSalvarEndereco = async (vals: AddressFormValues) => {
    try {
      const updated = await saveAddress(idSaida, {
        ...vals,
        origem: enderecoOrigem,
      });
      setEntrega(updated);
      setModalEndereco(false);
      setOcrInitialValues(null);
      setEnderecoOrigem("manual");
    } catch (e) {
      Alert.alert("Erro ao salvar endereço", e instanceof Error ? e.message : "Não foi possível salvar. Verifique o endereço e tente novamente.");
    }
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
    const required = new Set((entrega?.campos_obrigatorios_ausente || []).map((f) => String(f || "").trim().toLowerCase()));
    const missing: string[] = [];
    if (required.has("foto") && ausentePhotos.length === 0) missing.push("Foto");
    if (required.has("observacao") && !observacao.trim()) missing.push("Observação");
    if (missing.length) {
      Alert.alert("Atenção", `Preencha os campos obrigatórios para concluir este pedido: ${missing.join(", ")}.`);
      return;
    }
    setSaving(true);
    try {
      const idleIndexes = ausentePhotos.map((p, i) => (p.status === "idle" ? i : -1)).filter((i) => i >= 0);
      for (const idx of idleIndexes) {
        const item = ausentePhotos[idx];
        if (!item || item.status !== "idle") continue;
        setAusentePhotos((prev) =>
          prev.map((p, j) => (j === idx ? { ...p, status: "uploading" as const } : p))
        );
        try {
          await uploadDeliveryPhoto({
            id_saida: idSaida,
            tipo: "ausente",
            uri: item.uri,
            mimeType: "image/jpeg",
            filename: "foto.jpg",
            validarCamposObrigatorios: false,
            alterarStatus: false,
          });
          setAusentePhotos((prev) =>
            prev.map((p, j) => (j === idx ? { ...p, status: "sent" as const } : p))
          );
        } catch (uploadErr) {
          setAusentePhotos((prev) =>
            prev.map((p, j) => (j === idx ? { ...p, status: "error" as const } : p))
          );
          Alert.alert("Erro ao enviar foto", (uploadErr as Error)?.message || "Falha no envio.");
          setSaving(false);
          return;
        }
      }
      await marcarAusente(idSaida, motivoId, observacao.trim() || undefined);
      setModalAusente(false);
      setObservacao("");
      setAusentePhotos([]);
      runPostFinalizeFeedback({
        tipo: "ausente",
        codigo: entrega?.codigo,
        onAfterIndividualAlert: () => navigation.goBack(),
      });
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
  const isAusente = entrega.exibicao === "Ausente";
  const isEntregue = entrega.exibicao === "Entregue";
  const isCancelado = entrega.exibicao === "Cancelado" || statusNorm === "CANCELADO";
  const isFinalizado = isEntregue || isAusente || isCancelado;
  const mostrarAvisoRota = !isFinalizado && !podeFinalizar && !isAusente;
  const statusLabel = (entrega.exibicao || entrega.status || "—").trim() || "—";

  const temCliente = !!(entrega.cliente || "").trim();
  const temEndereco = !!(entrega.endereco || "").trim();
  const temBairro = !!(entrega.bairro || "").trim();
  const temTelefone = telefone.length >= 10;
  const temTipoRecebedor = !!(entrega.tipo_recebedor || "").trim();
  const temNomeRecebedor = !!(entrega.nome_recebedor || "").trim();
  const temDocumento =
    !!(entrega.tipo_documento || "").trim() || !!(entrega.numero_documento || "").trim();
  const documentoTexto = [entrega.tipo_documento, entrega.numero_documento].filter(Boolean).join(" ").trim();
  const temObsEntrega = !!(entrega.observacao_entrega || "").trim();
  const temObsAusencia = !!(entrega.observacao_ocorrencia || "").trim();
  const exibirComprovante =
    !isCancelado &&
    (!!entrega.tem_comprovante || isEntregue || isAusente || !!comprovanteThumb || loadingComprovante);
  const temDadosEntrega =
    temTipoRecebedor ||
    temNomeRecebedor ||
    temDocumento ||
    temObsEntrega ||
    temObsAusencia ||
    exibirComprovante;
  const temDadosEndereco = temCliente || temEndereco || temBairro || temTelefone;
  const mostrarBlocoEndereco = temDadosEndereco;
  const mostrarBotaoEndereco = !isFinalizado;
  const visaoMinima = !temDadosEntrega && !mostrarBlocoEndereco;
  const tentativaNum = entrega.tentativa ?? 1;
  const tentativaLabel = tentativaNum >= 2 ? `${tentativaNum}ª tentativa` : null;

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
        {tentativaLabel ? <Text style={styles.tentativaLabel}>{tentativaLabel}</Text> : null}
      </View>

      {mostrarAvisoRota ? (
        <View style={styles.avisoRota}>
          <Text style={styles.avisoRotaText}>
            Inicie a rota na tela de escaneamento para poder finalizar esta entrega.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <FieldRow label="Código" value={entrega.codigo || "—"} styles={styles} />
        {visaoMinima ? <FieldRow label="Status" value={statusLabel} styles={styles} /> : null}

        {temDadosEntrega ? (
          <>
            {temTipoRecebedor ? (
              <FieldRow label="Tipo do recebedor" value={entrega.tipo_recebedor!.trim()} styles={styles} />
            ) : null}
            {temNomeRecebedor ? (
              <FieldRow label="Recebedor" value={entrega.nome_recebedor!.trim()} styles={styles} />
            ) : null}
            {temDocumento ? <FieldRow label="Documento" value={documentoTexto} styles={styles} /> : null}
            {temObsEntrega ? (
              <FieldRow label="Observação da entrega" value={entrega.observacao_entrega!.trim()} styles={styles} />
            ) : null}
            {temObsAusencia ? (
              <FieldRow label="Observação (ausência)" value={entrega.observacao_ocorrencia!.trim()} styles={styles} />
            ) : null}
            {exibirComprovante ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.label}>Comprovante</Text>
                <TouchableOpacity
                  style={{ marginTop: 6, borderRadius: 8, overflow: "hidden", alignSelf: "flex-start" }}
                  onPress={() => comprovanteThumb && setShowComprovanteViewer(true)}
                  disabled={!comprovanteThumb}
                >
                  {loadingComprovante ? (
                    <View
                      style={{
                        width: 110,
                        height: 110,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: colors.inputBackground,
                      }}
                    >
                      <ActivityIndicator />
                    </View>
                  ) : comprovanteThumb ? (
                    <Image source={{ uri: comprovanteThumb }} style={{ width: 110, height: 110, borderRadius: 8 }} />
                  ) : (
                    <View
                      style={{
                        width: 110,
                        height: 110,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: colors.inputBackground,
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Sem preview</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {comprovanteThumb ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>Toque para ampliar</Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {!visaoMinima ? <FieldRow label="Status" value={statusLabel} styles={styles} /> : null}

        {mostrarBlocoEndereco ? (
          <>
            {temCliente ? <FieldRow label="Cliente" value={entrega.cliente!.trim()} styles={styles} /> : null}
            {temEndereco ? <FieldRow label="Endereço" value={entrega.endereco!.trim()} styles={styles} /> : null}
            {temBairro ? <Text style={styles.valueSec}>{entrega.bairro!.trim()}</Text> : null}
            {temTelefone ? (
              <>
                <Text style={styles.label}>Telefone</Text>
                <TouchableOpacity onPress={() => Linking.openURL(linkTel!)}>
                  <Text style={styles.link}>{entrega.contato!.trim()}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        ) : null}

        {mostrarBotaoEndereco ? (
          <TouchableOpacity style={styles.btnEndereco} onPress={handleAbrirEndereco}>
            <Text style={styles.btnEnderecoText}>
              {entrega.possui_endereco ? "Editar Endereço" : "Adicionar Endereço"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isAusente ? (
        <TouchableOpacity
          style={[styles.btnNovaTentativa, saving && styles.btnDisabled]}
          onPress={async () => {
            setSaving(true);
            try {
              await novaTentativa(idSaida);
              Alert.alert("Sucesso", "Pedido colocado em rota para nova tentativa.", [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            } catch (e: unknown) {
              const msg = e && typeof e === "object" && "response" in e
                ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
                : "Erro ao solicitar nova tentativa.";
              Alert.alert("Erro", String(msg));
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
        >
          <Text style={styles.btnNovaTentativaText}>Nova Tentativa</Text>
        </TouchableOpacity>
      ) : podeFinalizar ? (
        <>
          <TouchableOpacity style={styles.btnEntregue} onPress={handleAbrirEntregueModal}>
            <Text style={styles.btnEntregueText}>Marcar como entregue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAusente, saving && styles.btnDisabled]}
            onPress={handleAbrirAusente}
            disabled={saving}
          >
            <Text style={styles.btnAusenteText}>Marcar como ausente</Text>
          </TouchableOpacity>
        </>
      ) : null}

      <Modal visible={modalEnderecoOpcoes} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Adicionar Endereço</Text>
            <TouchableOpacity style={styles.radio} onPress={handleDigitarEndereco} disabled={ocrLoading}>
              <Text style={styles.radioText}>Digitar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.radio} onPress={handleOcrEndereco} disabled={ocrLoading}>
              <Text style={styles.radioText}>{ocrLoading ? "Abrindo câmera…" : "Leitor (OCR)"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.radio}
              onPress={handleVozEndereco}
              disabled={vozLoading}
            >
              <Text style={styles.radioText}>
                {vozLoading ? "Abrindo…" : "Voz"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalEnderecoOpcoes(false)}>
              <Text style={styles.modalBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showVoiceModal && speechModule && (
        <VoiceAddressModal
          speechModule={speechModule}
          modalStyles={{
            modalOverlay: styles.modalOverlay,
            modalBox: styles.modalBox,
            modalTitle: styles.modalTitle,
            modalMessage: styles.modalMessage,
            modalBtnCancel: styles.modalBtnCancel,
            modalBtnCancelText: styles.modalBtnCancelText,
          }}
          onDone={handleVoiceDone}
          onCancel={handleVoiceCancel}
        />
      )}

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

      <FormEntregaConcluida
        visible={showEntregueModal}
        idSaida={idSaida}
        destinatarioPreenchido={entrega?.cliente ?? undefined}
        requiredFields={entrega?.campos_obrigatorios_entregue || []}
        onConfirm={async (body) => marcarEntregue(idSaida, body)}
        onClose={() => setShowEntregueModal(false)}
        onSuccess={async () => {
          await load();
          runPostFinalizeFeedback({
            tipo: "entregue",
            codigo: entrega?.codigo,
            onAfterIndividualAlert: () => navigation.goBack(),
          });
        }}
      />

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
            <Text style={styles.label}>Comprovante (opcional, até {MAX_PHOTOS} fotos)</Text>
            <View style={styles.photoRow}>
              {ausentePhotos.map((p, idx) => (
                <View key={idx} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photoImg} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhotoAusente(idx)}
                    disabled={saving}
                  >
                    <Text style={{ color: "#fff", fontSize: 10 }}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.photoStatus} numberOfLines={1}>
                    {p.status === "idle" && "Pendente"}
                    {p.status === "uploading" && "Enviando…"}
                    {p.status === "sent" && "Enviado"}
                    {p.status === "error" && "Falhou"}
                  </Text>
                </View>
              ))}
              {ausentePhotos.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.btnAddPhoto} onPress={addPhotoAusente} disabled={saving}>
                  <Text style={styles.btnAddPhotoText}>+ Foto</Text>
                </TouchableOpacity>
              )}
            </View>
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

      <Modal visible={showComprovanteViewer} transparent={false} animationType="fade" onRequestClose={() => setShowComprovanteViewer(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={{ paddingTop: Math.max(14, insets.top), paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.3)" }}>
            <TouchableOpacity onPress={() => setShowComprovanteViewer(false)}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 }}>Fechar</Text>
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 14 }}>Comprovante {entrega?.codigo ? `- ${entrega.codigo}` : ""}</Text>
          </View>
          {comprovanteThumb ? (
            <Image source={{ uri: comprovanteThumb }} style={{ flex: 1, resizeMode: "contain" }} />
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}
