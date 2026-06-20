import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import PressableMenuRow from "../../../components/ui/PressableMenuRow";
import type { CompletedRouteSummary } from "../../../store/homeRouteStore";

type Props = {
  roteirizacaoHabilitada: boolean;
  lastCompleted: CompletedRouteSummary | null;
  onMinhasEntregas: () => void;
  onMapaPendentes: () => void;
  onHistoricoRotas: () => void;
  onPreferencias: () => void;
  onVerResumoUltimaRota: () => void;
  onScan?: () => void;
};

export default function HomeAtalhosPage({
  roteirizacaoHabilitada,
  lastCompleted,
  onMinhasEntregas,
  onMapaPendentes,
  onHistoricoRotas,
  onPreferencias,
  onVerResumoUltimaRota,
  onScan,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        content: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.xxl },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: space.md,
        },
        section: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: "hidden",
          marginBottom: space.md,
        },
        lastRouteCard: {
          borderRadius: radius.lg,
          padding: space.lg,
          marginBottom: space.md,
          overflow: "hidden",
        },
        lastRouteTitle: {
          fontSize: typo.bodySmall,
          color: "rgba(255,255,255,0.92)",
          fontWeight: "600",
        },
        lastRouteDesc: {
          fontSize: 20,
          fontWeight: "800",
          color: colors.primaryContrast,
          marginVertical: space.sm,
        },
        lastRouteBtn: {
          alignSelf: "flex-start",
          paddingVertical: space.sm,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          backgroundColor: "rgba(255,255,255,0.2)",
        },
        lastRouteBtnText: {
          color: colors.primaryContrast,
          fontWeight: "700",
          fontSize: typo.bodySmall,
        },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Atalhos</Text>

      {roteirizacaoHabilitada && lastCompleted ? (
        <LinearGradient
          colors={[colors.deliveryAccent, "#0a6e42"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.lastRouteCard}
        >
          <Text style={styles.lastRouteTitle}>Última rota concluída</Text>
          <Text style={styles.lastRouteDesc}>
            {lastCompleted.paradas} paradas · {lastCompleted.pedidos} pedidos
          </Text>
          <TouchableOpacity style={styles.lastRouteBtn} onPress={onVerResumoUltimaRota} activeOpacity={0.9}>
            <Text style={styles.lastRouteBtnText}>Ver resumo</Text>
          </TouchableOpacity>
        </LinearGradient>
      ) : null}

      <View style={styles.section}>
        {onScan ? (
          <PressableMenuRow icon="cube-outline" title="Inserir novos pacotes" onPress={onScan} />
        ) : null}
        <PressableMenuRow icon="list-outline" title="Minhas entregas" onPress={onMinhasEntregas} />
        <PressableMenuRow icon="map-outline" title="Mapa de pendentes" onPress={onMapaPendentes} />
        {roteirizacaoHabilitada ? (
          <PressableMenuRow icon="time-outline" title="Histórico de rotas" onPress={onHistoricoRotas} />
        ) : null}
        <PressableMenuRow
          icon="settings-outline"
          title="Preferências"
          onPress={onPreferencias}
          isLast
        />
      </View>
    </ScrollView>
  );
}
