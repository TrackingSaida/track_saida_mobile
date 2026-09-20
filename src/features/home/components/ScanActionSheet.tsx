import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";

export type ScanSheetAction = "insert" | "deliver" | "coleta";

type Props = {
  visible: boolean;
  showColeta: boolean;
  onClose: () => void;
  onSelect: (action: ScanSheetAction) => void;
};

export default function ScanActionSheet({ visible, showColeta, onClose, onSelect }: Props) {
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
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
        },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: space.xs,
        },
        subtitle: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          marginBottom: space.md,
        },
        action: {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        actionLast: {
          borderBottomWidth: 0,
        },
        actionTextWrap: { flex: 1, minWidth: 0 },
        actionTitle: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.text,
        },
        actionDesc: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          marginTop: 2,
        },
        cancel: {
          marginTop: space.sm,
          alignItems: "center",
          paddingVertical: space.md,
        },
        cancelText: {
          fontSize: 16,
          color: colors.textSecondary,
          fontWeight: "600",
        },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.box, { paddingBottom: Math.max(24, insets.bottom) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>O que deseja fazer?</Text>
          <Text style={styles.subtitle}>Escolha o tipo de leitura</Text>

          <TouchableOpacity
            style={styles.action}
            onPress={() => onSelect("insert")}
            accessibilityRole="button"
            accessibilityLabel="Adicionar pacotes"
          >
            <Ionicons name="cube-outline" size={22} color={colors.deliveryAccent} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Adicionar pacotes</Text>
              <Text style={styles.actionDesc}>Ler pacotes que farão parte da carga</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, showColeta ? undefined : styles.actionLast]}
            onPress={() => onSelect("deliver")}
            accessibilityRole="button"
            accessibilityLabel="Finalizar entrega"
          >
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.deliveryAccent} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Finalizar entrega</Text>
              <Text style={styles.actionDesc}>Escanear um pacote entregue</Text>
            </View>
          </TouchableOpacity>

          {showColeta ? (
            <TouchableOpacity
              style={[styles.action, styles.actionLast]}
              onPress={() => onSelect("coleta")}
              accessibilityRole="button"
              accessibilityLabel="Registrar coleta"
            >
              <Ionicons name="layers-outline" size={22} color={colors.deliveryAccent} />
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Registrar coleta</Text>
                <Text style={styles.actionDesc}>Pacotes coletados na base</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
