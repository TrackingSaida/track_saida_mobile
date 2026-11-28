import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { getEntrega } from "../api";
import type { MarcacaoEntregaResponse, MotivoAusencia } from "../types";
import { getMotivosAusenciaCached } from "../utils/motivosAusenciaCache";
import { enqueueAusenteCompletion } from "../../../services/outbox/deliveryOutboxService";
import {
  createClientActionId,
  trackTelemetry,
} from "../../../services/telemetry/telemetryClient";
import {
  takeDeliveryPhoto,
  pickAndPrepareDeliveryPhoto,
  MAX_PHOTOS,
} from "../../../services/deliveryPhotoService";
import { createPhotoAttemptId } from "../../../services/photoFlowUtils";
import { trackBaixaFotoStage } from "../../../services/telemetry/photoPipelineTelemetry";
import {
  clearDeliveryPhotoDraft,
  loadDeliveryPhotoDraftRecord,
  saveDeliveryPhotoDraft,
} from "../../../services/deliveryPhotoDraft";
import { canConfirmWithPhotos } from "../utils/photoValidationUtils";
import { unionCamposObrigatorios } from "../utils/camposObrigatoriosUtils";

const CAMPO_LABEL: Record<string, string> = {
  foto: "Foto",
  observacao: "Observação",
};

type PhotoItem = { uri: string };

