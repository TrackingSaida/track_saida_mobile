import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { EntregueBody } from "../api";
import { formatCPF, formatRG, unmaskCPF, unmaskRG } from "../utils/formatDocument";
import {
  selectOrTakePhoto,
  preparePhoto,
  uploadDeliveryPhoto,
  MAX_PHOTOS,
} from "../../../services/deliveryPhotoService";

const TIPOS_RECEBEDOR = ["Comprador", "Familiar", "Vizinho", "Porteiro", "Outro"] as const;
const TIPOS_DOCUMENTO = ["RG", "CPF"] as const;

export interface FormEntregaConcluidaProps {
  visible: boolean;
  idSaida: number;
  destinatarioPreenchido?: string;
  onConfirm: (body: EntregueBody) => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FormEntregaConcluida({
  visible,
  idSaida,
  destinatarioPreenchido,
  onConfirm,
  onClose,
  onSuccess,
}: FormEntregaConcluidaProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, justifyContent: "flex-end" },
        backdrop: { flex: 1, backgroundColor: colors.overlay },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 24,
          paddingBottom: 32,
          maxHeight: "85%",
        },
        title: { fontSize: 18, fontWeight: "600", marginBottom: 16, color: colors.text },
        label: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          backgroundColor: colors.inputBackground,
          color: colors.text,
        },
        textArea: { minHeight: 80, textAlignVertical: "top" as const },
        opcoesRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
        chip: {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
        },
        chipActive: { backgroundColor: colors.primary },
        chipText: { fontSize: 14, color: colors.text },
        chipTextActive: { color: colors.primaryContrast, fontWeight: "600" },
        error: { color: colors.danger, fontSize: 14, marginTop: 12 },
        actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 24, gap: 12 },
        btnCancel: { paddingVertical: 10, paddingHorizontal: 20 },
        btnCancelText: { color: colors.textSecondary, fontSize: 16 },
        btnOk: {
          backgroundColor: colors.success,
          paddingVertical: 10,
          paddingHorizontal: 24,
          borderRadius: 8,
          minWidth: 120,
          alignItems: "center",
        },
        btnDisabled: { opacity: 0.7 },
        btnOkText: { color: colors.primaryContrast, fontWeight: "600", fontSize: 16 },
        photoRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
        photoWrap: { width: 72, height: 72, borderRadius: 8, overflow: "hidden", backgroundColor: colors.inputBackground },
        photoImg: { width: 72, height: 72 },
        photoRemove: { position: "absolute" as const, top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 4 },
        photoStatus: { fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: "center" as const },
        btnAddPhoto: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.inputBackground, alignSelf: "flex-start" },
        btnAddPhotoText: { fontSize: 14, color: colors.primary },
      }),
    [colors]
  );
  const [tipoRecebedor, setTipoRecebedor] = useState<string>("Comprador");
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"RG" | "CPF">("RG");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type PhotoItem = { uri: string; status: "idle" | "uploading" | "sent" | "error"; object_key?: string };
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  useEffect(() => {
    if (visible) {
      setTipoRecebedor("Comprador");
      setNomeRecebedor(destinatarioPreenchido?.trim() ?? "");
      setTipoDocumento("RG");
      setNumeroDocumento("");
      setObservacao("");
      setError(null);
      setPhotos([]);
    }
  }, [visible, destinatarioPreenchido]);

  const handleTipoDocChange = (tipo: "RG" | "CPF") => {
    setTipoDocumento(tipo);
    const raw = tipo === "CPF" ? unmaskCPF(numeroDocumento) : unmaskRG(numeroDocumento);
    setNumeroDocumento(tipo === "CPF" ? formatCPF(raw) : formatRG(raw));
  };

  const handleNumeroDocChange = (text: string) => {
    const formatted = tipoDocumento === "CPF" ? formatCPF(text) : formatRG(text);
    setNumeroDocumento(formatted);
  };

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      const picked = await selectOrTakePhoto();
      if (!picked) return;
      const prepared = await preparePhoto(picked.uri);
      setPhotos((prev) => [...prev, { uri: prepared.uri, status: "idle" }]);
    } catch (e) {
      Alert.alert("Erro", (e as Error)?.message || "Não foi possível adicionar a foto.");
    }
  };

  const uploadOnePhoto = async (item: PhotoItem, idx: number) => {
    setPhotos((prev) =>
      prev.map((p, j) => (j === idx ? { ...p, status: "uploading" as const } : p))
    );
    try {
      const objectKey = await uploadDeliveryPhoto({
        id_saida: idSaida,
        tipo: "entregue",
        uri: item.uri,
        mimeType: "image/jpeg",
        filename: "foto.jpg",
      });
      setPhotos((prev) =>
        prev.map((p, j) => (j === idx ? { ...p, status: "sent" as const, object_key: objectKey } : p))
      );
    } catch {
      setPhotos((prev) =>
        prev.map((p, j) => (j === idx ? { ...p, status: "error" as const } : p))
      );
      throw new Error("Falha no envio da foto.");
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const retryPhotoUpload = (index: number) => {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index && p.status === "error" ? { ...p, status: "idle" as const } : p))
    );
  };

  const handleConfirmar = async () => {
    setError(null);
    setSaving(true);
    try {
      const idleIndexes = photos.map((p, i) => (p.status === "idle" ? i : -1)).filter((i) => i >= 0);
      for (const idx of idleIndexes) {
        const item = photos[idx];
        if (!item || item.status !== "idle") continue;
        try {
          await uploadOnePhoto(item, idx);
        } catch (uploadErr) {
          Alert.alert("Erro ao enviar foto", (uploadErr as Error)?.message || "Falha no envio.");
          setSaving(false);
          return;
        }
      }
      const body: EntregueBody = {
        tipo_recebedor: tipoRecebedor || undefined,
        nome_recebedor: nomeRecebedor.trim() || undefined,
        tipo_documento: tipoDocumento || undefined,
        numero_documento:
          numeroDocumento.trim() ? (tipoDocumento === "CPF" ? unmaskCPF(numeroDocumento) : unmaskRG(numeroDocumento)) : undefined,
        observacao_entrega: observacao.trim() || undefined,
      };
      await onConfirm(body);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Erro ao marcar como entregue.";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const anyUploading = photos.some((p) => p.status === "uploading");
  const hasErrorPhoto = photos.some((p) => p.status === "error");
  const canAddPhoto = photos.length < MAX_PHOTOS;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.box}>
          <Text style={styles.title}>Dados do recebedor</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Tipo do recebedor</Text>
            <View style={styles.opcoesRow}>
              {TIPOS_RECEBEDOR.map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[styles.chip, tipoRecebedor === op && styles.chipActive]}
                  onPress={() => {
                    if (tipoRecebedor !== op) {
                      setTipoRecebedor(op);
                      setNomeRecebedor("");
                    }
                  }}
                >
                  <Text style={[styles.chipText, tipoRecebedor === op && styles.chipTextActive]}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Nome do recebedor</Text>
            <TextInput
              style={styles.input}
              value={nomeRecebedor}
              onChangeText={setNomeRecebedor}
              placeholder="Nome de quem recebeu"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={styles.label}>Tipo do documento</Text>
            <View style={styles.opcoesRow}>
              {TIPOS_DOCUMENTO.map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[styles.chip, tipoDocumento === op && styles.chipActive]}
                  onPress={() => handleTipoDocChange(op)}
                >
                  <Text style={[styles.chipText, tipoDocumento === op && styles.chipTextActive]}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Número do documento</Text>
            <TextInput
              style={styles.input}
              value={numeroDocumento}
              onChangeText={handleNumeroDocChange}
              placeholder={tipoDocumento === "CPF" ? "000.000.000-00" : "00.000.000-0"}
              placeholderTextColor={colors.placeholder}
              keyboardType={tipoDocumento === "CPF" ? "numeric" : "default"}
            />

            <Text style={styles.label}>Comprovante (opcional, até {MAX_PHOTOS} fotos)</Text>
            <View style={styles.photoRow}>
              {photos.map((p, idx) => (
                <View key={idx} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photoImg} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhoto(idx)}
                    disabled={saving || anyUploading}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.photoStatus} numberOfLines={1}>
                    {p.status === "idle" && "Pendente"}
                    {p.status === "uploading" && "Enviando…"}
                    {p.status === "sent" && "Enviado"}
                    {p.status === "error" && "Falhou"}
                  </Text>
                  {p.status === "error" && (
                    <TouchableOpacity onPress={() => retryPhotoUpload(idx)} disabled={saving}>
                      <Text style={{ fontSize: 10, color: colors.primary, marginTop: 2 }}>Tentar novamente</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {canAddPhoto && (
                <TouchableOpacity
                  style={styles.btnAddPhoto}
                  onPress={addPhoto}
                  disabled={saving || anyUploading}
                >
                  <Text style={styles.btnAddPhotoText}>+ Adicionar foto</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Observação (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Observação da entrega"
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={saving || anyUploading}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnOk, (saving || anyUploading) && styles.btnDisabled]}
                onPress={handleConfirmar}
                disabled={saving || anyUploading}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryContrast} size="small" />
                ) : (
                  <Text style={styles.btnOkText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
