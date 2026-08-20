import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
import GradientScreenHeader from "../components/ui/GradientScreenHeader";
import AppBrandTitleLogo from "../components/AppBrandTitleLogo";
import AppText from "../components/ui/AppText";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import { textStyle } from "../theme/typography";
import {
  effectiveConferenciaSaida,
  effectiveEntradaObrigatoria,
  effectivePodeLerColeta,
  effectivePodeLancarColetaManual,
  isAdminRole,
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
  const mostrarColetaManual = effectivePodeLancarColetaManual(currentUser);
  const mostrarEntrada = effectiveEntradaObrigatoria(currentUser);
  const mostrarConferencia = effectiveConferenciaSaida(currentUser);
  const mostrarEnviarAviso = isAdminRole(role);
  const mostrarIndicadores = isAdminRole(role);
  // Com conferência ativa, a consulta de volumes fica na própria Conferência.
  const mostrarSaidasPorMotoboy = !mostrarConferencia;

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
        operacaoTitle: {
          ...textStyle("screenTitle"),
          fontWeight: "800",
          letterSpacing: -0.5,
          color: colors.text,
          marginTop: space.sm,
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
    // rotas sem params (EnviarAviso, ConferenciaSaida opcional, etc.)
    (navigation as any).navigate(route);
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
        titleNode={<AppBrandTitleLogo size="home" />}
        subtitle={`Olá, ${nome}`}
        tertiary={subBase ? `Base: ${subBase}` : undefined}
        paddingBottom={space.lg}
      >
        <AppText style={styles.operacaoTitle}>Operação</AppText>
        <Text style={styles.perfilLine}>Perfil: {labelPerfil}</Text>
      </GradientScreenHeader>

      <View style={styles.body}>
        <OperacaoActionCard
          variant="primary"
          title="Consultar pacote"
          subtitle="Código e histórico"
          icon="search-outline"
          onPress={() => go("ConsultaCodigos")}
        />

        <View style={styles.grid}>
          {mostrarIndicadores ? (
            <OperacaoActionCard
              variant="compact"
              title="Indicadores"
              subtitle="Saídas, entradas e coletas"
              icon="analytics-outline"
              onPress={() => go("IndicadoresOperacao")}
            />
          ) : null}
          <OperacaoActionCard
            variant="compact"
            title="Registrar saídas"
            subtitle="Ler pacotes para um motoboy"
            icon="scan-outline"
            onPress={() => go("LeituraSaidas")}
          />
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
          {mostrarSaidasPorMotoboy ? (
            <OperacaoActionCard
              variant="compact"
              title="Saídas por motoboy"
              subtitle="Shopee, ML e Avulso"
              icon="cube-outline"
              onPress={() => go("SaidasPorMotoboy")}
            />
          ) : null}
          <OperacaoActionCard
            variant="compact"
            title="Acompanhamento"
            subtitle="Progresso e desempenho"
            icon="stats-chart-outline"
            onPress={() => go("AcompanharOperacao")}
          />
          {mostrarEnviarAviso ? (
            <OperacaoActionCard
              variant="compact"
              title="Enviar aviso"
              subtitle="Avisar motoboys da base"
              icon="notifications-outline"
              onPress={() => go("EnviarAviso")}
            />
          ) : null}
          {mostrarColeta ? (
            <OperacaoActionCard
              variant="compact"
              title="Coleta"
              subtitle="Shopee, ML e avulsas"
              icon="layers-outline"
              onPress={() => go("LeituraColetas")}
            />
          ) : null}
          {mostrarColetaManual ? (
            <OperacaoActionCard
              variant="compact"
              title="Coleta manual"
              subtitle="Lançar e consultar quantidades"
              icon="create-outline"
              onPress={() => go("MinhasColetas")}
            />
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
