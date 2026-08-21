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
  effectivePodeRealizarColeta,
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
  const mostrarColeta = effectivePodeRealizarColeta(currentUser);
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
        groupTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: space.lg, marginBottom: 2 },
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

        {mostrarColeta ? <Text style={styles.groupTitle}>Coletas</Text> : null}
        {mostrarColeta ? (
          <View style={styles.grid}>
            <OperacaoActionCard
              variant="compact"
              title="Registrar coletas"
              subtitle="Câmera, leitor ou quantidades"
              icon="layers-outline"
              onPress={() => go("LeituraColetas")}
            />
            <OperacaoActionCard
              variant="compact"
              title="Consultar coletas"
              subtitle="Pendentes e andamento"
              icon="list-outline"
              onPress={() => go("ConsultarColetas")}
            />
          </View>
        ) : null}

        <Text style={styles.groupTitle}>Saídas</Text>
        <View style={styles.grid}>
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
        </View>

        <Text style={styles.groupTitle}>Indicadores</Text>
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
            title="Acompanhamento"
            subtitle="Progresso e desempenho"
            icon="stats-chart-outline"
            onPress={() => go("AcompanharOperacao")}
          />
        </View>

        {mostrarEnviarAviso ? (
          <View style={{ marginTop: space.lg }}>
            <OperacaoActionCard
              variant="primary"
              title="Enviar aviso"
              subtitle="Avisar motoboys da base"
              icon="notifications-outline"
              onPress={() => go("EnviarAviso")}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
