import React, { useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import SuccessLottie from "../../../components/SuccessLottie";
import { useThemeColors } from "../../../theme/colors";
import { useDiaRotaConcluidaStore } from "../../../store/diaRotaConcluidaStore";
import { playSound } from "../../../utils/sound";
import { navigateToEntregasResumo, navigateToHomeInicio } from "../utils/navigationHelpers";

export default function DiaRotaConcluidaModal() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const navigation = useNavigation();
  const visible = useDiaRotaConcluidaStore((s) => s.visible);
  const stats = useDiaRotaConcluidaStore((s) => s.stats);
  const close = useDiaRotaConcluidaStore((s) => s.close);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: Math.max(24, insets.top),
        },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          padding: 24,
          alignItems: "center",
        },
        emoji: { fontSize: 40, marginBottom: 4 },
        title: {
          fontSize: 22,
          fontWeight: "700",
          color: colors.text,
          textAlign: "center",
          marginBottom: 8,
        },
        subtitle: {
          fontSize: 15,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 22,
          marginBottom: 6,
        },
        motivational: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          fontStyle: "italic",
          marginBottom: 16,
        },
        resumoBox: {
          alignSelf: "stretch",
          backgroundColor: colors.chipBackground,
          borderRadius: 12,
          padding: 14,
          marginBottom: 20,
        },
        resumoTitle: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.text,
          marginBottom: 10,
        },
        resumoRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 4,
        },
        resumoLabel: { fontSize: 14, color: colors.textSecondary },
        resumoValue: { fontSize: 14, fontWeight: "700", color: colors.text },
        btnPrimary: {
          alignSelf: "stretch",
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          marginBottom: 10,
        },
        btnPrimaryText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "600" },
        btnSecondary: {
          alignSelf: "stretch",
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        btnSecondaryText: { color: colors.text, fontSize: 16, fontWeight: "600" },
      }),
    [colors, insets.top]
  );

  useEffect(() => {
    if (!visible) return;
    void playSound("celebration");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [visible]);

  const handleVerResumo = () => {
    close();
    navigateToEntregasResumo(navigation);
  };

  const handleVoltarInicio = () => {
    close();
    navigateToHomeInicio(navigation);
  };

  if (!stats) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎉</Text>
          <SuccessLottie visible={visible} />
          <Text style={styles.title}>Rota do dia concluída!</Text>
          <Text style={styles.subtitle}>Todos os pedidos pendentes foram finalizados.</Text>
          <Text style={styles.motivational}>Bom trabalho! Não há entregas pendentes para hoje.</Text>

          <View style={styles.resumoBox}>
            <Text style={styles.resumoTitle}>Resumo de hoje</Text>
            <View style={styles.resumoRow}>
              <Text style={styles.resumoLabel}>Entregues</Text>
              <Text style={styles.resumoValue}>{stats.entregues}</Text>
            </View>
            <View style={styles.resumoRow}>
              <Text style={styles.resumoLabel}>Ausentes</Text>
              <Text style={styles.resumoValue}>{stats.ausentes}</Text>
            </View>
            <View style={styles.resumoRow}>
              <Text style={styles.resumoLabel}>Total finalizado</Text>
              <Text style={styles.resumoValue}>{stats.total}</Text>
            </View>
            <View style={styles.resumoRow}>
              <Text style={styles.resumoLabel}>Pendentes</Text>
              <Text style={styles.resumoValue}>{stats.pendentes}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleVerResumo}>
            <Text style={styles.btnPrimaryText}>Ver resumo da rota</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleVoltarInicio}>
            <Text style={styles.btnSecondaryText}>Voltar para início</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
