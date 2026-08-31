import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import type { MaisStackParamList } from "../../../screens/MaisScreen";
import { getFechamento, type FechamentoItem, type FechamentoServicoResumo } from "../api";

type Props = NativeStackScreenProps<MaisStackParamList, "FechamentoDetail">;

const SERVICOS: { key: "shopee" | "flex" | "avulso"; label: string; bg: string; fg: string }[] = [
  { key: "shopee", label: "Shopee", bg: "rgba(238,77,45,0.16)", fg: "#ee4d2d" },
  { key: "flex", label: "Flex", bg: "rgba(255,224,102,0.28)", fg: "#6a5a00" },
  { key: "avulso", label: "Avulso", bg: "rgba(99,102,241,0.16)", fg: "#6366f1" },
];

function num(v: number | string | undefined | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtBrl(v: number | string | undefined | null): string {
  return num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtSigned(v: number | string | undefined | null): string {
  const n = num(v);
  if (n === 0) return fmtBrl(0);
  return `${n > 0 ? "+" : "-"}${fmtBrl(Math.abs(n))}`;
}

function fmtDesconto(v: number | string | undefined | null): string {
  const n = num(v);
  return n > 0 ? `-${fmtBrl(n)}` : fmtBrl(0);
}

function fmtDate(ymd?: string): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return d && m && y ? `${d}/${m}/${y}` : ymd;
}

function labelStatus(status?: string): string {
  const st = String(status || "").toUpperCase();
  if (st === "PAGO") return "Pago";
  if (st === "GERADO" || st === "FECHADO") return "Gerado";
  if (st === "REAJUSTADO") return "Reajustado";
  if (st === "PENDENTE") return "Pendente";
  return st || "—";
}

function servicoAtivo(s?: FechamentoServicoResumo | null): boolean {
  if (!s) return false;
  return s.feitos > 0 || s.cancelados > 0 || num(s.valor_feitos) !== 0 || num(s.valor_cancelados) !== 0;
}

export default function FechamentoDetailScreen({ navigation, route }: Props) {
  const { idFechamento } = route.params;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [item, setItem] = useState<FechamentoItem | null>(null);
  const [loading, setLoading] = useState(true);

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
        body: { padding: space.md, paddingBottom: Math.max(28, insets.bottom + 16) },
        hero: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          padding: space.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        heroLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
        heroTotal: { fontSize: 26, fontWeight: "800", color: colors.primary, marginTop: 4 },
        heroMeta: { fontSize: 14, color: colors.text, marginTop: 10, fontWeight: "600" },
        heroSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
        sectionTitle: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.textSecondary,
          marginTop: 18,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        servicoBadge: {
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        servicoBadgeText: { fontSize: 11, fontWeight: "800" },
        servicoCanc: { fontSize: 11, color: colors.danger, marginTop: 2, fontWeight: "600", textAlign: "right" },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 14,
          paddingHorizontal: space.md,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: colors.border,
        },
        row: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        rowLast: { borderBottomWidth: 0 },
        rowLabel: { fontSize: 14, color: colors.textSecondary, flex: 1, paddingRight: 8 },
        rowValue: { fontSize: 14, fontWeight: "700", color: colors.text, textAlign: "right" },
        rowMotivo: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textAlign: "right" },
        confMeta: { fontSize: 12, color: colors.textSecondary, marginTop: -4, marginBottom: 8 },
        empty: { textAlign: "center", color: colors.textSecondary, marginTop: 40, paddingHorizontal: 24 },
      }),
    [colors, insets.bottom]
  );

  const resumo = item?.resumo ?? null;
  const servicosVisiveis = SERVICOS.filter((s) => servicoAtivo(resumo?.por_servico?.[s.key]));
  const qtdColeta = Number(item?.qtd_dias_coleta || 0);
  const ajustes = resumo ? num(resumo.ajustes) : num(item?.valor_adicao) - num(item?.valor_subtracao);
  const mostrarG = (resumo?.pacotes_grandes ?? 0) > 0;
  const mostrarCanc = (resumo?.cancelados ?? 0) > 0 || num(resumo?.valor_cancelados) > 0;
  const mostrarColeta = qtdColeta > 0 && item?.faz_coleta !== false;
  const mostrarAjustes = ajustes !== 0;
  const diasConferencia = item?.conferencia?.habilitada ? item.conferencia.dias || [] : [];
  const qtdConferidos = diasConferencia.filter((d) => d.conferido).length;
  const qtdNaoConferidos = diasConferencia.length - qtdConferidos;

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Fechamento" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : !item ? (
        <Text style={styles.empty}>Não foi possível carregar este fechamento.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Total a receber</Text>
            <Text style={styles.heroTotal}>{fmtBrl(item.valor_final)}</Text>
            <Text style={styles.heroMeta}>
              {labelStatus(item.status)} · {fmtDate(item.periodo_inicio)} a {fmtDate(item.periodo_fim)}
            </Text>
            <Text style={styles.heroSub}>{item.codigo}</Text>
          </View>

          {servicosVisiveis.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Por serviço</Text>
              <View style={styles.card}>
                {servicosVisiveis.map((s, index) => {
                  const data = resumo?.por_servico?.[s.key];
                  const temCanc = (data?.cancelados ?? 0) > 0 || num(data?.valor_cancelados) > 0;
                  const isLast = index === servicosVisiveis.length - 1;
                  return (
                    <View key={s.key} style={[styles.row, isLast && styles.rowLast]}>
                      <View style={[styles.servicoBadge, { backgroundColor: s.bg }]}>
                        <Text style={[styles.servicoBadgeText, { color: s.fg }]}>{s.label}</Text>
                      </View>
                      <View>
                        <Text style={styles.rowValue}>
                          {data?.feitos ?? 0} · {fmtBrl(data?.valor_feitos)}
                        </Text>
                        {temCanc ? (
                          <Text style={styles.servicoCanc}>
                            Canc. {data?.cancelados ?? 0} · {fmtDesconto(data?.valor_cancelados)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Resumo</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Feitos</Text>
              <Text style={styles.rowValue}>{resumo?.feitos ?? "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Cancelados</Text>
              <Text style={styles.rowValue}>{resumo?.cancelados ?? "—"}</Text>
            </View>
            {mostrarG ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Pacotes grandes</Text>
                <Text style={styles.rowValue}>{resumo?.pacotes_grandes}</Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Valor bruto</Text>
              <Text style={styles.rowValue}>{resumo ? fmtBrl(resumo.valor_bruto) : fmtBrl(item.valor_base)}</Text>
            </View>
            {mostrarCanc ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Desconto de cancelamentos</Text>
                <Text style={[styles.rowValue, { color: colors.danger }]}>
                  {fmtDesconto(resumo?.valor_cancelados)}
                </Text>
              </View>
            ) : null}
            {mostrarColeta ? (
              <View style={[styles.row, !mostrarAjustes && styles.rowLast]}>
                <Text style={styles.rowLabel}>
                  Diárias de coleta ({qtdColeta} {qtdColeta === 1 ? "dia" : "dias"})
                </Text>
                <Text style={styles.rowValue}>{fmtBrl(item.valor_coletas)}</Text>
              </View>
            ) : null}
            {mostrarAjustes ? (
              <View style={[styles.row, styles.rowLast]}>
                <Text style={styles.rowLabel}>Ajustes</Text>
                <View>
                  <Text style={styles.rowValue}>{fmtSigned(ajustes)}</Text>
                  {item.motivo_adicao && num(item.valor_adicao) !== 0 ? (
                    <Text style={styles.rowMotivo}>{item.motivo_adicao}</Text>
                  ) : null}
                  {item.motivo_subtracao && num(item.valor_subtracao) !== 0 ? (
                    <Text style={styles.rowMotivo}>{item.motivo_subtracao}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {diasConferencia.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Conferência</Text>
              <Text style={styles.confMeta}>
                {qtdNaoConferidos === 0
                  ? `${qtdConferidos} conferido${qtdConferidos === 1 ? "" : "s"}`
                  : `${qtdConferidos} conferido${qtdConferidos === 1 ? "" : "s"} · ${qtdNaoConferidos} não conferido${qtdNaoConferidos === 1 ? "" : "s"}`}
              </Text>
              <View style={styles.card}>
                {diasConferencia.map((dia, index) => (
                  <View
                    key={dia.data}
                    style={[styles.row, index === diasConferencia.length - 1 && styles.rowLast]}
                  >
                    <Text style={styles.rowLabel}>{fmtDate(dia.data)}</Text>
                    <Text style={[styles.rowValue, { color: dia.conferido ? colors.success : colors.danger }]}>
                      {dia.label}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {item.chave_pix ? (
            <>
              <Text style={styles.sectionTitle}>Pagamento</Text>
              <View style={styles.card}>
                <View style={[styles.row, styles.rowLast]}>
                  <Text style={styles.rowLabel}>PIX</Text>
                  <Text style={styles.rowValue}>{item.chave_pix}</Text>
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
