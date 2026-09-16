import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { formatApiError } from "../../../utils/formatApiError";
import {
  listAvulsosPendentes,
  type AvulsoPendenteItem,
} from "../saidasApi";

type Props = {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSelect: (item: AvulsoPendenteItem) => void | Promise<void>;
};

export default function AvulsoSelecionarModal({
  visible,
  loading = false,
  onClose,
  onSelect,
}: Props) {
  const colors = useThemeColors();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AvulsoPendenteItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionando, setSelecionando] = useState(false);

  const busy = loading || buscando || selecionando;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          padding: 20,
        },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          padding: 18,
          maxHeight: "88%",
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        title: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 6 },
        help: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
        row: { flexDirection: "row", gap: 8, marginBottom: 12 },
        input: {
          flex: 1,
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: colors.text,
        },
        btnBuscar: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingHorizontal: 14,
          justifyContent: "center",
        },
        btnBuscarText: { color: colors.primaryContrast, fontWeight: "700" },
        item: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
        },
        itemLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
        itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        empty: { fontSize: 13, color: colors.textSecondary, paddingVertical: 16, textAlign: "center" },
        erro: { fontSize: 13, color: "#dc3545", marginBottom: 8 },
        btnCancel: {
          marginTop: 8,
          paddingVertical: 12,
          alignItems: "center",
          borderRadius: 12,
          backgroundColor: colors.inputBackground,
        },
        btnCancelText: { fontWeight: "600", color: colors.textSecondary },
      }),
    [colors]
  );

  const carregar = useCallback(async (busca?: string) => {
    setBuscando(true);
    setErro(null);
    try {
      const res = await listAvulsosPendentes({
        q: (busca ?? q).trim() || undefined,
        limit: 30,
        offset: 0,
      });
      setItems(res.items);
    } catch (err) {
      setErro(formatApiError(err, "Não foi possível buscar avulsos pendentes."));
      setItems([]);
    } finally {
      setBuscando(false);
    }
  }, [q]);

  useEffect(() => {
    if (!visible) return;
    setQ("");
    setSelecionando(false);
    void carregar("");
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    async (item: AvulsoPendenteItem) => {
      if (busy) return;
      setSelecionando(true);
      try {
        await onSelect(item);
      } finally {
        setSelecionando(false);
      }
    },
    [busy, onSelect]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Selecionar avulso</Text>
          <Text style={styles.help}>Busque pelo código interno ou pelos dados cadastrados.</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Código, pedido, destinatário..."
              placeholderTextColor={colors.placeholder}
              value={q}
              onChangeText={setQ}
              editable={!busy}
              autoCorrect={false}
              onSubmitEditing={() => void carregar()}
            />
            <TouchableOpacity
              style={styles.btnBuscar}
              onPress={() => void carregar()}
              disabled={busy}
            >
              {buscando ? (
                <ActivityIndicator color={colors.primaryContrast} size="small" />
              ) : (
                <Text style={styles.btnBuscarText}>Buscar</Text>
              )}
            </TouchableOpacity>
          </View>
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
            {items.length === 0 && !buscando ? (
              <Text style={styles.empty}>Nenhum avulso pendente encontrado.</Text>
            ) : (
              items.map((it) => (
                <TouchableOpacity
                  key={it.id_saida}
                  style={styles.item}
                  onPress={() => void handleSelect(it)}
                  disabled={busy}
                >
                  <Text style={styles.itemLabel}>{it.label || it.codigo || "Avulso"}</Text>
                  <Text style={styles.itemMeta}>
                    {[it.status, it.codigo].filter(Boolean).join(" · ")}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={busy}>
            <Text style={styles.btnCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
