import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import type { StaffStackParamList } from "../../../navigation/staffStackTypes";
import { listMotoboysOperacao, type MotoboyItem } from "../../operacao/saidasApi";
import { criarAviso } from "../api";

type Props = NativeStackScreenProps<StaffStackParamList, "EnviarAviso">;

export default function EnviarAvisoScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [motoboys, setMotoboys] = useState<MotoboyItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [todos, setTodos] = useState(true);
  const [urgente, setUrgente] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listMotoboysOperacao();
        setMotoboys(
          [...rows].sort((a, b) =>
            String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
              sensitivity: "base",
            })
          )
        );
      } catch {
        setMotoboys([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onTodosChange = useCallback((value: boolean) => {
    setTodos(value);
    // Ao desmarcar "todos", lista começa com toggles desligados (habilitar manualmente)
    if (!value) setSelected(new Set());
  }, []);

  const toggle = useCallback((id: number, enabled: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: { padding: space.md, paddingBottom: 40 },
        label: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.textSecondary,
          marginTop: 14,
          marginBottom: 6,
        },
        hint: {
          fontSize: 12,
          color: colors.textSecondary,
          marginBottom: 8,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          backgroundColor: colors.backgroundCard,
          color: colors.text,
          fontSize: 15,
        },
        area: { minHeight: 100, textAlignVertical: "top" },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 14,
          paddingVertical: 8,
        },
        list: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          backgroundColor: colors.backgroundCard,
          overflow: "hidden",
        },
        motoboyRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        motoboyRowFirst: { borderTopWidth: 0 },
        motoboyName: { flex: 1, paddingRight: 12, color: colors.text, fontWeight: "600" },
        empty: {
          paddingVertical: 16,
          textAlign: "center",
          color: colors.textSecondary,
          fontSize: 13,
        },
        warn: { marginTop: 8, color: "#B91C1C", fontSize: 13, fontWeight: "600" },
        btn: {
          marginTop: 24,
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
        },
        btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
      }),
    [colors]
  );

  const onSend = async () => {
    const t = titulo.trim();
    const m = mensagem.trim();
    if (!t || !m) {
      Alert.alert("Atenção", "Preencha título e mensagem.");
      return;
    }
    if (!todos && selected.size === 0) {
      Alert.alert("Atenção", "Selecione ao menos um motoboy ou marque todos.");
      return;
    }
    setSending(true);
    try {
      const res = await criarAviso({
        titulo: t,
        mensagem: m,
        prioridade: urgente ? "urgente" : "normal",
        todos_ativos: todos,
        motoboy_ids: todos ? undefined : Array.from(selected),
      });
      Alert.alert("Enviado", `Aviso enviado para ${res.destinatarios_count} motoboy(s).`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Não foi possível enviar o aviso.";
      Alert.alert("Erro", String(msg));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Enviar aviso" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Título</Text>
          <TextInput
            style={styles.input}
            value={titulo}
            onChangeText={setTitulo}
            maxLength={120}
            placeholder="Ex.: Atenção à base"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.label}>Mensagem</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={mensagem}
            onChangeText={setMensagem}
            maxLength={500}
            multiline
            placeholder="Escreva o aviso..."
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.row}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Urgente</Text>
            <Switch value={urgente} onValueChange={setUrgente} />
          </View>
          {urgente ? (
            <Text style={styles.warn}>O motoboy será obrigado a abrir este aviso no app.</Text>
          ) : null}

          <View style={styles.row}>
            <Text style={{ color: colors.text, fontWeight: "700", flex: 1, paddingRight: 12 }}>
              Todos os motoboys ativos
            </Text>
            <Switch value={todos} onValueChange={onTodosChange} />
          </View>

          {!todos ? (
            <>
              <Text style={styles.label}>Motoboys</Text>
              <Text style={styles.hint}>Ative o interruptor de cada motoboy que deve receber o aviso.</Text>
              <View style={styles.list}>
                {motoboys.length === 0 ? (
                  <Text style={styles.empty}>Nenhum motoboy ativo encontrado.</Text>
                ) : (
                  motoboys.map((m, idx) => {
                    const on = selected.has(m.id_motoboy);
                    return (
                      <View
                        key={m.id_motoboy}
                        style={[styles.motoboyRow, idx === 0 && styles.motoboyRowFirst]}
                      >
                        <Text style={styles.motoboyName} numberOfLines={2}>
                          {m.nome || `Motoboy ${m.id_motoboy}`}
                        </Text>
                        <Switch
                          value={on}
                          onValueChange={(enabled) => toggle(m.id_motoboy, enabled)}
                        />
                      </View>
                    );
                  })
                )}
              </View>
            </>
          ) : null}

          <TouchableOpacity style={styles.btn} onPress={() => void onSend()} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enviar</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
