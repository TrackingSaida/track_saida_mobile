import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../theme/colors";
import { useOutboxStore } from "../store/outboxStore";
import {
  discardAllFailedOutboxActions,
  processOutboxQueue,
  retryAllFailedOutboxActions,
} from "../services/outbox/syncEngine";

export default function PendingSyncBanner() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const pendingCount = useOutboxStore((s) => s.pendingCount);
  const isSyncing = useOutboxStore((s) => s.isSyncing);
  const actions = useOutboxStore((s) => s.actions);
  const lastSyncError = useOutboxStore((s) => s.lastSyncError);
  const avisoCargaRemovida = useOutboxStore((s) => s.avisoCargaRemovida);
  const setAvisoCargaRemovida = useOutboxStore((s) => s.setAvisoCargaRemovida);
  const refresh = useOutboxStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!avisoCargaRemovida) return;
    const timer = setTimeout(() => setAvisoCargaRemovida(null), 8000);
    return () => clearTimeout(timer);
  }, [avisoCargaRemovida, setAvisoCargaRemovida]);

  if (pendingCount <= 0 && !avisoCargaRemovida) return null;

  if (pendingCount <= 0 && avisoCargaRemovida) {
    return (
      <View
        style={[
          styles.wrap,
          {
            paddingTop: Math.max(insets.top, 8),
            backgroundColor: colors.warning + "22",
            borderBottomColor: colors.warning + "66",
          },
        ]}
      >
        <View style={styles.textCol}>
          <Text style={[styles.text, { color: colors.text }]}>{avisoCargaRemovida}</Text>
        </View>
      </View>
    );
  }

  const failed = actions.filter((a) => a.state === "failed");
  const hasFailed = failed.length > 0;
  const errorText = lastSyncError || failed[0]?.lastError || null;
  const label = hasFailed
    ? `${failed.length} envio(s) com erro — toque em Tentar de novo`
    : isSyncing
      ? `Enviando ${pendingCount} entrega(s) ao servidor…`
      : `${pendingCount} entrega(s) aguardando confirmação no servidor`;

  const bg = hasFailed ? colors.danger + "22" : colors.warning + "22";
  const border = hasFailed ? colors.danger + "66" : colors.warning + "66";
  const btnBg = hasFailed ? colors.danger : colors.primary;

  const confirmDiscardFailed = () => {
    const count = failed.length;
    Alert.alert(
      "Descartar envio com erro?",
      count === 1
        ? "Remove este aviso do aparelho. Se a baixa já estiver no servidor, o pedido continua correto. Se ainda não gravou, você precisará baixar de novo."
        : `Remove ${count} envios com erro deste aparelho. Se a baixa já estiver no servidor, os pedidos continuam corretos. Se ainda não gravou, será preciso baixar de novo.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => {
            void discardAllFailedOutboxActions();
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, 8),
          backgroundColor: bg,
          borderBottomColor: border,
        },
      ]}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      ) : null}
      <View style={styles.textCol}>
        <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>
          {label}
        </Text>
        {hasFailed && errorText ? (
          <Text style={[styles.errorHint, { color: colors.textSecondary }]} numberOfLines={2}>
            {errorText}
          </Text>
        ) : null}
        {avisoCargaRemovida ? (
          <Text style={[styles.errorHint, { color: colors.text }]} numberOfLines={2}>
            {avisoCargaRemovida}
          </Text>
        ) : null}
      </View>
      <View style={styles.actionsCol}>
        <TouchableOpacity
          onPress={() => {
            if (hasFailed) void retryAllFailedOutboxActions();
            else void processOutboxQueue();
          }}
          disabled={isSyncing}
          style={[styles.btn, { backgroundColor: btnBg, opacity: isSyncing ? 0.7 : 1 }]}
        >
          <Text style={[styles.btnText, { color: colors.primaryContrast }]}>
            {isSyncing ? "Enviando…" : hasFailed ? "Tentar de novo" : "Sincronizar"}
          </Text>
        </TouchableOpacity>
        {hasFailed && !isSyncing ? (
          <TouchableOpacity
            onPress={confirmDiscardFailed}
            style={[styles.btnSecondary, { borderColor: colors.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Descartar envio com erro"
          >
            <Text style={[styles.btnSecondaryText, { color: colors.danger }]}>Descartar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  spinner: { marginRight: 4 },
  textCol: { flex: 1, gap: 2 },
  text: { fontSize: 13, fontWeight: "700" },
  errorHint: { fontSize: 11 },
  actionsCol: { gap: 6, alignItems: "stretch" },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  btnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnSecondaryText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
});
