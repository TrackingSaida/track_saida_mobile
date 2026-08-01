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
  const [todos, setTodos] = useState(false);
  const [urgente, setUrgente] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setMotoboys(await listMotoboysOperacao());
      } catch {
        setMotoboys([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: { padding: space.md, paddingBottom: 40 },
        label: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginTop: 14, marginBottom: 6 },
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
        chip: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          marginRight: 8,
          marginBottom: 8,
          backgroundColor: colors.backgroundCard,
        },
        chipOn: { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
        chipText: { color: colors.text, fontWeight: "600" },
        chips: { flexDirection: "row", flexWrap: "wrap" },
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
            <Text style={{ color: colors.text, fontWeight: "700" }}>Todos os motoboys ativos</Text>
            <Switch value={todos} onValueChange={setTodos} />
          </View>

          {!todos ? (
            <>
              <Text style={styles.label}>Motoboys</Text>
              <View style={styles.chips}>
                {motoboys.map((m) => {
                  const on = selected.has(m.id_motoboy);
                  return (
                    <TouchableOpacity
                      key={m.id_motoboy}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggle(m.id_motoboy)}
                    >
                      <Text style={styles.chipText}>{m.nome || `Motoboy ${m.id_motoboy}`}</Text>
                    </TouchableOpacity>
                  );
                })}
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
