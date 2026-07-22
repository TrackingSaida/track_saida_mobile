import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
import GradientScreenHeader from "../components/ui/GradientScreenHeader";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import { effectivePodeLerColeta, staffRoleLabel } from "../utils/role";
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
        coletaWrap: { marginTop: space.xs },
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
        <OperacaoActionCard
          title="Consultar pacote"
          subtitle="Buscar código, status e histórico"
          icon="search-outline"
          onPress={() => go("ConsultaCodigos")}
        />
        <OperacaoActionCard
          title="Saídas por motoboy"
          subtitle="Quantidades por serviço (Shopee, ML e Avulso)"
          icon="cube-outline"
          onPress={() => go("SaidasPorMotoboy")}
        />
        <OperacaoActionCard
          title="Acompanhamento do dia"
          subtitle="Progresso dos motoboys e detalhes por entregador"
          icon="stats-chart-outline"
          onPress={() => go("AcompanharOperacao")}
        />
        {mostrarColeta ? (
          <View style={styles.coletaWrap}>
            <OperacaoActionCard
              title="Coleta"
              subtitle="Shopee, ML e avulsas"
              icon="layers-outline"
              onPress={() => go("LeituraColetas")}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
