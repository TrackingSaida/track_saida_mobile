import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useThemeColors } from "../theme/colors";
import {
  discardPhotoResumeItem,
  getLatestPhotoResumeItem,
} from "../services/deliveryPhotoDraft";
import { navigateToPhotoDraftResume } from "../services/navigatePhotoDraftResume";
import type { PhotoResumeItem } from "../services/photoFlowUtils";
import { rootNavigationRef } from "../navigation/rootNavigation";

export default function PhotoDraftResumeGate() {
  const colors = useThemeColors();
  const [item, setItem] = useState<PhotoResumeItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const latest = await getLatestPhotoResumeItem();
        if (!cancelled && latest) setItem(latest);
      })();
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!item) return null;

  const handleContinue = () => {
    const current = item;
    setItem(null);
    if (!rootNavigationRef.isReady()) {
      setTimeout(() => navigateToPhotoDraftResume(current), 400);
      return;
    }
    navigateToPhotoDraftResume(current);
  };

  const handleDiscard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await discardPhotoResumeItem(item);
      setItem(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleContinue}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnGhost} onPress={() => void handleDiscard()} disabled={busy}>
              <Text style={[styles.btnGhostText, { color: colors.textSecondary }]}>Descartar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnOk, { backgroundColor: colors.primary }]}
              onPress={handleContinue}
              disabled={busy}
            >
              <Text style={[styles.btnOkText, { color: colors.primaryContrast }]}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  btnGhost: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  btnGhostText: { fontSize: 16, fontWeight: "600" },
  btnOk: {
    minHeight: 44,
    minWidth: 120,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  btnOkText: { fontSize: 16, fontWeight: "700" },
});
