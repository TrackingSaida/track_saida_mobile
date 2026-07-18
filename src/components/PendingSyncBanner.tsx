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
  const refresh = useOutboxStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (pendingCount <= 0) return null;

  const failed = actions.filter((a) => a.state === "failed");
  const label =
    failed.length > 0
      ? `${pendingCount} envio(s) pendente(s) — ${failed.length} com erro`
      : `${pendingCount} entrega(s) aguardando envio`;

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, 8),
          backgroundColor: colors.primary + "22",
          borderBottomColor: colors.primary + "55",
        },
      ]}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      ) : null}
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={() => {
          if (failed[0]) void retryFailedOutboxAction(failed[0].actionId);
          else void processOutboxQueue();
        }}
        style={[styles.btn, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.btnText, { color: colors.primaryContrast }]}>
          {isSyncing ? "Enviando…" : "Sincronizar"}
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
  text: { flex: 1, fontSize: 13, fontWeight: "600" },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnText: { fontSize: 12, fontWeight: "700" },
});
