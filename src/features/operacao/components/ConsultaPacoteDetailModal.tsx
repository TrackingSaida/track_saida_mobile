import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";
import { fetchComprovanteImagesDataUris } from "../../entregas/api";
import type { SaidaDetail, SaidaHistoricoItem } from "../saidasApi";
import { coresBadgeServico, statusVisualSaida } from "../utils/operacaoStatusUtils";
import {
  findLastHistoricoIndexByKeys,
  isEventoAusencia,
  isEventoEntrega,
} from "../utils/operacaoHistoricoUtils";
import ConsultaPacoteHistoricoTimeline from "./ConsultaPacoteHistoricoTimeline";

type Props = {
  visible: boolean;
  loading: boolean;
  detail: SaidaDetail | null;
  historico: SaidaHistoricoItem[];
  idSaida: number | null;
  podeGerarEtiqueta: boolean;
  podeCancelarSaida: boolean;
  gerandoEtiqueta: boolean;
  cancelandoSaida: boolean;
  onClose: () => void;
  onGerarEtiqueta: () => void;
  onCancelarSaida: () => void;
};

export default function ConsultaPacoteDetailModal({
  visible,
  loading,
  detail,
  historico,
  idSaida,
  podeGerarEtiqueta,
  podeCancelarSaida,
  gerandoEtiqueta,
  cancelandoSaida,
  onClose,
  onGerarEtiqueta,
  onCancelarSaida,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [comprovanteUris, setComprovanteUris] = useState<string[]>([]);
  const [comprovanteLoading, setComprovanteLoading] = useState(false);
  const [showComprovanteViewer, setShowComprovanteViewer] = useState(false);
  const [comprovanteViewerIndex, setComprovanteViewerIndex] = useState(0);
  const comprovanteViewerRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();

  const detalheCancelado = String(detail?.status ?? "")
    .toLowerCase()
    .includes("cancelad");

  const precisaComprovante = useMemo(() => {
    if (!visible || loading || historico.length === 0) return false;
    const entregaIdx = findLastHistoricoIndexByKeys(historico, isEventoEntrega);
    const ausenciaIdx = findLastHistoricoIndexByKeys(historico, isEventoAusencia);
    return entregaIdx >= 0 || ausenciaIdx >= 0;
  }, [visible, loading, historico]);

  useEffect(() => {
    if (!visible) {
      setComprovanteUris([]);
      setComprovanteLoading(false);
      setShowComprovanteViewer(false);
      return;
    }
    if (!precisaComprovante || idSaida == null) {
      setComprovanteUris([]);
      setComprovanteLoading(false);
      return;
    }

    let cancelled = false;
    setComprovanteLoading(true);
    setComprovanteUris([]);

    void (async () => {
      try {
        const uris = await fetchComprovanteImagesDataUris(idSaida);
        if (!cancelled && uris.length > 0) {
          setComprovanteUris(uris);
        }
      } catch {
        // Sem comprovante — não exibir placeholder.
      } finally {
        if (!cancelled) setComprovanteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, precisaComprovante, idSaida]);

  const handleVerComprovante = useCallback((index: number) => {
    if (comprovanteUris.length > 0) {
      setComprovanteViewerIndex(index);
      setShowComprovanteViewer(true);
    }
  }, [comprovanteUris.length]);

  useEffect(() => {
    if (!showComprovanteViewer || comprovanteUris.length === 0) return;
    requestAnimationFrame(() => {
      comprovanteViewerRef.current?.scrollTo({
        x: comprovanteViewerIndex * windowWidth,
        animated: false,
      });
    });
  }, [showComprovanteViewer, comprovanteViewerIndex, comprovanteUris.length, windowWidth]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: 20,
        },
        card: {
          maxHeight: "88%",
          borderRadius: 16,
          padding: 18,
          backgroundColor: colors.backgroundCard,
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text },
        statusBadge: {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          marginTop: 8,
          marginBottom: 4,
        },
        fieldLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
        fieldValue: { fontSize: 17, fontWeight: "600", color: colors.text },
        servicoBadge: {
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
        },
        servicoText: { fontSize: 15, fontWeight: "700" },
        sectionLabel: {
          fontSize: 14,
          fontWeight: "600",
          color: colors.text,
          marginTop: 20,
          marginBottom: 8,
        },
        actionBtn: {
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
        },
        actionPrimary: { backgroundColor: colors.primary, marginTop: 8 },
        actionDangerOutline: {
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: "#dc3545",
        },
        actionText: { color: colors.primaryContrast, fontSize: 14, fontWeight: "700" },
        closeBtn: { alignSelf: "flex-end", marginTop: 12, padding: 10 },
        closeText: { color: colors.primary, fontWeight: "700", fontSize: 16 },
        viewerHeader: {
          paddingTop: Math.max(14, insets.top),
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: "rgba(0,0,0,0.3)",
        },
        viewerClose: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
        viewerTitle: { color: "#fff", fontSize: 14 },
      }),
    [colors, insets.top]
  );

  const statusVisual = statusVisualSaida(detail?.status);
  const servicoVisual = coresBadgeServico(detail?.servico);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>{detail?.codigo || "Detalhe"}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusVisual.bg }]}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: statusVisual.fg }}>
                    {statusVisual.label}
                  </Text>
                </View>

                <View style={{ marginBottom: 14, marginTop: 4 }}>
                  <Text style={styles.fieldLabel}>Entregador</Text>
                  <Text style={styles.fieldValue}>{detail?.entregador || "—"}</Text>
                </View>

                <View style={{ marginBottom: 8 }}>
                  <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Serviço</Text>
                  <View style={[styles.servicoBadge, { backgroundColor: servicoVisual.bg }]}>
                    <Text style={[styles.servicoText, { color: servicoVisual.fg }]}>
                      {detail?.servico || "—"}
                    </Text>
                  </View>
                </View>

                <ConsultaPacoteHistoricoTimeline
                  historico={historico}
                  detail={detail}
                  comprovanteUris={comprovanteUris}
                  comprovanteLoading={comprovanteLoading}
                  onVerComprovante={comprovanteUris.length ? handleVerComprovante : undefined}
                />

                {podeGerarEtiqueta ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionPrimary]}
                    onPress={onGerarEtiqueta}
                    disabled={gerandoEtiqueta || cancelandoSaida}
                  >
                    {gerandoEtiqueta ? (
                      <ActivityIndicator color={colors.primaryContrast} />
                    ) : (
                      <Text style={styles.actionText}>Gerar etiqueta</Text>
                    )}
                  </TouchableOpacity>
                ) : null}

                {podeCancelarSaida && !detalheCancelado ? (
                  <>
                    <Text style={styles.sectionLabel}>Mais ações</Text>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionDangerOutline]}
                      onPress={onCancelarSaida}
                      disabled={cancelandoSaida || gerandoEtiqueta}
                    >
                      {cancelandoSaida ? (
                        <ActivityIndicator color="#dc3545" />
                      ) : (
                        <Text style={[styles.actionText, { color: "#dc3545" }]}>Cancelar pacote</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showComprovanteViewer}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setShowComprovanteViewer(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity onPress={() => setShowComprovanteViewer(false)}>
              <Text style={styles.viewerClose}>Fechar</Text>
            </TouchableOpacity>
            <Text style={styles.viewerTitle}>
              Comprovante{detail?.codigo ? ` · ${detail.codigo}` : ""}
              {comprovanteUris.length > 1
                ? ` (${comprovanteViewerIndex + 1}/${comprovanteUris.length})`
                : ""}
            </Text>
          </View>
          {comprovanteUris.length > 0 ? (
            <ScrollView
              ref={comprovanteViewerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
                if (nextIndex >= 0 && nextIndex < comprovanteUris.length) {
                  setComprovanteViewerIndex(nextIndex);
                }
              }}
            >
              {comprovanteUris.map((uri, index) => (
                <View key={`${index}-${uri.slice(0, 24)}`} style={{ width: windowWidth, flex: 1 }}>
                  <Image source={{ uri }} style={{ width: windowWidth, flex: 1, resizeMode: "contain" }} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}
