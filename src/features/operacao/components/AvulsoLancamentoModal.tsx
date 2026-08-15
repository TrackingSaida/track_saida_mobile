import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import {
  AVULSO_IDENT_AJUDA,
  AVULSO_IDENT_MAX,
  AVULSO_QTD_MAX,
  validarLancamentoAvulso,
} from "../utils/avulsoLancamento";
import {
  preparePhoto,
  takeDeliveryPhoto,
  uploadAvulsoFotoPending,
} from "../../../services/deliveryPhotoService";
import {
  AvulsoUploadError,
  classifyThrownUploadError,
  friendlyAvulsoUploadMessage,
} from "../../../services/avulsoUploadDiagnostics";

const MAX_FOTOS_AVULSO = 3;

export type AvulsoFotoLocal = {
  id: string;
  uri: string;
};

type UploadedCacheEntry = {
  objectKey: string;
  photoId: string;
};

type Props = {
  visible: boolean;
  loading?: boolean;
  /** Quando true, exige ao menos 1 foto antes de confirmar. */
  exigeFoto: boolean;
  /** Coletas e entradas não utilizam comprovante no lançamento avulso. */
  permitirFotos?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    identificacao: string | null;
    quantidade: number;
    fotoObjectKeys: string[];
    photoIds: string[];
  }) => void | Promise<void>;
};

function alertAvulsoError(
  err: unknown,
  onRetry: () => void
): void {
  const classified =
    err instanceof AvulsoUploadError
      ? err
      : classifyThrownUploadError(err, "unknown");
  const message =
    classified.message?.trim() ||
    friendlyAvulsoUploadMessage({
      stage: classified.stage,
      code: classified.code,
      httpStatus: classified.httpStatus,
    });

  const buttons: Array<{
    text: string;
    style?: "cancel" | "destructive" | "default";
    onPress?: () => void;
  }> = [{ text: "Cancelar", style: "cancel" }];

  if (classified.retryable || classified.code === "NETWORK" || classified.code === "TIMEOUT" || classified.code === "STORAGE_TEMPORARY_ERROR" || classified.code === "API_ERROR") {
    buttons.push({
      text: "Tentar novamente",
      onPress: () => onRetry(),
    });
  } else if (classified.code !== "SESSION_EXPIRED" && classified.code !== "VALIDATION") {
    buttons.push({
      text: "Tentar novamente",
      onPress: () => onRetry(),
    });
  }

  Alert.alert("Erro", message, buttons);
}

