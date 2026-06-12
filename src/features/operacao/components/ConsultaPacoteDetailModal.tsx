import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";
import { fetchComprovanteImageDataUri } from "../../entregas/api";
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
  const [comprovanteUri, setComprovanteUri] = useState<string | null>(null);
  const [comprovanteLoading, setComprovanteLoading] = useState(false);
  const [showComprovanteViewer, setShowComprovanteViewer] = useState(false);

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
      setComprovanteUri(null);
      setComprovanteLoading(false);
      setShowComprovanteViewer(false);
      return;
    }
    if (!precisaComprovante || idSaida == null) {
      setComprovanteUri(null);
      setComprovanteLoading(false);
      return;
    }

    let cancelled = false;
    setComprovanteLoading(true);
    setComprovanteUri(null);

    void (async () => {
      try {
        const uri = await fetchComprovanteImageDataUri(idSaida);
        if (!cancelled && uri) {
          setComprovanteUri(uri);
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

  const handleVerComprovante = useCallback(() => {
    if (comprovanteUri) setShowComprovanteViewer(true);
  }, [comprovanteUri]);

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
                  comprovanteUri={comprovanteUri}
                  comprovanteLoading={comprovanteLoading}
                  onVerComprovante={comprovanteUri ? handleVerComprovante : undefined}
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
            </Text>
          </View>
          {comprovanteUri ? (
            <Image source={{ uri: comprovanteUri }} style={{ flex: 1, resizeMode: "contain" }} />
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
