import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useAuthStore } from "../../../store/authStore";
import { useThemeColors } from "../../../theme/colors";
import { decodeJwtPayload } from "../../../utils/jwt";
import { formatApiError } from "../../../utils/formatApiError";
import { effectivePodeLancarColetaManual, effectivePodeRealizarColeta } from "../../../utils/role";
import { listarBasesAtivas, type BaseItem } from "../basesApi";
import {
  editarColetaManualOperacional,
  lancarColetaManualOperacional,
  listarMinhasColetas,
  obterConfigColetaOperacional,
  type ColetaExecucaoOperacional,
  type ColetaParticipanteOperacional,
} from "../coletasApi";

function hojeLocal(): string {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function numero(value: string): number {
  const n = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export default function MinhasColetasScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const token = useAuthStore((s) => s.token);
  const claims = token ? decodeJwtPayload(token) : {};
  const podeRealizar = effectivePodeRealizarColeta(claims);
  const podeManualToken = effectivePodeLancarColetaManual(claims);
  const [permiteManual, setPermiteManual] = useState(podeManualToken);
  const [bases, setBases] = useState<BaseItem[]>([]);
  const [coletas, setColetas] = useState<ColetaExecucaoOperacional[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [base, setBase] = useState<BaseItem | null>(null);
  const [shopee, setShopee] = useState("0");
  const [mercadoLivre, setMercadoLivre] = useState("0");
  const [avulso, setAvulso] = useState("0");
  const [semVolume, setSemVolume] = useState(false);
  const [editando, setEditando] = useState<ColetaParticipanteOperacional | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, gap: 14, paddingBottom: 36 },
        card: { backgroundColor: colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 15 },
        title: { color: colors.text, fontSize: 17, fontWeight: "800" },
        muted: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
        select: { marginTop: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, borderRadius: 10, padding: 13, flexDirection: "row", justifyContent: "space-between" },
        selectText: { color: base ? colors.text : colors.placeholder, fontWeight: "600" },
        fields: { flexDirection: "row", gap: 8, marginTop: 10 },
        fieldWrap: { flex: 1 },
        label: { color: colors.textSecondary, fontSize: 12, marginBottom: 5, fontWeight: "700" },
        input: { borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 11, textAlign: "center", fontSize: 16 },
        switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
        button: { marginTop: 14, borderRadius: 10, paddingVertical: 13, alignItems: "center", backgroundColor: colors.primary },
        buttonText: { color: colors.primaryContrast, fontWeight: "800" },
        disabled: { opacity: 0.55 },
        execHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
        total: { color: colors.primary, fontSize: 19, fontWeight: "900" },
        chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
        chip: { color: colors.text, backgroundColor: colors.chipBackground, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontSize: 12, fontWeight: "700" },
        edit: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.separator, paddingTop: 11, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 5 },
        editText: { color: colors.primary, fontWeight: "800" },
        empty: { alignItems: "center", paddingVertical: 34 },
        modal: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
        modalHeader: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        baseRow: { marginHorizontal: 16, marginVertical: 5, padding: 15, borderRadius: 10, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border },
        baseText: { color: colors.text, fontWeight: "700" },
      }),
    [base, colors]
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [config, basesAtivas, lista] = await Promise.all([
        obterConfigColetaOperacional(),
        listarBasesAtivas(),
        listarMinhasColetas(hojeLocal()),
      ]);
      setPermiteManual(config.permite_manual && podeRealizar);
      setBases(basesAtivas);
      setColetas(lista);
    } catch (error) {
      Alert.alert("Não foi possível carregar", formatApiError(error, "Tente novamente."));
    } finally {
      setLoading(false);
    }
  }, [podeRealizar]);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  const limpar = () => {
    setBase(null);
    setShopee("0");
    setMercadoLivre("0");
    setAvulso("0");
    setSemVolume(false);
    setEditando(null);
  };

  const iniciarEdicao = (execucao: ColetaExecucaoOperacional, item: ColetaParticipanteOperacional) => {
    setBase(bases.find((b) => b.id_base === execucao.base_id) || { id_base: execucao.base_id, base: execucao.base });
    setShopee(String(item.shopee));
    setMercadoLivre(String(item.mercado_livre));
    setAvulso(String(item.avulso));
    setSemVolume(item.sem_volume);
    setEditando(item);
  };

  const salvar = async () => {
    if (!base) return Alert.alert("Base obrigatória", "Selecione a base coletada.");
    const valores = semVolume
      ? { shopee: 0, mercado_livre: 0, avulso: 0 }
      : { shopee: numero(shopee), mercado_livre: numero(mercadoLivre), avulso: numero(avulso) };
    if (!semVolume && valores.shopee + valores.mercado_livre + valores.avulso === 0) {
      return Alert.alert("Informe as quantidades", "Ou marque a opção Sem volume.");
    }
    setSalvando(true);
    try {
      if (editando) {
        await editarColetaManualOperacional(editando.id_participante, {
          ...valores,
          sem_volume: semVolume,
          versao: editando.versao,
          origem_cliente: "mobile",
        });
      } else {
        await lancarColetaManualOperacional({
          base_id: base.id_base,
          data_operacao: hojeLocal(),
          ...valores,
          sem_volume: semVolume,
          origem_cliente: "mobile",
          client_request_id: `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        });
      }
      limpar();
      await carregar();
      Alert.alert("Coleta salva", "As quantidades do dia foram atualizadas.");
    } catch (error) {
      Alert.alert("Não foi possível salvar", formatApiError(error, "Confira os dados e tente novamente."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeaderBar title="Minhas coletas" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={carregar} />}
      >
        {!podeRealizar ? (
          <View style={styles.card}><Text style={styles.title}>Coleta indisponível</Text><Text style={styles.muted}>Peça ao administrador para habilitar sua permissão de coleta.</Text></View>
        ) : null}

        {permiteManual ? (
          <View style={styles.card}>
            <Text style={styles.title}>{editando ? "Editar lançamento de hoje" : "Lançar coleta de hoje"}</Text>
            <Pressable style={styles.select} onPress={() => !editando && setSeletorAberto(true)} disabled={!!editando}>
              <Text style={styles.selectText}>{base?.base || "Selecione a base"}</Text>
              <Ionicons name="chevron-down" color={colors.textSecondary} size={18} />
            </Pressable>
            <View style={styles.fields}>
              {[["Flex", mercadoLivre, setMercadoLivre], ["Shopee", shopee, setShopee], ["Avulso", avulso, setAvulso]].map(([label, value, setter]) => (
                <View style={styles.fieldWrap} key={String(label)}>
                  <Text style={styles.label}>{String(label)}</Text>
                  <TextInput style={[styles.input, semVolume && styles.disabled]} value={String(value)} onChangeText={setter as (v: string) => void} keyboardType="number-pad" editable={!semVolume} />
                </View>
              ))}
            </View>
            <View style={styles.switchRow}><Text style={styles.title}>Sem volume</Text><Switch value={semVolume} onValueChange={setSemVolume} /></View>
            <Pressable style={[styles.button, salvando && styles.disabled]} onPress={salvar} disabled={salvando}>
              <Text style={styles.buttonText}>{salvando ? "Salvando..." : editando ? "Salvar alteração" : "Registrar coleta"}</Text>
            </Pressable>
            {editando ? <Pressable onPress={limpar}><Text style={[styles.editText, { textAlign: "center", marginTop: 12 }]}>Cancelar edição</Text></Pressable> : null}
          </View>
        ) : null}

        <Text style={styles.title}>Coletas feitas hoje</Text>
        {!loading && coletas.length === 0 ? <View style={styles.empty}><Text style={styles.muted}>Nenhuma coleta registrada hoje.</Text></View> : null}
        {coletas.map((execucao) => (
          <View key={execucao.id_execucao} style={styles.card}>
            <View style={styles.execHeader}><Text style={styles.title}>{execucao.base}</Text><Text style={styles.total}>{execucao.total}</Text></View>
            <View style={styles.chips}>
              <Text style={styles.chip}>Flex {execucao.mercado_livre}</Text><Text style={styles.chip}>Shopee {execucao.shopee}</Text><Text style={styles.chip}>Avulso {execucao.avulso}</Text>
              {execucao.status === "sem_volume" ? <Text style={styles.chip}>Sem volume</Text> : null}
            </View>
            {execucao.participantes.map((item) => item.pode_editar && execucao.modo !== "codigo" ? (
              <Pressable key={item.id_participante} style={styles.edit} onPress={() => iniciarEdicao(execucao, item)}>
                <Ionicons name="create-outline" color={colors.primary} size={18} /><Text style={styles.editText}>Editar</Text>
              </Pressable>
            ) : null)}
          </View>
        ))}
      </ScrollView>

      <Modal visible={seletorAberto} animationType="slide" onRequestClose={() => setSeletorAberto(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}><Text style={styles.title}>Selecione a base</Text><Pressable onPress={() => setSeletorAberto(false)}><Ionicons name="close" size={26} color={colors.text} /></Pressable></View>
          <ScrollView>{bases.map((item) => <Pressable key={item.id_base} style={styles.baseRow} onPress={() => { setBase(item); setSeletorAberto(false); }}><Text style={styles.baseText}>{item.base}</Text></Pressable>)}</ScrollView>
        </View>
      </Modal>
    </View>
  );
}
