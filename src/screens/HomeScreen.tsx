import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { decodeJwtPayload } from "../utils/jwt";
import { getResumoEntregas, iniciarRota } from "../features/entregas/api";

type Props = {
  onLogout: () => void;
  onNavigateEntregas: () => void;
  onNavigateScan: () => void;
};

export default function HomeScreen({ onLogout, onNavigateEntregas, onNavigateScan }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 24, paddingBottom: 48 },
        header: { marginBottom: 24 },
        title: { fontSize: 24, fontWeight: "700", marginBottom: 4, color: colors.text },
        greeting: { fontSize: 16, color: colors.text },
        subBase: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
        loader: { marginTop: 48 },
        cardMain: {
          backgroundColor: colors.primary,
          padding: 24,
          borderRadius: 12,
          marginBottom: 16,
        },
        cardMainLabel: { fontSize: 14, color: "rgba(255,255,255,0.9)" },
        cardMainValue: { fontSize: 36, fontWeight: "700", color: colors.primaryContrast, marginVertical: 8 },
        cardMainLink: { fontSize: 14, color: colors.primaryContrast, textDecorationLine: "underline" },
        cardSec: {
          backgroundColor: colors.backgroundCard,
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        cardSecLabel: { fontSize: 14, color: colors.textSecondary },
        cardSecValue: { fontSize: 24, fontWeight: "600", color: colors.text },
        cardSecRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
        cardSecSmall: {
          flex: 1,
          backgroundColor: colors.backgroundCard,
          padding: 16,
          borderRadius: 12,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        cardSecSmallLeft: {},
        cardSecSmallRight: {},
        btnScan: {
          backgroundColor: colors.success,
          paddingVertical: 18,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 12,
        },
        btnScanText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "600" },
        btnIniciar: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 12,
        },
        btnDisabled: { opacity: 0.7 },
        btnIniciarText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "600" },
        btnSair: { marginTop: 24, paddingVertical: 12, alignItems: "center" },
        btnSairText: { color: colors.danger, fontSize: 16 },
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
  const claims = token ? decodeJwtPayload(token) : {};
  const nome = claims.username || "Motoboy";
  const subBase = claims.sub_base || "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getResumoEntregas();
      setResumo(r);
    } catch {
      setResumo({ pendentes: 0, finalizadas_hoje: 0, pode_iniciar_rota: false, ausentes: 0, atraso_d1: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualiza o resumo sempre que a tela ganha foco (ex.: voltar de Entregas ou Scanner)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(24, insets.top) }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Entregas</Text>
        <Text style={styles.greeting}>Olá, {nome}</Text>
        {subBase ? <Text style={styles.subBase}>Base: {subBase}</Text> : null}
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <>
          <TouchableOpacity style={styles.cardMain} onPress={onNavigateEntregas}>
            <Text style={styles.cardMainLabel}>Entregas pendentes</Text>
            <Text style={styles.cardMainValue}>{resumo?.pendentes ?? 0}</Text>
            <Text style={styles.cardMainLink}>Ver todas</Text>
          </TouchableOpacity>

          <View style={styles.cardSec}>
            <Text style={styles.cardSecLabel}>Finalizadas hoje</Text>
            <Text style={styles.cardSecValue}>{resumo?.finalizadas_hoje ?? 0}</Text>
          </View>

          <View style={styles.cardSecRow}>
            <View style={[styles.cardSecSmall, styles.cardSecSmallLeft]}>
              <Text style={styles.cardSecLabel}>Ausentes</Text>
              <Text style={styles.cardSecValue}>{resumo?.ausentes ?? 0}</Text>
            </View>
            <View style={[styles.cardSecSmall, styles.cardSecSmallRight]}>
              <Text style={styles.cardSecLabel}>Em atraso (D+1)</Text>
              <Text style={styles.cardSecValue}>{resumo?.atraso_d1 ?? 0}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btnScan} onPress={onNavigateScan}>
            <Text style={styles.btnScanText}>Escanear</Text>
          </TouchableOpacity>

          {resumo?.pode_iniciar_rota ? (
            <TouchableOpacity
              style={[styles.btnIniciar, iniciando && styles.btnDisabled]}
              onPress={handleIniciarRota}
              disabled={iniciando}
            >
              <Text style={styles.btnIniciarText}>
                {iniciando ? "Iniciando…" : "Iniciar rota"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.btnSair} onPress={onLogout}>
            <Text style={styles.btnSairText}>Sair</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