export default function AvulsoLancamentoModal({
  visible,
  loading = false,
  exigeFoto,
  permitirFotos = true,
  onClose,
  onConfirm,
}: Props) {
  const colors = useThemeColors();
  const [identificacao, setIdentificacao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [fotos, setFotos] = useState<AvulsoFotoLocal[]>([]);
  const [capturando, setCapturando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [statusEnvio, setStatusEnvio] = useState<string | null>(null);
  const uploadedByLocalIdRef = useRef<Record<string, UploadedCacheEntry>>({});
  const submitLockRef = useRef(false);

  const busy = loading || capturando || enviando;

  useEffect(() => {
    if (!visible) return;
    setIdentificacao("");
    setQuantidade("1");
    setFotos([]);
    setCapturando(false);
    setEnviando(false);
    setStatusEnvio(null);
    uploadedByLocalIdRef.current = {};
    submitLockRef.current = false;
  }, [visible]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          padding: 20,
        },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          padding: 18,
          maxHeight: "92%",
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        title: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 },
        label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 4 },
        help: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
        input: {
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          color: colors.text,
          marginBottom: 10,
        },
        fotoSection: { marginTop: 6, marginBottom: 4 },
        fotoHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        fotoObrigatorio: { fontSize: 12, fontWeight: "700", color: "#dc3545" },
        fotoOpcional: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
        thumbsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
        thumbWrap: { width: 72, height: 72, borderRadius: 10, overflow: "hidden" },
        thumb: { width: 72, height: 72, backgroundColor: colors.inputBackground },
        thumbRemove: {
          position: "absolute",
          top: 2,
          right: 2,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "rgba(0,0,0,0.65)",
          alignItems: "center",
          justifyContent: "center",
        },
        btnTirarFoto: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: colors.primarySoft ?? "rgba(13,110,253,0.08)",
        },
        btnTirarFotoText: { fontSize: 15, fontWeight: "700", color: colors.primary },
        statusEnvio: {
          marginTop: 10,
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          textAlign: "center",
        },
        actions: {
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 16,
        },
        btnCancel: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
          backgroundColor: colors.inputBackground,
        },
        btnCancelText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
        btnOk: {
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 12,
          backgroundColor: colors.primary,
          minWidth: 120,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        btnOkText: { fontSize: 15, fontWeight: "700", color: colors.primaryContrast },
        btnDisabled: { opacity: 0.65 },
      }),
    [colors]
  );

  const handleTirarFoto = useCallback(async () => {
    if (fotos.length >= MAX_FOTOS_AVULSO) {
      Alert.alert("Atenção", `Máximo de ${MAX_FOTOS_AVULSO} fotos.`);
      return;
    }
    setCapturando(true);
    try {
      const picked = await takeDeliveryPhoto();
      if (!picked) return;
      const prepared = await preparePhoto(picked.uri, fotos.length + 1);
      setFotos((prev) => [
        ...prev,
        { id: `local-${Date.now()}-${prev.length}`, uri: prepared.uri },
      ]);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível abrir a câmera.");
    } finally {
      setCapturando(false);
    }
  }, [fotos.length]);

  const handleRemoverFoto = useCallback((id: string) => {
    setFotos((prev) => prev.filter((f) => f.id !== id));
    const next = { ...uploadedByLocalIdRef.current };
    delete next[id];
    uploadedByLocalIdRef.current = next;
  }, []);

  const handleConfirmar = useCallback(async () => {
    if (submitLockRef.current) return;

    const validacao = validarLancamentoAvulso(identificacao, quantidade);
    if (!validacao.ok) {
      Alert.alert("Atenção", validacao.message);
      return;
    }
    if (permitirFotos && exigeFoto && fotos.length === 0) {
      Alert.alert("Foto obrigatória", "Tire ao menos uma foto antes de lançar o avulso.");
      return;
    }

    submitLockRef.current = true;
    setEnviando(true);
    setStatusEnvio(fotos.length > 0 ? "Enviando foto..." : "Lançando avulso...");

    try {
      const fotoObjectKeys: string[] = [];
      const photoIds: string[] = [];

      for (let i = 0; permitirFotos && i < fotos.length; i++) {
        const local = fotos[i];
        const cached = uploadedByLocalIdRef.current[local.id];
        if (cached?.objectKey) {
          fotoObjectKeys.push(cached.objectKey);
          photoIds.push(cached.photoId);
          continue;
        }

        setStatusEnvio(
          fotos.length > 1 ? `Enviando foto ${i + 1} de ${fotos.length}...` : "Enviando foto..."
        );
        const photoId = `avulso-${local.id}`;
        const key = await uploadAvulsoFotoPending({
          uri: local.uri,
          mimeType: "image/jpeg",
          filename: `avulso_${i + 1}.jpg`,
          photoId,
        });
        uploadedByLocalIdRef.current[local.id] = { objectKey: key, photoId };
        fotoObjectKeys.push(key);
        photoIds.push(photoId);
      }

      setStatusEnvio("Concluindo lançamento...");
      await onConfirm({
        identificacao: validacao.identificacao,
        quantidade: validacao.quantidade,
        fotoObjectKeys,
        photoIds,
      });
      uploadedByLocalIdRef.current = {};
    } catch (e) {
      const classified = classifyThrownUploadError(
        e,
        e instanceof AvulsoUploadError ? e.stage : "avulso_create"
      );
      alertAvulsoError(classified, () => {
        void handleConfirmar();
      });
    } finally {
      setEnviando(false);
      setStatusEnvio(null);
      submitLockRef.current = false;
    }
  }, [identificacao, quantidade, exigeFoto, fotos, onConfirm, permitirFotos]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Lançar Avulso</Text>

            <Text style={styles.label}>Identificação (opcional)</Text>
            <Text style={styles.help}>{AVULSO_IDENT_AJUDA}</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Empresa ABC"
              placeholderTextColor={colors.placeholder}
              value={identificacao}
              onChangeText={setIdentificacao}
              maxLength={AVULSO_IDENT_MAX}
              editable={!busy}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Text style={styles.label}>Quantidade (máx. {AVULSO_QTD_MAX})</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={colors.placeholder}
              value={quantidade}
              onChangeText={setQuantidade}
              keyboardType="number-pad"
              maxLength={2}
              editable={!busy}
            />

            {permitirFotos ? <View style={styles.fotoSection}>
              <View style={styles.fotoHeader}>
                <Text style={styles.label}>Fotos</Text>
                {exigeFoto ? (
                  <Text style={styles.fotoObrigatorio}>Obrigatório</Text>
                ) : (
                  <Text style={styles.fotoOpcional}>Opcional · até {MAX_FOTOS_AVULSO}</Text>
                )}
              </View>

              {fotos.length > 0 ? (
                <View style={styles.thumbsRow}>
                  {fotos.map((f) => (
                    <View key={f.id} style={styles.thumbWrap}>
                      <Image source={{ uri: f.uri }} style={styles.thumb} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => handleRemoverFoto(f.id)}
                        disabled={busy}
                        accessibilityLabel="Remover foto"
                      >
                        <Ionicons name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              {fotos.length < MAX_FOTOS_AVULSO ? (
                <TouchableOpacity
                  style={[styles.btnTirarFoto, busy && styles.btnDisabled]}
                  onPress={() => void handleTirarFoto()}
                  disabled={busy}
                  accessibilityLabel="Tirar foto"
                >
                  {capturando ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={20} color={colors.primary} />
                      <Text style={styles.btnTirarFotoText}>
                        {fotos.length === 0 ? "Tirar foto" : "Adicionar foto"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View> : null}

            {statusEnvio ? <Text style={styles.statusEnvio}>{statusEnvio}</Text> : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={busy}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnOk, busy && styles.btnDisabled]}
                onPress={() => void handleConfirmar()}
                disabled={busy}
              >
                {enviando || loading ? (
                  <>
                    <ActivityIndicator color={colors.primaryContrast} size="small" />
                    <Text style={styles.btnOkText}>
                      {statusEnvio?.startsWith("Enviando") ? "Enviando..." : "Lançar"}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.btnOkText}>Lançar</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
