import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../theme/colors";
import { useOutboxStore } from "../store/outboxStore";
import { processOutboxQueue, retryFailedOutboxAction } from "../services/outbox/syncEngine";

export default function PendingSyncBanner() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const pendingCount = useOutboxStore((s) => s.pendingCount);
  const isSyncing = useOutboxStore((s) => s.isSyncing);
  const actions = useOutboxStore((s) => s.actions);
  const lastSyncError = useOutboxStore((s) => s.lastSyncError);
  const refresh = useOutboxStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (pendingCount <= 0) return null;

  const failed = actions.filter((a) => a.state === "failed");
  const hasFailed = failed.length > 0;
  const label = hasFailed
    ? `${failed.length} envio(s) com erro — toque em Tentar de novo`
    : isSyncing
      ? `Enviando ${pendingCount} entrega(s) ao servidor…`
      : `${pendingCount} entrega(s) aguardando confirmação no servidor`;

  const bg = hasFailed ? colors.danger + "22" : colors.warning + "22";
  const border = hasFailed ? colors.danger + "66" : colors.warning + "66";
  const btnBg = hasFailed ? colors.danger : colors.primary;

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
        {hasFailed && lastSyncError ? (
          <Text style={[styles.errorHint, { color: colors.textSecondary }]} numberOfLines={1}>
            {lastSyncError}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => {
          if (failed[0]) void retryFailedOutboxAction(failed[0].actionId);
          else void processOutboxQueue();
        }}
        style={[styles.btn, { backgroundColor: btnBg }]}
      >
        <Text style={[styles.btnText, { color: colors.primaryContrast }]}>
          {isSyncing ? "Enviando…" : hasFailed ? "Tentar de novo" : "Sincronizar"}
        </Text>
      </TouchableOpacity>
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
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnText: { fontSize: 12, fontWeight: "700" },
});
