import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";
import { getMotivosAusencia } from "../api";
import type { MotivoAusencia } from "../types";
import {
  selectOrTakePhoto,
  preparePhoto,
  uploadDeliveryPhoto,
  MAX_PHOTOS,
} from "../../../services/deliveryPhotoService";

const CAMPO_LABEL: Record<string, string> = {
  foto: "Foto",
  observacao: "Observação",
};

type PhotoItem = { uri: string; status: "idle" | "uploading" | "sent" | "error" };

export async function uploadAusentePhotosForDeliveryIds(
  photoUris: string[],
  idSaidas: number[]
): Promise<void> {
  for (const idSaida of idSaidas) {
    for (const uri of photoUris) {
      await uploadDeliveryPhoto({
        id_saida: idSaida,
        tipo: "ausente",
        uri,
        mimeType: "image/jpeg",
        filename: "foto.jpg",
        validarCamposObrigatorios: false,
        alterarStatus: false,
      });
    }
  }
}

export interface FormAusenteModalProps {
  visible: boolean;
  idSaidas: number[];
  requiredFields?: string[];
  codigo?: string;
  batchCount?: number;
  stopLabel?: string;
  onConfirm: (data: {
    motivoId: number;
    observacao?: string;
    photoUris: string[];
  }) => Promise<void>;
  onClose: () => void;
}