export interface FormAusenteModalProps {
  visible: boolean;
  idSaidas: number[];
  requiredFields?: string[];
  codigo?: string;
  batchCount?: number;
  stopLabel?: string;
  onConfirm?: (data: {
    motivoId: number;
    observacao?: string;
    photoUris: string[];
  }) => Promise<void>;
  /** Chamado após enfileirar/concluir (sem nova chamada API). */
  onSuccess?: (result?: {
    queued?: boolean;
    marcacao?: MarcacaoEntregaResponse;
  }) => void | Promise<void>;
  /** Quando batchCount > 1, resolve ids finais antes do enqueue. */
  resolveBatchTargets?: () => Promise<number[]>;
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
  onSuccess,
  resolveBatchTargets,
  onClose,
}: FormAusenteModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [motivos, setMotivos] = useState<MotivoAusencia[]>([]);
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [motivoId, setMotivoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftMotivoRef = useRef<number | null>(null);
  const loadedIdSaidaRef = useRef<number | null>(null);
  const clientActionIdRef = useRef<string | null>(null);
  const formOpenedAtRef = useRef<number>(0);
  const primaryIdSaida = idSaidas.find((id) => id > 0) ?? 0;
  const formSessionKey = visible ? `open:${primaryIdSaida}` : "closed";
  const [activeFormSession, setActiveFormSession] = useState(formSessionKey);
  if (activeFormSession !== formSessionKey) {
    setActiveFormSession(formSessionKey);
    loadedIdSaidaRef.current = null;
    clientActionIdRef.current = null;
    formOpenedAtRef.current = 0;
    setPhotos([]);
    setObservacao("");
    setMotivoId(null);
    setDraftReady(false);
    setSaving(false);
    setLoadingMotivos(false);
    draftMotivoRef.current = null;
  }
  const [resolvedRequiredFields, setResolvedRequiredFields] = useState<string[]>(
    () => unionCamposObrigatorios(requiredFields)
  );
  const [requiredFieldsReady, setRequiredFieldsReady] = useState(false);

  const uploadTargets = useMemo(() => {
    const ids = (idSaidas || []).filter((id) => id > 0);
    return [...new Set(ids)];
  }, [idSaidas]);
  const uploadTargetsKey = uploadTargets.join(",");
  const requiredFieldsKey = unionCamposObrigatorios(requiredFields).join("|");

  useEffect(() => {
    if (!visible) {
      setRequiredFieldsReady(false);
      return;
    }
    const fromProp = unionCamposObrigatorios(requiredFields);
    setResolvedRequiredFields(fromProp);
    // Não bloquear confirmação aguardando getEntrega (sem regra = lista vazia válida).
    setRequiredFieldsReady(true);
    let cancelled = false;
    void (async () => {
      if (uploadTargets.length === 0) return;
      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
        Promise.race([
          p,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
        ]);
      const fetched = await Promise.all(
        uploadTargets.map((id) =>
          withTimeout(getEntrega(id).catch(() => null), 8000)
        )
      );
      if (cancelled) return;
      const fromApi = unionCamposObrigatorios(
        ...fetched.map((d) => d?.campos_obrigatorios_ausente)
      );
      if (fromApi.length === 0) return;
      setResolvedRequiredFields(unionCamposObrigatorios(fromProp, fromApi));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys estáveis
  }, [visible, requiredFieldsKey, uploadTargetsKey]);

  const required = useMemo(
    () => new Set(resolvedRequiredFields.map((f) => String(f || "").trim().toLowerCase())),
    [resolvedRequiredFields]
  );
  const fotoObrigatoria = required.has("foto");

  useEffect(() => {
    if (!visible) {
      setDraftReady(false);
      loadedIdSaidaRef.current = null;
      clientActionIdRef.current = null;
      formOpenedAtRef.current = 0;
      return;
    }
    const clientActionId = createClientActionId();
    clientActionIdRef.current = clientActionId;
    formOpenedAtRef.current = Date.now();
    void trackTelemetry({
      event_name: "baixa_form_aberto",
      client_action_id: clientActionId,
      id_saida: primaryIdSaida || null,
      props: { kind: "ausente" },
    });
    setObservacao("");
    setMotivoId(null);
    setPhotos([]);
    setDraftReady(false);
    loadedIdSaidaRef.current = null;
    draftMotivoRef.current = null;
    let cancelled = false;
    void (async () => {
      const draft = await loadDeliveryPhotoDraftRecord("ausente", primaryIdSaida);
      if (cancelled) return;
      setPhotos((draft?.photoUris || []).map((uri) => ({ uri })));
      const fields = draft?.kind === "ausente" ? draft.fields : undefined;
      setObservacao(fields?.observacao || "");
      draftMotivoRef.current = fields?.motivoId ?? null;
      if (fields?.motivoId) setMotivoId(fields.motivoId);
      loadedIdSaidaRef.current = primaryIdSaida;
      setDraftReady(true);
    })();
    setLoadingMotivos(true);
    getMotivosAusenciaCached()
      .then((m) => {
        if (cancelled) return;
        setMotivos(m);
        if (draftMotivoRef.current) {
          setMotivoId(draftMotivoRef.current);
        } else if (m.length) {
          setMotivoId(m[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setMotivos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMotivos(false);
      });
    return () => {
      cancelled = true;
      loadedIdSaidaRef.current = null;
    };
  }, [visible, primaryIdSaida]);

  useEffect(() => {
    if (!visible || !draftReady || primaryIdSaida <= 0) return;
    if (loadedIdSaidaRef.current !== primaryIdSaida) return;
    void saveDeliveryPhotoDraft(
      "ausente",
      primaryIdSaida,
      photos.map((p) => p.uri),
      { motivoId, observacao }
    );
  }, [visible, draftReady, primaryIdSaida, photos, motivoId, observacao]);

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
        emptyMotivos: {
          fontSize: 14,
          color: colors.textSecondary,
          marginBottom: 12,
          lineHeight: 20,
        },
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

  const addPhotoFromCamera = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS || addingPhoto || saving) return;
    const attemptId = createPhotoAttemptId();
    setAddingPhoto(true);
    try {
      await saveDeliveryPhotoDraft(
        "ausente",
        primaryIdSaida,
        photos.map((p) => p.uri),
        { motivoId, observacao }
      );
      const result = await takeDeliveryPhoto({
        kind: "ausente",
        idSaida: primaryIdSaida,
        clientActionId: clientActionIdRef.current,
        attemptId,
      });
      if (!result.ok) {
        if (result.reason !== "cancel") {
          Alert.alert("Foto", result.message || "Não foi possível adicionar a foto.");
        }
        return;
      }
      const next = [...photos, { uri: result.photo.uri }];
      setPhotos(next);
      void trackBaixaFotoStage({
        stage: "form_attached",
        attempt_id: attemptId,
        source: "camera",
        kind: "ausente",
        id_saida: primaryIdSaida || null,
        client_action_id: clientActionIdRef.current,
      });
      void trackTelemetry({
        event_name: "baixa_foto_capturada",
        client_action_id: clientActionIdRef.current,
        id_saida: primaryIdSaida || null,
        props: { kind: "ausente", photo_count: next.length },
      });
      await saveDeliveryPhotoDraft(
        "ausente",
        primaryIdSaida,
        next.map((p) => p.uri),
        { motivoId, observacao }
      );
    } catch (e) {
      Alert.alert("Erro", (e as Error)?.message || "Não foi possível adicionar a foto.");
    } finally {
      setAddingPhoto(false);
    }
  }, [photos, primaryIdSaida, motivoId, observacao, addingPhoto, saving]);

  const addPhotoFromGallery = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS || addingPhoto || saving) return;
    const attemptId = createPhotoAttemptId();
    setAddingPhoto(true);
    try {
      await saveDeliveryPhotoDraft(
        "ausente",
        primaryIdSaida,
        photos.map((p) => p.uri),
        { motivoId, observacao }
      );
      const result = await pickAndPrepareDeliveryPhoto({
        indexHint: photos.length,
        kind: "ausente",
        idSaida: primaryIdSaida,
        clientActionId: clientActionIdRef.current,
        attemptId,
      });
      if (!result.ok) {
        if (result.reason !== "cancel") {
          Alert.alert("Foto", result.message || "Não foi possível adicionar a foto.");
        }
        return;
      }
      const next = [...photos, { uri: result.photo.uri }];
      setPhotos(next);
      void trackBaixaFotoStage({
        stage: "form_attached",
        attempt_id: attemptId,
        source: "gallery",
        kind: "ausente",
        id_saida: primaryIdSaida || null,
        client_action_id: clientActionIdRef.current,
      });
      void trackTelemetry({
        event_name: "baixa_foto_capturada",
        client_action_id: clientActionIdRef.current,
        id_saida: primaryIdSaida || null,
        props: { kind: "ausente", photo_count: next.length },
      });
      await saveDeliveryPhotoDraft(
        "ausente",
        primaryIdSaida,
        next.map((p) => p.uri),
        { motivoId, observacao }
      );
    } catch (e) {
      Alert.alert("Erro", (e as Error)?.message || "Não foi possível adicionar a foto.");
    } finally {
      setAddingPhoto(false);
    }
  }, [photos, primaryIdSaida, motivoId, observacao, addingPhoto, saving]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirmar = useCallback(async () => {
    if (!requiredFieldsReady) {
      Alert.alert("Atenção", "Carregando regras do pedido. Aguarde um instante.");
      return;
    }
    if (loadingMotivos) {
      Alert.alert("Atenção", "Carregando motivos. Aguarde um instante.");
      return;
    }
    if (motivos.length === 0) {
      Alert.alert(
        "Atenção",
        "Motivos indisponíveis. Conecte-se uma vez para sincronizar a lista."
      );
      return;
    }
    if (motivoId == null) {
      Alert.alert("Atenção", "Selecione um motivo.");
      return;
    }
    const motivo = motivos.find((m) => m.id === motivoId);
    if (motivo?.descricao.trim().toLowerCase() === "outro" && !observacao.trim()) {
      Alert.alert("Atenção", "Informe a observação quando o motivo for 'Outro'.");
      return;
    }
    const photoCheck = canConfirmWithPhotos(photos, fotoObrigatoria);
    if (!photoCheck.ok) {
      Alert.alert("Atenção", photoCheck.reason || "Adicione pelo menos uma foto.");
      return;
    }
    const missing: string[] = [];
    if (required.has("observacao") && !observacao.trim()) missing.push(CAMPO_LABEL.observacao);
    if (missing.length) {
      Alert.alert(
        "Atenção",
        `Preencha os campos obrigatórios para concluir este pedido: ${missing.join(", ")}.`
      );
      return;
    }

    const clientActionId = clientActionIdRef.current || createClientActionId();
    clientActionIdRef.current = clientActionId;
    void trackTelemetry({
      event_name: "baixa_confirm_tap",
      client_action_id: clientActionId,
      id_saida: primaryIdSaida || null,
      duration_ms: formOpenedAtRef.current
        ? Math.max(0, Date.now() - formOpenedAtRef.current)
        : null,
      props: { kind: "ausente", photo_count: photos.length },
    });

    setSaving(true);
    try {
      let targets = idSaidas.filter((id) => id > 0);
      if (batchCount > 1 && resolveBatchTargets) {
        targets = await resolveBatchTargets();
      }
      const photoUris = photos.map((p) => p.uri);
      const result = await enqueueAusenteCompletion({
        idSaidas: targets,
        motivoId,
        observacao: observacao.trim() || undefined,
        photoUris,
        fotoObrigatoria,
        clientActionId,
      });
      await clearDeliveryPhotoDraft("ausente", primaryIdSaida);
      try {
        if (onSuccess) {
          await onSuccess({ queued: result.queued, marcacao: result.marcacao });
        } else if (onConfirm && !result.queued) {
          await onConfirm({
            motivoId,
            observacao: observacao.trim() || undefined,
            photoUris,
          });
        }
      } catch (uiErr) {
        console.warn("[FormAusenteModal] pós-sucesso falhou após marcar local", uiErr);
        onClose();
      }
    } catch (e) {
      Alert.alert("Erro", (e as Error)?.message || "Não foi possível concluir a ausência.");
    } finally {
      setSaving(false);
    }
  }, [
    requiredFieldsReady,
    loadingMotivos,
    motivoId,
    motivos,
    observacao,
    fotoObrigatoria,
    photos,
    idSaidas,
    batchCount,
    resolveBatchTargets,
    onSuccess,
    onConfirm,
    onClose,
    primaryIdSaida,
    required,
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
            {loadingMotivos ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : motivos.length === 0 ? (
              <Text style={styles.emptyMotivos}>
                Motivos indisponíveis. Conecte-se uma vez para sincronizar a lista.
              </Text>
            ) : (
              motivos.map((m) => (
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
              ))
            )}
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
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <>
                  <TouchableOpacity
                    style={styles.btnAddPhoto}
                    onPress={() => void addPhotoFromCamera()}
                    disabled={saving || addingPhoto}
                  >
                    <Text style={styles.btnAddPhotoText}>+ Tirar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnAddPhoto}
                    onPress={() => void addPhotoFromGallery()}
                    disabled={saving || addingPhoto}
                  >
                    <Text style={styles.btnAddPhotoText}>Galeria</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {addingPhoto ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Processando foto…</Text>
              </View>
            ) : null}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={saving}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnOk}
                onPress={handleConfirmar}
                disabled={
                  saving ||
                  !requiredFieldsReady ||
                  loadingMotivos ||
                  motivos.length === 0
                }
              >
                {saving || !requiredFieldsReady || loadingMotivos ? (
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
