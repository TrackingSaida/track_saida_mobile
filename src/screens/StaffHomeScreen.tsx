import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
import GradientScreenHeader from "../components/ui/GradientScreenHeader";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import {
  effectiveConferenciaSaida,
  effectiveEntradaObrigatoria,
  effectivePodeLerColeta,
  staffRoleLabel,
} from "../utils/role";
import type { StaffStackParamList } from "../navigation/staffStackTypes";
import OperacaoActionCard from "../features/operacao/components/OperacaoActionCard";

type Props = NativeStackScreenProps<StaffStackParamList, "StaffHome">;

export default function StaffHomeScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const nome = (currentUser?.username as string | undefined)?.trim() || "Usuário";
  const subBase = (currentUser?.sub_base as string | undefined) || "";
  const role = currentUser?.role as number | undefined;
  const labelPerfil = staffRoleLabel(role);
  const mostrarColeta = effectivePodeLerColeta(currentUser);
  const mostrarEntrada = effectiveEntradaObrigatoria(currentUser);
  const mostrarConferencia = effectiveConferenciaSaida(currentUser);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: space.xxl },
        body: { paddingHorizontal: space.md, marginTop: space.sm },
        perfilLine: {
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: 4,
        },
        grid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginTop: space.xs,
        },
      }),
    [colors]
  );

  const go = (route: keyof StaffStackParamList) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(route);
  };

  const headerGradient: readonly [string, string] = [
    colors.operatorHeaderGradientStart,
    colors.operatorHeaderGradientEnd,
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <GradientScreenHeader
        gradientColors={headerGradient}
        title="Operação"
        subtitle={`Olá, ${nome}`}
        tertiary={subBase ? `Base: ${subBase}` : undefined}
        paddingBottom={space.lg}
      >
        <Text style={styles.perfilLine}>Perfil: {labelPerfil}</Text>
      </GradientScreenHeader>

      <View style={styles.body}>
        <OperacaoActionCard
          variant="primary"
          title="Registrar saídas"
          subtitle="Ler pacotes para um motoboy"
          icon="scan-outline"
          onPress={() => go("LeituraSaidas")}
        />

        <View style={styles.grid}>
          {mostrarEntrada ? (
            <OperacaoActionCard
              variant="compact"
              title="Registrar entrada"
              subtitle="Entrada na base"
              icon="enter-outline"
              onPress={() => go("LeituraEntradas")}
            />
          ) : null}
          {mostrarConferencia ? (
            <OperacaoActionCard
              variant="compact"
              title="Conferência"
              subtitle="Pendentes e concluídas"
              icon="checkmark-done-outline"
              onPress={() => go("ConferenciaSaida")}
            />
          ) : null}
          <OperacaoActionCard
            variant="compact"
            title="Consultar pacote"
            subtitle="Código e histórico"
            icon="search-outline"
            onPress={() => go("ConsultaCodigos")}
          />
          <OperacaoActionCard
            variant="compact"
            title="Saídas por motoboy"
            subtitle="Shopee, ML e Avulso"
            icon="cube-outline"
            onPress={() => go("SaidasPorMotoboy")}
          />
          <OperacaoActionCard
            variant="compact"
            title="Acompanhamento"
            subtitle="Progresso do dia"
            icon="stats-chart-outline"
            onPress={() => go("AcompanharOperacao")}
          />
          {mostrarColeta ? (
            <OperacaoActionCard
              variant="compact"
              title="Coleta"
              subtitle="Shopee, ML e avulsas"
              icon="layers-outline"
              onPress={() => go("LeituraColetas")}
            />
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
