import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import GradientScreenHeader from "../components/ui/GradientScreenHeader";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { useMotoboyPrefsStore } from "../store/motoboyPrefsStore";
import { useThemeColors } from "../theme/colors";
import { space, radius } from "../theme/spacing";
import { type as typo } from "../theme/typography";
import { decodeJwtPayload } from "../utils/jwt";
import { getResumoEntregas, iniciarRota, getRotasAtiva, getTodayISO, getEntregas } from "../features/entregas/api";
import { useDeliveryStore } from "../store/deliveryStore";

type Props = {
  onLogout: () => void;
  onNavigateEntregas: () => void;
  onNavigateScan: () => void;
  onNavigateRouteBuilder?: () => void;
};

export default function HomeScreen({
  onLogout,
  onNavigateEntregas,
  onNavigateScan,
  onNavigateRouteBuilder,
}: Props) {
  const themeMode = useThemeStore((s) => s.theme);
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: space.xxl },
        body: { paddingHorizontal: space.md },
        loader: { marginTop: space.xxl },
        cardMainShadow: {
          borderRadius: radius.xl,
          marginBottom: space.md,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 8,
        },
        cardMainInner: {
          padding: space.xl,
          borderRadius: radius.xl,
          overflow: "hidden",
        },
        cardMainLabel: { fontSize: typo.bodySmall, color: "rgba(255,255,255,0.92)", fontWeight: "600" },
        cardMainValue: {
          fontSize: typo.metricLarge,
          fontWeight: "800",
          color: colors.primaryContrast,
          marginVertical: space.sm,
          letterSpacing: -1,
        },
        cardMainLink: {
          fontSize: typo.bodySmall,
          color: "rgba(255,255,255,0.95)",
          fontWeight: "700",
          textDecorationLine: "underline",
        },
        cardSec: {
          backgroundColor: colors.backgroundCard,
          padding: space.lg,
          borderRadius: radius.lg,
          marginBottom: space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
        cardSecLabel: { fontSize: typo.caption, color: colors.textSecondary, fontWeight: "600" },
        cardSecValue: { fontSize: typo.metricMedium, fontWeight: "800", color: colors.text, marginTop: 4 },
        cardSecRow: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
        cardSecSmall: {
          flex: 1,
          backgroundColor: colors.chipBackground,
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cardSecSmallLabel: { fontSize: typo.label, color: colors.textSecondary, fontWeight: "600" },
        cardSecSmallValue: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 4 },
        btnScan: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          paddingVertical: space.lg,
          borderRadius: radius.xl,
          marginBottom: space.sm,
          overflow: "hidden",
        },
        btnScanText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "800" },
        btnIniciar: {
          paddingVertical: 16,
          paddingHorizontal: space.md,
          borderRadius: radius.lg,
          alignItems: "center",
          marginBottom: space.sm,
        },
        btnDisabled: { opacity: 0.7 },
        btnIniciarText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "700" },
        btnRotaAtiva: {
          paddingVertical: space.md,
          borderRadius: radius.lg,
          alignItems: "center",
          marginBottom: space.sm,
          overflow: "hidden",
        },
        btnRotaAtivaText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "700" },
        btnSair: {
          marginTop: space.lg,
          paddingVertical: space.md,
          alignItems: "center",
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.backgroundCard,
        },
        btnSairText: { color: colors.textSecondary, fontSize: 15, fontWeight: "600" },
      }),
    [colors]
  );
  const [resumo, setResumo] = useState<{
    pendentes: number;
    finalizadas_hoje: number;
    pode_iniciar_rota: boolean;
    ausentes?: number;
    atraso_d1?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const token = useAuthStore((s) => s.token);
  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const claims = token ? decodeJwtPayload(token) : {};
  const nome = claims.username || "Motoboy";
  const subBase = claims.sub_base || "";

  const kpiGradient =
    themeMode === "dark"
      ? ([colors.deliveryAccent, "#2d8f5a"] as const)
      : ([colors.deliveryAccent, "#0a6e42"] as const);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getResumoEntregas();
      if (somenteHojePendentes) {
        const hoje = getTodayISO();
        const [pendentesHoje, ausentesHoje] = await Promise.all([
          getEntregas("pendente", { dia: "hoje", data: hoje }),
          getEntregas("ausentes", { dia: "hoje", data: hoje }),
        ]);
        setResumo({
          ...r,
          pendentes: pendentesHoje.length,
          ausentes: ausentesHoje.length,
          // Mesmo com filtro de hoje, atraso_d1 vem do backend com base em data operacional.
          atraso_d1: r.atraso_d1 ?? 0,
        });
      } else {
        setResumo(r);
      }
    } catch {
      setResumo({ pendentes: 0, finalizadas_hoje: 0, pode_iniciar_rota: false, ausentes: 0, atraso_d1: 0 });
    } finally {
      setLoading(false);
    }
  }, [somenteHojePendentes]);

  useFocusEffect(
    useCallback(() => {
      load();
      (async () => {
        if (!roteirizacaoHabilitada) {
          useDeliveryStore.getState().clearActiveRouteState();
          return;
        }
        try {
          const dataHoje = getTodayISO();
          const rotaAtiva = await getRotasAtiva(dataHoje);
          const store = useDeliveryStore.getState();
          if (!rotaAtiva) {
            store.clearActiveRouteState();
            return;
          }
          const ordem = rotaAtiva.ordem ?? [];
          if (ordem.length === 0) {
            store.clearActiveRouteState();
            return;
          }
          if (rotaAtiva.parada_atual >= ordem.length) {
            store.clearActiveRouteState();
            return;
          }
          await store.restoreActiveRoute(rotaAtiva);
        } catch {
          useDeliveryStore.getState().clearActiveRouteState();
        }
      })();
    }, [load, roteirizacaoHabilitada])
  );

  const activeRouteId = useDeliveryStore((s) => s.activeRouteId);

  const handleIniciarRota = async () => {
    if (!resumo?.pode_iniciar_rota) return;
    setIniciando(true);
    try {
      await iniciarRota();
      await load();
    } finally {
      setIniciando(false);
    }
  };

  const handleSair = () => {
    Alert.alert("Sair", "Deseja sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => onLogout() },
    ]);
  };

  const headerGradient: readonly [string, string] = [
    colors.deliveryHeaderGradientStart,
    colors.deliveryHeaderGradientEnd,
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <GradientScreenHeader
        gradientColors={headerGradient}
        title="Entregas"
        subtitle={`Olá, ${nome}`}
        tertiary={subBase ? `Base: ${subBase}` : undefined}
        paddingBottom={space.lg}
      />

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} color={colors.deliveryAccent} />
        ) : (
          <>
            <View style={styles.cardMainShadow}>
              <TouchableOpacity onPress={onNavigateEntregas} activeOpacity={0.92}>
                <LinearGradient colors={[...kpiGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardMainInner}>
                  <Text style={styles.cardMainLabel}>Entregas pendentes</Text>
                  <Text style={styles.cardMainValue}>{resumo?.pendentes ?? 0}</Text>
                  <Text style={styles.cardMainLink}>Ver todas</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.cardSec}>
              <Text style={styles.cardSecLabel}>Finalizadas hoje</Text>
              <Text style={styles.cardSecValue}>{resumo?.finalizadas_hoje ?? 0}</Text>
            </View>

            <View style={styles.cardSecRow}>
              <View style={styles.cardSecSmall}>
                <Text style={styles.cardSecSmallLabel}>Ausentes</Text>
                <Text style={styles.cardSecSmallValue}>{resumo?.ausentes ?? 0}</Text>
              </View>
              <View style={styles.cardSecSmall}>
                <Text style={styles.cardSecSmallLabel}>Atraso (D+1)</Text>
                <Text style={styles.cardSecSmallValue}>{resumo?.atraso_d1 ?? 0}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onNavigateScan} activeOpacity={0.92}>
              <LinearGradient
                colors={[...kpiGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnScan}
              >
                <Ionicons name="scan-outline" size={26} color={colors.primaryContrast} />
                <Text style={styles.btnScanText}>Escanear</Text>
              </LinearGradient>
            </TouchableOpacity>

            {roteirizacaoHabilitada && activeRouteId != null && onNavigateRouteBuilder ? (
              <TouchableOpacity onPress={onNavigateRouteBuilder} activeOpacity={0.92}>
                <LinearGradient
                  colors={[colors.deliveryAccent, themeMode === "dark" ? "#2a9d62" : "#0a6e42"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnRotaAtiva}
                >
                  <Text style={styles.btnRotaAtivaText}>Continuar rota ativa</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            {resumo?.pode_iniciar_rota ? (
              <TouchableOpacity
                onPress={handleIniciarRota}
                disabled={iniciando}
                activeOpacity={0.92}
                style={iniciando ? styles.btnDisabled : undefined}
              >
                <LinearGradient
                  colors={[colors.deliveryAccent, themeMode === "dark" ? "#2a9d62" : "#0a6e42"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnIniciar}
                >
                  <Text style={styles.btnIniciarText}>
                    {iniciando ? "Iniciando…" : "Iniciar rota"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.btnSair} onPress={handleSair} activeOpacity={0.85}>
              <Text style={styles.btnSairText}>Sair</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}
