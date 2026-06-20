import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../../theme/colors";
import type { EntregaHistoricoItem, EntregaListItem } from "../../types";
import EntregaHistoricoTimeline from "./EntregaHistoricoTimeline";

type Props = {
  visible: boolean;
  entrega: EntregaListItem | null;
  historico: EntregaHistoricoItem[];
  comprovanteUris?: string[];
  comprovanteLoading?: boolean;
  onVerComprovante?: (index: number) => void;
  onClose: () => void;
};

export default function EntregaTimelineSheet({
  visible,
  entrega,
  historico,
  comprovanteUris,
  comprovanteLoading,
  onVerComprovante,
  onClose,
}: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

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
          paddingTop: 16,
          paddingBottom: Math.max(24, insets.bottom + 12),
          maxHeight: "85%",
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text },
        closeText: { fontSize: 16, color: colors.textSecondary, fontWeight: "600" },
        subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
        scroll: { maxHeight: "100%" },
      }),
    [colors, insets.bottom]
  );

  if (!entrega) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Linha do tempo</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
          {entrega.codigo ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {entrega.codigo}
            </Text>
          ) : null}
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <EntregaHistoricoTimeline
              historico={historico}
              entrega={entrega}
              comprovanteUris={comprovanteUris}
              comprovanteLoading={comprovanteLoading}
              onVerComprovante={(index) => {
                onClose();
                onVerComprovante?.(index);
              }}
            />
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