export default function FormAusenteModal({
  visible,
  idSaidas,
  requiredFields = [],
  codigo,
  batchCount = 1,
  stopLabel,
  onConfirm,
  onClose,
}: FormAusenteModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [motivos, setMotivos] = useState<MotivoAusencia[]>([]);
  const [motivoId, setMotivoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [saving, setSaving] = useState(false);

  const required = useMemo(
    () => new Set(requiredFields.map((f) => String(f || "").trim().toLowerCase())),
    [requiredFields]
  );
  const fotoObrigatoria = required.has("foto");

  useEffect(() => {
    if (!visible) return;
    setPhotos([]);
    setObservacao("");
    setMotivoId(null);
    getMotivosAusencia()
      .then((m) => {
        setMotivos(m);
        if (m.length) setMotivoId(m[0].id);
      })
      .catch(() => setMotivos([]));
  }, [visible]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: "88%",
        },
        scroll: { flexGrow: 0, flexShrink: 1 },
        scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 },
        footer: {
          paddingHorizontal: 24,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          backgroundColor: colors.backgroundCard,
        },
        title: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: colors.text },
        subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
        batchBanner: {
          backgroundColor: colors.primary + "18",
          borderRadius: 8,
          padding: 10,
          marginBottom: 12,
        },
        batchBannerText: { fontSize: 13, color: colors.text, fontWeight: "600" },
        radio: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          marginBottom: 8,
          backgroundColor: colors.inputBackground,
        },
        radioActive: { backgroundColor: colors.primary },
        radioText: { fontSize: 16, color: colors.text },
        radioTextActive: { color: colors.primaryContrast },
        label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 8 },
        labelRequired: { color: colors.danger },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 8,
          padding: 12,
          marginTop: 8,
          minHeight: 80,
          color: colors.text,
        },
        photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
        photoWrap: {
          width: 64,
          height: 64,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: colors.inputBackground,
        },
        photoImg: { width: 64, height: 64 },
        photoRemove: {
          position: "absolute",
          top: 2,
          right: 2,
          backgroundColor: "rgba(0,0,0,0.6)",
          borderRadius: 10,
          padding: 2,
        },
        photoStatus: { fontSize: 9, color: colors.textSecondary, marginTop: 2 },
        btnAddPhoto: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          alignSelf: "flex-start",
        },
        btnAddPhotoText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
        actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
        btnCancel: { minHeight: 44, justifyContent: "center", paddingHorizontal: 20 },
        btnCancelText: { color: colors.textSecondary },
        btnOk: {
          backgroundColor: colors.primary,
          paddingHorizontal: 20,
          borderRadius: 8,
          minWidth: 100,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        },
        btnOkText: { color: colors.primaryContrast, fontWeight: "600" },
      }),
    [colors]
  );

  const addPhoto = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      const picked = await selectOrTakePhoto();
      if (!picked) return;
      const prepared = await preparePhoto(picked.uri);
      setPhotos((prev) => [...prev, { uri: prepared.uri, status: "idle" }]);
    } catch (e) {
      Alert.alert("Erro", (e as Error)?.message || "Não foi possível adicionar a foto.");
    }
  }, [photos.length]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadPhotosToIds = useCallback(async (uris: string[], targets: number[]) => {
    if (uris.length === 0 || targets.length === 0) return;
    setPhotos((prev) =>
      prev.map((p) => (p.status === "idle" ? { ...p, status: "uploading" as const } : p))
    );
    try {
      await uploadAusentePhotosForDeliveryIds(uris, targets);
      setPhotos((prev) => prev.map((p) => ({ ...p, status: "sent" as const })));
    } catch (uploadErr) {
      setPhotos((prev) =>
        prev.map((p) => (p.status === "uploading" ? { ...p, status: "error" as const } : p))
      );
      throw uploadErr;
    }
  }, []);

  const handleConfirmar = useCallback(async () => {
    if (motivoId == null) {
      Alert.alert("Atenção", "Selecione um motivo.");
      return;
    }
    const motivo = motivos.find((m) => m.id === motivoId);
    if (motivo?.descricao.trim().toLowerCase() === "outro" && !observacao.trim()) {
      Alert.alert("Atenção", "Informe a observação quando o motivo for 'Outro'.");
      return;
    }
    const missing: string[] = [];
    if (fotoObrigatoria && photos.length === 0) missing.push(CAMPO_LABEL.foto);
    if (required.has("observacao") && !observacao.trim()) missing.push(CAMPO_LABEL.observacao);
    if (missing.length) {
      Alert.alert(
        "Atenção",
        `Preencha os campos obrigatórios para concluir este pedido: ${missing.join(", ")}.`
      );
      return;
    }

    const photoUris = photos.map((p) => p.uri);
    const uploadTargets = idSaidas.filter((id) => id > 0);

    setSaving(true);
    try {
      if (photoUris.length > 0 && uploadTargets.length > 0) {
        await uploadPhotosToIds(photoUris, uploadTargets);
      }
      await onConfirm({
        motivoId,
        observacao: observacao.trim() || undefined,
        photoUris,
      });
    } catch (e) {
      Alert.alert("Erro", (e as Error)?.message || "Não foi possível concluir a ausência.");
      throw e;
    } finally {
      setSaving(false);
    }
  }, [
    motivoId,
    motivos,
    observacao,
    fotoObrigatoria,
    photos,
    required,
    idSaidas,
    uploadPhotosToIds,
    onConfirm,
  ]);

  const motivoOutro =
    motivoId !== null &&
    motivos.find((m) => m.id === motivoId)?.descricao.trim().toLowerCase() === "outro";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Motivo da ausência</Text>
            {(codigo || stopLabel) && (
              <Text style={styles.subtitle}>
                {[stopLabel, codigo ? `Pacote ${codigo}` : null].filter(Boolean).join(" · ")}
              </Text>
            )}
            {batchCount > 1 && (
              <View style={styles.batchBanner}>
                <Text style={styles.batchBannerText}>
                  {batchCount} pacote{batchCount !== 1 ? "s" : ""} nesta parada
                </Text>
              </View>
            )}
            {motivos.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.radio, motivoId === m.id && styles.radioActive]}
                onPress={() => setMotivoId(m.id)}
                disabled={saving}
              >
                <Text style={[styles.radioText, motivoId === m.id && styles.radioTextActive]}>
                  {m.descricao}
                </Text>
              </TouchableOpacity>
            ))}
            {motivoOutro && (
              <TextInput
                style={styles.input}
                placeholder="Observação (obrigatório)"
                placeholderTextColor={colors.placeholder}
                value={observacao}
                onChangeText={setObservacao}
                multiline
                editable={!saving}
              />
            )}
            {required.has("observacao") && !motivoOutro && (
              <TextInput
                style={styles.input}
                placeholder="Observação (obrigatório)"
                placeholderTextColor={colors.placeholder}
                value={observacao}
                onChangeText={setObservacao}
                multiline
                editable={!saving}
              />
            )}
            <Text style={[styles.label, fotoObrigatoria && styles.labelRequired]}>
              Comprovante {fotoObrigatoria ? "(obrigatório)" : `(opcional, até ${MAX_PHOTOS} fotos)`}
            </Text>
            <View style={styles.photoRow}>
              {photos.map((p, idx) => (
                <View key={idx}>
                  <View style={styles.photoWrap}>
                    <Image source={{ uri: p.uri }} style={styles.photoImg} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removePhoto(idx)}
                      disabled={saving}
                    >
                      <Text style={{ color: "#fff", fontSize: 10 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.photoStatus} numberOfLines={1}>
                    {p.status === "idle" && "Pendente"}
                    {p.status === "uploading" && "Enviando…"}
                    {p.status === "sent" && "Enviado"}
                    {p.status === "error" && "Falhou"}
                  </Text>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.btnAddPhoto} onPress={addPhoto} disabled={saving}>
                  <Text style={styles.btnAddPhotoText}>+ Foto</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={saving}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnOk} onPress={handleConfirmar} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.btnOkText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
