import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useThemeColors } from "../../../theme/colors";
import { useDiaRotaConcluidaStore } from "../../../store/diaRotaConcluidaStore";
import { formatCurrencyBRL } from "../utils/currency";
import { playSound } from "../../../utils/sound";
import { navigateToHomeInicio, navigateToMinhasEntregasHoje } from "../utils/navigationHelpers";

export default function DiaRotaConcluidaModal() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const colors = useThemeColors();
  const navigation = useNavigation();
  const visible = useDiaRotaConcluidaStore((s) => s.visible);
  const stats = useDiaRotaConcluidaStore((s) => s.stats);
  const playCelebration = useDiaRotaConcluidaStore((s) => s.playCelebration);
  const close = useDiaRotaConcluidaStore((s) => s.close);
  const consumeCelebration = useDiaRotaConcluidaStore((s) => s.consumeCelebration);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: Math.max(16, insets.top),
        },
        scroll: { flexGrow: 0 },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingVertical: 18,
          alignItems: "stretch",
          maxHeight: windowHeight * 0.9,
        },
        topBlock: { alignItems: "center", marginBottom: 12 },
        emoji: { fontSize: 34, marginBottom: 6 },
        title: {
          fontSize: 19,
          fontWeight: "700",
          color: colors.text,
          textAlign: "center",
          marginBottom: 6,
        },
        subtitle: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 20,
          marginBottom: 14,
        },
        resumoBox: {
          backgroundColor: colors.chipBackground,
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
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
        resumoLabel: { fontSize: 14, color: colors.textSecondary, flex: 1, paddingRight: 8 },
        resumoValue: { fontSize: 14, fontWeight: "700", color: colors.text },
        btnPrimary: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          marginBottom: 10,
        },
        btnPrimaryText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "600" },
        btnSecondary: {
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: "transparent",
        },
        btnSecondaryText: { color: colors.text, fontSize: 16, fontWeight: "600" },
      }),
    [colors, insets.top, windowHeight]
  );

  useEffect(() => {
    if (!visible || !playCelebration) return;
    void playSound("celebration");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    consumeCelebration();
  }, [visible, playCelebration, consumeCelebration]);

  const rootNav = navigation as NavigationProp<ParamListBase>;

  const handleVerEntregas = () => {
    close();
    navigateToMinhasEntregasHoje(rootNav);
  };

  const handleVoltarInicio = () => {
    close();
    navigateToHomeInicio(rootNav);
  };

  if (!stats) return null;

  const isRoute = stats.variant === "route";
  const title = isRoute ? "🎉 Rota concluída!" : "🎉 Dia concluído!";
  const subtitle = isRoute
    ? "Todos os pedidos desta rota foram finalizados."
    : "Todos os pedidos pendentes de hoje foram finalizados.";
  const resumoTitle = isRoute ? "Resumo da rota" : "Resumo do dia";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.topBlock}>
              <Text style={styles.emoji}>🎉</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.resumoBox}>
              <Text style={styles.resumoTitle}>{resumoTitle}</Text>
              {isRoute ? (
                <>
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>Paradas</Text>
                    <Text style={styles.resumoValue}>{stats.paradas}</Text>
                  </View>
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>Pedidos</Text>
                    <Text style={styles.resumoValue}>{stats.pedidos}</Text>
                  </View>
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>Entregues</Text>
                    <Text style={styles.resumoValue}>{stats.entregues}</Text>
                  </View>
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>Ausentes</Text>
                    <Text style={styles.resumoValue}>{stats.ausentes}</Text>
                  </View>
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>{stats.valorLabel}</Text>
                    <Text style={styles.resumoValue}>
                      {formatCurrencyBRL(stats.valorRota)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
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
                    <Text style={styles.resumoLabel}>{stats.valorLabel}</Text>
                    <Text style={styles.resumoValue}>
                      {formatCurrencyBRL(stats.valorDia)}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={handleVerEntregas}>
              <Text style={styles.btnPrimaryText}>Ver entregas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleVoltarInicio}>
              <Text style={styles.btnSecondaryText}>Voltar ao início</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
