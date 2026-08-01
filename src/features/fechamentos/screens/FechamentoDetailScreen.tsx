import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import type { MaisStackParamList } from "../../../screens/MaisScreen";
import { downloadFechamentoPdf, getFechamento, type FechamentoItem } from "../api";

type Props = NativeStackScreenProps<MaisStackParamList, "FechamentoDetail">;

function fmtBrl(v: number | string): string {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(ymd?: string): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return d && m && y ? `${d}/${m}/${y}` : ymd;
}

export default function FechamentoDetailScreen({ navigation, route }: Props) {
  const { idFechamento } = route.params;
  const colors = useThemeColors();
  const [item, setItem] = useState<FechamentoItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItem(await getFechamento(idFechamento));
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [idFechamento]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: { padding: space.lg },
        label: { fontSize: 13, color: colors.textSecondary, marginTop: 12 },
        value: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 2 },
        total: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 4 },
        btn: {
          marginTop: 28,
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
        },
        btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
      }),
    [colors]
  );

  const onDownload = async () => {
    if (!item) return;
    setDownloading(true);
    try {
      await downloadFechamentoPdf(item.id_fechamento, item.codigo);
    } catch {
      Alert.alert("Erro", "Não foi possível baixar o PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Fechamento" onBack={() => navigation.goBack()} />
      {loading || !item ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <View style={styles.body}>
          <Text style={styles.label}>Código</Text>
          <Text style={styles.value}>{item.codigo}</Text>
          <Text style={styles.label}>Período</Text>
          <Text style={styles.value}>
            {fmtDate(item.periodo_inicio)} a {fmtDate(item.periodo_fim)}
          </Text>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{(item.status || "").toUpperCase()}</Text>
          {item.chave_pix ? (
            <>
              <Text style={styles.label}>PIX</Text>
              <Text style={styles.value}>{item.chave_pix}</Text>
            </>
          ) : null}
          <Text style={styles.label}>Valor base</Text>
          <Text style={styles.value}>{fmtBrl(item.valor_base)}</Text>
          <Text style={styles.label}>Total a receber</Text>
          <Text style={styles.total}>{fmtBrl(item.valor_final)}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => void onDownload()} disabled={downloading}>
            {downloading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Baixar PDF</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
