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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";
import type { EntregueBody } from "../api";
import type { MarcacaoEntregaResponse } from "../types";
import { formatCPF, formatRG, unmaskCPF, unmaskRG } from "../utils/formatDocument";
import { enqueueEntregueCompletion } from "../../../services/outbox/deliveryOutboxService";
import {
  takeDeliveryPhoto,
  pickDeliveryPhotoFromGallery,
  preparePhoto,
  MAX_PHOTOS,
} from "../../../services/deliveryPhotoService";
import {
  clearDeliveryPhotoDraft,
  loadDeliveryPhotoDraft,
  saveDeliveryPhotoDraft,
} from "../../../services/deliveryPhotoDraft";
import {
  canConfirmWithPhotos,
} from "../utils/photoValidationUtils";

const TIPOS_RECEBEDOR = ["Comprador", "Familiar", "Vizinho", "Porteiro", "Outro"] as const;
const TIPOS_DOCUMENTO = ["RG", "CPF"] as const;

const CAMPO_LABEL: Record<string, string> = {
  foto: "Comprovante (foto)",
  recebedor: "Nome do recebedor",
  tipo_recebedor: "Tipo do recebedor",
  documento: "Número do documento",
  observacao: "Observação",
};

type CampoKey = "foto" | "recebedor" | "tipo_recebedor" | "documento" | "observacao";

