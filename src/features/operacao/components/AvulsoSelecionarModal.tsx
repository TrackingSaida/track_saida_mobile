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

function normalizeStatus(raw?: string | null): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

/** Ainda na base: sem motoboy ou status coleta/entrada. */
function isAindaNaBase(it: AvulsoPendenteItem): boolean {
  const st = normalizeStatus(it.status);
  if (st === "coletado" || st === "na_base" || st === "entrada") return true;
  if (!it.motoboy_id) return true;
  return false;
}

function labelSemCodigoDuplicado(it: AvulsoPendenteItem): string {
  const label = (it.label || "").trim();
  const codigo = (it.codigo || "").trim();
  if (label) return label;
  return codigo || "Avulso";
}

function statusAmigavel(it: AvulsoPendenteItem): string {
  return (it.status_label || it.status || "—").trim();
}

function codigoExtra(it: AvulsoPendenteItem): string | null {
  const label = (it.label || "").trim();
  const codigo = (it.codigo || "").trim();
  if (!codigo) return null;
  if (label && label.includes(codigo)) return null;
  return codigo;
}

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
  const [grupoNaBaseAberto, setGrupoNaBaseAberto] = useState(true);
  const [grupoSairamAberto, setGrupoSairamAberto] = useState(false);

  const busy = loading || buscando || selecionando;

  const { naBase, jaSairam } = useMemo(() => {
    const a: AvulsoPendenteItem[] = [];
    const b: AvulsoPendenteItem[] = [];
    for (const it of items) {
      if (isAindaNaBase(it)) a.push(it);
      else b.push(it);
    }
    return { naBase: a, jaSairam: b };
  }, [items]);

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
        groupHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 10,
          paddingHorizontal: 4,
          marginTop: 4,
        },
        groupHeaderText: { fontSize: 14, fontWeight: "800", color: colors.text },
        groupChevron: { fontSize: 12, color: colors.textSecondary, fontWeight: "700" },
        item: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
        },
        itemLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
        itemStatus: {
          marginTop: 6,
          alignSelf: "flex-start",
          fontSize: 12,
          fontWeight: "700",
          color: colors.primary,
          backgroundColor: colors.inputBackground,
          overflow: "hidden",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 8,
        },
        itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
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

  const carregar = useCallback(
    async (opts?: { q?: string; todosDoDia?: boolean }) => {
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
        setGrupoNaBaseAberto(true);
        setGrupoSairamAberto(false);
      } catch (err) {
        setErro(formatApiError(err, "Não foi possível buscar avulsos."));
        setItems([]);
        setAmbiguo(false);
        setMensagem(null);
      } finally {
        setBuscando(false);
      }
    },
    [q]
  );

  useEffect(() => {
    if (!visible) return;
    setQ("");
    setSelecionando(false);
    setErro(null);
    setItems([]);
    setAmbiguo(false);
    setMensagem("Digite para buscar os avulsos de hoje.");
    setGrupoNaBaseAberto(true);
    setGrupoSairamAberto(false);
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

  const renderItem = (it: AvulsoPendenteItem) => {
    const extraCodigo = codigoExtra(it);
    const motoboyLine = it.motoboy_nome ? `Motoboy: ${it.motoboy_nome}` : null;
    return (
      <TouchableOpacity
        key={it.id_saida}
        style={styles.item}
        onPress={() => void handleSelect(it)}
        disabled={busy}
      >
        <Text style={styles.itemLabel}>{labelSemCodigoDuplicado(it)}</Text>
        <Text style={styles.itemStatus}>{statusAmigavel(it)}</Text>
        {motoboyLine || extraCodigo ? (
          <Text style={styles.itemMeta}>
            {[motoboyLine, extraCodigo].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderGrupo = (
    titulo: string,
    lista: AvulsoPendenteItem[],
    aberto: boolean,
    onToggle: () => void
  ) => {
    if (lista.length === 0) return null;
    return (
      <View>
        <TouchableOpacity style={styles.groupHeader} onPress={onToggle} disabled={busy}>
          <Text style={styles.groupHeaderText}>
            {titulo} ({lista.length})
          </Text>
          <Text style={styles.groupChevron}>{aberto ? "▼" : "▶"}</Text>
        </TouchableOpacity>
        {aberto ? lista.map(renderItem) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Selecionar avulso</Text>
          <Text style={styles.help}>
            Busca nos avulsos de hoje. Priorize os que ainda estão na base. Se alguém compartilhou a
            etiqueta, leia o código na câmera.
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
              <>
                {renderGrupo("Ainda na base", naBase, grupoNaBaseAberto, () =>
                  setGrupoNaBaseAberto((v) => !v)
                )}
                {renderGrupo("Já saíram", jaSairam, grupoSairamAberto, () =>
                  setGrupoSairamAberto((v) => !v)
                )}
              </>
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
