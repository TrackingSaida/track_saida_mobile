import React, { useMemo } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
import CompactStaffHeader from "../components/ui/CompactStaffHeader";
import MenuSection from "../components/ui/MenuSection";
import PressableMenuRow from "../components/ui/PressableMenuRow";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import {
  effectiveConferenciaSaida,
  effectiveEntradaObrigatoria,
  effectivePodeLerColeta,
} from "../utils/role";
import type { OperacaoStackParamList } from "../navigation/staffStackTypes";

type Props = NativeStackScreenProps<OperacaoStackParamList, "StaffOperacao">;

export default function StaffOperacaoScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const subBase = (currentUser?.sub_base as string | undefined)?.trim() || "";
  const mostrarColeta = effectivePodeLerColeta(currentUser);
  const mostrarEntrada = effectiveEntradaObrigatoria(currentUser);
  const mostrarConferencia = effectiveConferenciaSaida(currentUser);
  const mostrarSaidasPorMotoboy = !mostrarConferencia;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: space.xxl },
        body: { paddingHorizontal: space.md, marginTop: space.sm },
      }),
    [colors]
  );

  const go = (route: keyof OperacaoStackParamList) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(route as never);
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
      <CompactStaffHeader
        gradientColors={headerGradient}
        title="Operação"
        tertiary={subBase || undefined}
      />

      <View style={styles.body}>
        {mostrarColeta ? (
          <MenuSection label="Coletas">
            <PressableMenuRow
              icon="layers-outline"
              title="Registrar coleta"
              subtitle="Shopee, Mercado Livre e avulsos"
              onPress={() => go("LeituraColetas")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
            />
            <PressableMenuRow
              icon="list-outline"
              title="Consultar coletas"
              subtitle="Pendentes e andamento"
              onPress={() => go("ConsultarColetas")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
              isLast
            />
          </MenuSection>
        ) : null}

        <MenuSection label="Movimentação">
          <PressableMenuRow
            icon="scan-outline"
            title="Registrar saída"
            subtitle="Pacotes para um motoboy"
            onPress={() => go("LeituraSaidas")}
            iconColor={colors.primary}
            iconSoftBg={colors.primarySoft}
            isLast={!mostrarEntrada && !mostrarSaidasPorMotoboy}
          />
          {mostrarEntrada ? (
            <PressableMenuRow
              icon="enter-outline"
              title="Registrar entrada"
              subtitle="Retorno na base"
              onPress={() => go("LeituraEntradas")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
              isLast={!mostrarSaidasPorMotoboy}
            />
          ) : null}
          {mostrarSaidasPorMotoboy ? (
            <PressableMenuRow
              icon="cube-outline"
              title="Volumes por motoboy"
              subtitle="Shopee, Mercado Livre e avulso"
              onPress={() => go("SaidasPorMotoboy")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
              isLast
            />
          ) : null}
        </MenuSection>

        {mostrarConferencia ? (
          <MenuSection label="Conferência">
            <PressableMenuRow
              icon="checkmark-done-outline"
              title="Conferir pacotes"
              subtitle="Pendentes e concluídos"
              onPress={() => go("ConferenciaSaida")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
              isLast
            />
          </MenuSection>
        ) : null}
      </View>
    </ScrollView>
  );
}
