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
  const [mensagem, setMensagem] = useState<string | null>("Digite para buscar os avulsos de hoje.");
  const [ambiguo, setAmbiguo] = useState(false);
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
        help: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
        row: { flexDirection: "row", gap: 8, marginBottom: 8 },
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
        linkTodos: { alignSelf: "flex-start", marginBottom: 12 },
        linkTodosText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
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
        warn: { fontSize: 13, color: "#B45309", marginBottom: 8 },
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

  const carregar = useCallback(async (opts?: { q?: string; todosDoDia?: boolean }) => {
    const buscaQ = (opts?.q ?? q).trim();
    const todosDoDia = !!opts?.todosDoDia;
    if (!buscaQ && !todosDoDia) {
      setItems([]);
      setAmbiguo(false);
      setMensagem("Digite para buscar os avulsos de hoje.");
      return;
    }
    setBuscando(true);
    setErro(null);
    try {
      const res = await listAvulsosPendentes({
        q: buscaQ || undefined,
        todos_do_dia: todosDoDia,
        limit: 50,
        offset: 0,
      });
      setAmbiguo(!!res.ambiguo);
      setMensagem(res.mensagem || null);
      setItems(res.items);
    } catch (err) {
      setErro(formatApiError(err, "Não foi possível buscar avulsos."));
      setItems([]);
      setAmbiguo(false);
      setMensagem(null);
    } finally {
      setBuscando(false);
    }
  }, [q]);

  useEffect(() => {
    if (!visible) return;
    setQ("");
    setSelecionando(false);
    setErro(null);
    setItems([]);
    setAmbiguo(false);
    setMensagem("Digite para buscar os avulsos de hoje.");
  }, [visible]);

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
          <Text style={styles.help}>
            Busca por contém nos avulsos de hoje. Se alguém compartilhou a etiqueta, leia o código na câmera.
          </Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Nome, CEP, código..."
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
          <TouchableOpacity
            style={styles.linkTodos}
            onPress={() => void carregar({ q: "", todosDoDia: true })}
            disabled={busy}
          >
            <Text style={styles.linkTodosText}>Ver todos de hoje</Text>
          </TouchableOpacity>
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          {ambiguo ? <Text style={styles.warn}>{mensagem}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
            {items.length === 0 && !buscando && !ambiguo ? (
              <Text style={styles.empty}>{mensagem || "Digite para buscar os avulsos de hoje."}</Text>
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
                    {[
                      it.status_label || it.status,
                      it.motoboy_nome ? `Motoboy: ${it.motoboy_nome}` : "Sem motoboy",
                      it.codigo,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
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
