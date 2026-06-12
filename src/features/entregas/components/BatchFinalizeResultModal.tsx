import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { FinalizarLoteBloqueadoOut } from "../types";

export interface BatchFinalizeResultModalProps {
  visible: boolean;
  finalizadosCount: number;
  bloqueados: FinalizarLoteBloqueadoOut[];
  bottomInset: number;
  onClose: () => void;
  onVerBloqueados: () => void;
}

export default function BatchFinalizeResultModal({
  visible,
  finalizadosCount,
  bloqueados,
  bottomInset,
  onClose,
  onVerBloqueados,
}: BatchFinalizeResultModalProps) {
  const colors = useThemeColors();
  const parcial = bloqueados.length > 0 && finalizadosCount > 0;
  const todosOk = bloqueados.length === 0 && finalizadosCount > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: Math.max(24, bottomInset),
          maxHeight: "75%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        message: { fontSize: 14, color: colors.textSecondary, marginBottom: 12, lineHeight: 20 },
        listTitle: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 },
        bloqueadoItem: {
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        bloqueadoCodigo: { fontSize: 14, fontWeight: "600", color: colors.text },
        bloqueadoMotivo: { fontSize: 13, color: colors.danger, marginTop: 2 },
        btn: {
          marginTop: 16,
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.primary,
        },
        btnSecondary: {
          marginTop: 8,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.separator,
        },
        btnText: { color: colors.primaryContrast, fontWeight: "600", fontSize: 15 },
        btnSecondaryText: { color: colors.text, fontWeight: "600", fontSize: 15 },
      }),
    [colors, bottomInset]
  );

  const title = todosOk
    ? `${finalizadosCount} pedido${finalizadosCount !== 1 ? "s" : ""} finalizado${finalizadosCount !== 1 ? "s" : ""} com sucesso.`
    : parcial
      ? "Finalização parcial"
      : bloqueados.length > 0
        ? "Nenhum pedido finalizado"
        : "Resultado";

  const message = parcial
    ? `${finalizadosCount} pedido${finalizadosCount !== 1 ? "s" : ""} finalizado${finalizadosCount !== 1 ? "s" : ""}.\n${bloqueados.length} precisam ser finalizados individualmente.`
    : todosOk
      ? undefined
      : bloqueados.length > 0
        ? "Todos os pedidos selecionados precisam ser finalizados individualmente."
        : undefined;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {bloqueados.length > 0 && (
            <>
              <Text style={styles.listTitle}>Bloqueados</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {bloqueados.map((b) => (
                  <View key={b.id_saida} style={styles.bloqueadoItem}>
                    <Text style={styles.bloqueadoCodigo}>{b.codigo ?? `Pedido ${b.id_saida}`}</Text>
                    <Text style={styles.bloqueadoMotivo}>{b.motivo}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
          {bloqueados.length > 0 && (
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onVerBloqueados}>
              <Text style={styles.btnSecondaryText}>Ver bloqueados</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