function labelCampo(key: CampoKey): string {
  return CAMPO_LABEL[key] || key;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface FormEntregaConcluidaProps {
  visible: boolean;
  idSaida: number;
  destinatarioPreenchido?: string;
  requiredFields?: string[];
  /** Código do pacote sendo finalizado (ex.: BR257683187244F). */
  codigo?: string;
  /** Quando > 1, exibe banner de lote na mesma parada. */
  batchCount?: number;
  /** Ex.: "Parada 7 de 19". */
  stopLabel?: string;
  onConfirm?: (body: EntregueBody) => Promise<MarcacaoEntregaResponse | void>;
  onClose: () => void;
  /** IDs adicionais no lote (rota) — fotos propagadas a todos. */
  extraIdSaidas?: number[];
  onSuccess: (result?: { marcacao?: MarcacaoEntregaResponse; queued?: boolean }) => void | Promise<void>;
}

export default function FormEntregaConcluida({
  visible,
  idSaida,
  destinatarioPreenchido,
  requiredFields = [],
  codigo,
  batchCount = 1,
  stopLabel,
  onConfirm,
  onClose,
  onSuccess,
  extraIdSaidas = [],
}: FormEntregaConcluidaProps) {
  const insets = useSafeAreaInsets();
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
          maxHeight: "85%",
        },
        boxHeader: { paddingHorizontal: 24, paddingTop: 24 },
        scroll: { flexGrow: 0, flexShrink: 1 },
        scrollContent: { paddingHorizontal: 24, paddingBottom: 12 },
        footer: {
          paddingHorizontal: 24,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          backgroundColor: colors.backgroundCard,
        },
        title: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: colors.text },
        packageBanner: {
          backgroundColor: hexToRgba(colors.primary, 0.08),
          borderWidth: 1,
          borderColor: hexToRgba(colors.primary, 0.2),
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
        },
        packageCodigo: { fontSize: 16, fontWeight: "800", color: colors.primary, marginBottom: 4 },
        packageMeta: { fontSize: 13, color: colors.textSecondary },
        requiredBanner: {
          backgroundColor: hexToRgba(colors.primary, 0.08),
          borderWidth: 1,
          borderColor: hexToRgba(colors.primary, 0.25),
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
        },
        requiredBannerTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 4 },
        requiredBannerText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
        labelRow: { flexDirection: "row" as const, alignItems: "center" as const, flexWrap: "wrap" as const, gap: 6, marginTop: 12, marginBottom: 6 },
        label: { fontSize: 14, fontWeight: "600", color: colors.text },
        labelOptional: { fontSize: 12, color: colors.textSecondary, fontWeight: "400" },
        requiredBadge: {
          backgroundColor: hexToRgba(colors.danger, 0.12),
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 6,
        },
        requiredBadgeText: { fontSize: 11, fontWeight: "700", color: colors.danger },
        fieldHint: { fontSize: 12, color: colors.danger, marginTop: 4 },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          backgroundColor: colors.inputBackground,
          color: colors.text,
        },
        inputError: { borderColor: colors.danger, borderWidth: 2 },
        sectionError: { borderWidth: 2, borderColor: colors.danger, borderRadius: 10, padding: 8 },
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
        errorBox: {
          backgroundColor: hexToRgba(colors.danger, 0.08),
          borderWidth: 1,
          borderColor: hexToRgba(colors.danger, 0.35),
          borderRadius: 10,
          padding: 12,
          marginTop: 12,
        },
        error: { color: colors.danger, fontSize: 14, fontWeight: "600" },
        errorList: { color: colors.danger, fontSize: 13, marginTop: 6, lineHeight: 18 },
        actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
        btnCancel: { minHeight: 44, justifyContent: "center", paddingHorizontal: 20 },
        btnCancelText: { color: colors.textSecondary, fontSize: 16 },
        btnOk: {
          backgroundColor: colors.success,
          paddingHorizontal: 24,
          borderRadius: 8,
          minWidth: 120,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
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
  const [missingKeys, setMissingKeys] = useState<Set<CampoKey>>(new Set());
  const required = useMemo(
    () => new Set((requiredFields || []).map((f) => String(f || "").trim().toLowerCase())),
    [requiredFields]
  );
  const requiredLabels = useMemo(
    () =>
      (requiredFields || [])
        .map((f) => labelCampo(String(f || "").trim().toLowerCase() as CampoKey))
        .filter(Boolean),
    [requiredFields]
  );
  const hasRequiredRules = required.size > 0;

  const clearMissing = (key: CampoKey) => {
    setMissingKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  type PhotoItem = { uri: string };
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDraftReady(false);
      return;
    }
    setTipoRecebedor("Comprador");
    setNomeRecebedor(destinatarioPreenchido?.trim() ?? "");
    setTipoDocumento("RG");
    setNumeroDocumento("");
    setObservacao("");
    setError(null);
    setMissingKeys(new Set());
    setDraftReady(false);
    let cancelled = false;
    void (async () => {
      const uris = await loadDeliveryPhotoDraft("entregue", idSaida);
      if (cancelled) return;
      setPhotos(uris.map((uri) => ({ uri })));
      setDraftReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, destinatarioPreenchido, idSaida]);

  useEffect(() => {
    if (!visible || !draftReady) return;
    void saveDeliveryPhotoDraft(
      "entregue",
      idSaida,
      photos.map((p) => p.uri)
    );
  }, [visible, draftReady, idSaida, photos]);

  const fotoObrigatoria = required.has("foto");

  useEffect(() => {
    if (photos.length > 0) clearMissing("foto");
  }, [photos.length]);

  const renderLabel = (text: string, fieldKey: CampoKey, opts?: { optionalHint?: string }) => {
    const isRequired = required.has(fieldKey);
    return (
      <View style={styles.labelRow}>
        <Text style={styles.label}>{text}</Text>
        {isRequired ? (
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredBadgeText}>Obrigatório</Text>
          </View>
        ) : hasRequiredRules ? (
          <Text style={styles.labelOptional}>{opts?.optionalHint ?? "(opcional)"}</Text>
        ) : null}
      </View>
    );
  };

  const handleTipoDocChange = (tipo: "RG" | "CPF") => {
    setTipoDocumento(tipo);
    const raw = tipo === "CPF" ? unmaskCPF(numeroDocumento) : unmaskRG(numeroDocumento);
    setNumeroDocumento(tipo === "CPF" ? formatCPF(raw) : formatRG(raw));
  };

  const handleNumeroDocChange = (text: string) => {
    const formatted = tipoDocumento === "CPF" ? formatCPF(text) : formatRG(text);
    setNumeroDocumento(formatted);
  };

  const addPhotoFromSource = async (pick: () => Promise<{ uri: string } | null>) => {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      // Persiste rascunho antes de abrir a câmera (Android pode matar o processo).
      await saveDeliveryPhotoDraft(
        "entregue",
        idSaida,
        photos.map((p) => p.uri)
      );
      const picked = await pick();
      if (!picked) return;
      const prepared = await preparePhoto(picked.uri, photos.length);
      setPhotos((prev) => [...prev, { uri: prepared.uri }]);
    } catch (e) {
      Alert.alert("Erro", (e as Error)?.message || "Não foi possível adicionar a foto.");
    }
  };

  const addPhotoFromCamera = () => addPhotoFromSource(takeDeliveryPhoto);
  const addPhotoFromGallery = () => addPhotoFromSource(pickDeliveryPhotoFromGallery);

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadTargets = useMemo(() => {
    const ids = [idSaida, ...extraIdSaidas].filter((id) => id > 0);
    return [...new Set(ids)];
  }, [idSaida, extraIdSaidas]);

  const handleConfirmar = async () => {
    setError(null);
    const missingSet = new Set<CampoKey>();
    if (required.has("recebedor") && !nomeRecebedor.trim()) missingSet.add("recebedor");
    if (required.has("tipo_recebedor") && !tipoRecebedor.trim()) missingSet.add("tipo_recebedor");
    if (required.has("documento") && !numeroDocumento.trim()) missingSet.add("documento");
    if (required.has("observacao") && !observacao.trim()) missingSet.add("observacao");
    const photoCheck = canConfirmWithPhotos(photos, fotoObrigatoria);
    if (!photoCheck.ok) {
      missingSet.add("foto");
      setMissingKeys(missingSet);
      setError(photoCheck.reason || "Adicione pelo menos uma foto de comprovante.");
      return;
    }
    if (missingSet.size) {
      setMissingKeys(missingSet);
      const labels = Array.from(missingSet).map((k) => labelCampo(k));
      setError("Preencha os campos obrigatórios destacados abaixo.");
      return;
    }
    setMissingKeys(new Set());
    setSaving(true);
    try {
      const body: EntregueBody = {
        tipo_recebedor: tipoRecebedor || undefined,
        nome_recebedor: nomeRecebedor.trim() || undefined,
        tipo_documento: tipoDocumento || undefined,
        numero_documento:
          numeroDocumento.trim() ? (tipoDocumento === "CPF" ? unmaskCPF(numeroDocumento) : unmaskRG(numeroDocumento)) : undefined,
        observacao_entrega: observacao.trim() || undefined,
      };
      const photoUris = photos.map((p) => p.uri);
      const result = await enqueueEntregueCompletion({
        idSaidas: uploadTargets,
        body,
        photoUris,
        fotoObrigatoria,
      });
      let marcacao = result.marcacao;
      if (!marcacao && onConfirm && !result.queued) {
        marcacao = (await onConfirm(body)) ?? undefined;
      }
      await clearDeliveryPhotoDraft("entregue", idSaida);
      // onSuccess fecha o modal no pai; não desmontar Modal aqui antes (quebra sheet da próxima parada no Android).
      await onSuccess({ marcacao, queued: result.queued });
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string | { message?: string; campos_faltantes?: string[] } } } })
              .response?.data?.detail
          : null;
      if (detail && typeof detail === "object") {
        const code = (detail as { code?: string }).code;
        if (code === "STATUS_FINALIZADO") {
          setError(
            typeof detail.message === "string"
              ? detail.message
              : "Pedido já está finalizado."
          );
        } else {
          const faltantes = (detail.campos_faltantes || [])
            .map((f) => String(f || "").trim().toLowerCase() as CampoKey)
            .filter((f) => f in CAMPO_LABEL);
          if (faltantes.length) setMissingKeys(new Set(faltantes));
          setError(
            typeof detail.message === "string"
              ? detail.message
              : "Preencha os campos obrigatórios destacados abaixo."
          );
        }
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Erro ao marcar como entregue.");
      }
    } finally {
      setSaving(false);
    }
  };

  const canAddPhoto = photos.length < MAX_PHOTOS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.box}>
          <View style={styles.boxHeader}>
            <Text style={styles.title}>Dados do recebedor</Text>
            {codigo ? (
              <View style={styles.packageBanner}>
                <Text style={styles.packageCodigo}>Pacote: {codigo}</Text>
                {stopLabel ? <Text style={styles.packageMeta}>{stopLabel}</Text> : null}
                {batchCount > 1 ? (
                  <Text style={styles.packageMeta}>
                    Aplicará a {batchCount} pacotes desta parada
                  </Text>
                ) : null}
              </View>
            ) : null}
            {hasRequiredRules ? (
              <View style={styles.requiredBanner}>
                <Text style={styles.requiredBannerTitle}>Campos obrigatórios neste pedido</Text>
                <Text style={styles.requiredBannerText}>{requiredLabels.join(" • ")}</Text>
              </View>
            ) : null}
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderLabel("Tipo do recebedor", "tipo_recebedor")}
            <View style={[styles.opcoesRow, missingKeys.has("tipo_recebedor") && styles.sectionError]}>
              {TIPOS_RECEBEDOR.map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[styles.chip, tipoRecebedor === op && styles.chipActive]}
                  onPress={() => {
                    if (tipoRecebedor !== op) {
                      setTipoRecebedor(op);
                      setNomeRecebedor("");
                    }
                    clearMissing("tipo_recebedor");
                  }}
                >
                  <Text style={[styles.chipText, tipoRecebedor === op && styles.chipTextActive]}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {missingKeys.has("tipo_recebedor") ? (
              <Text style={styles.fieldHint}>Selecione o tipo do recebedor.</Text>
            ) : null}

            {renderLabel("Nome do recebedor", "recebedor")}
            <TextInput
              style={[styles.input, missingKeys.has("recebedor") && styles.inputError]}
              value={nomeRecebedor}
              onChangeText={(v) => {
                setNomeRecebedor(v);
                clearMissing("recebedor");
              }}
              placeholder="Nome de quem recebeu"
              placeholderTextColor={colors.placeholder}
            />
            {missingKeys.has("recebedor") ? (
              <Text style={styles.fieldHint}>Informe o nome de quem recebeu o pedido.</Text>
            ) : null}

            <View style={styles.labelRow}>
              <Text style={styles.label}>Tipo do documento</Text>
              {!required.has("documento") && hasRequiredRules ? (
                <Text style={styles.labelOptional}>(opcional)</Text>
              ) : null}
            </View>
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

            {renderLabel("Número do documento", "documento")}
            <TextInput
              style={[styles.input, missingKeys.has("documento") && styles.inputError]}
              value={numeroDocumento}
              onChangeText={(text) => {
                handleNumeroDocChange(text);
                clearMissing("documento");
              }}
              placeholder={tipoDocumento === "CPF" ? "000.000.000-00" : "00.000.000-0"}
              placeholderTextColor={colors.placeholder}
              keyboardType={tipoDocumento === "CPF" ? "numeric" : "default"}
            />
            {missingKeys.has("documento") ? (
              <Text style={styles.fieldHint}>Informe o número do documento.</Text>
            ) : null}

            {renderLabel(
              fotoObrigatoria
                ? "Comprovante (1 obrigatória, até 3 opcionais)"
                : `Comprovante (até ${MAX_PHOTOS} fotos)`,
              "foto"
            )}
            <View style={[styles.photoRow, missingKeys.has("foto") && styles.sectionError]}>
              {photos.map((p, idx) => (
                <View key={idx} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photoImg} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhoto(idx)}
                    disabled={saving}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {canAddPhoto && (
                <>
                  <TouchableOpacity
                    style={styles.btnAddPhoto}
                    onPress={addPhotoFromCamera}
                    disabled={saving}
                  >
                    <Text style={styles.btnAddPhotoText}>+ Tirar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnAddPhoto}
                    onPress={addPhotoFromGallery}
                    disabled={saving}
                  >
                    <Text style={styles.btnAddPhotoText}>Galeria</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {missingKeys.has("foto") ? (
              <Text style={styles.fieldHint}>Adicione pelo menos uma foto de comprovante.</Text>
            ) : null}

            {renderLabel("Observação", "observacao")}
            <TextInput
              style={[styles.input, styles.textArea, missingKeys.has("observacao") && styles.inputError]}
              value={observacao}
              onChangeText={(v) => {
                setObservacao(v);
                clearMissing("observacao");
              }}
              placeholder="Observação da entrega"
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
            />
            {missingKeys.has("observacao") ? (
              <Text style={styles.fieldHint}>Informe a observação da entrega.</Text>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.error}>{error}</Text>
                {missingKeys.size > 0 ? (
                  <Text style={styles.errorList}>
                    {Array.from(missingKeys)
                      .map((k) => `• ${labelCampo(k)}`)
                      .join("\n")}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={saving}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnOk, saving && styles.btnDisabled]}
                onPress={handleConfirmar}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryContrast} size="small" />
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
