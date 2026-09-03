import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
import { useAvisosUnreadStore } from "../store/avisosUnreadStore";
import CompactStaffHeader from "../components/ui/CompactStaffHeader";
import AppBrandTitleLogo from "../components/AppBrandTitleLogo";
import NotificationBellButton from "../components/NotificationBellButton";
import { navigateToAvisos } from "../navigation/navigateToAvisos";
import MenuSection from "../components/ui/MenuSection";
import PressableMenuRow from "../components/ui/PressableMenuRow";
import OperacaoActionCard from "../features/operacao/components/OperacaoActionCard";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import { textStyle } from "../theme/typography";
import AppText from "../components/ui/AppText";
import {
  effectiveConferenciaSaida,
  effectiveEntradaObrigatoria,
  effectivePodeLerColeta,
} from "../utils/role";
import type { InicioStackParamList, OperacaoStackParamList } from "../navigation/staffStackTypes";

type Props = NativeStackScreenProps<InicioStackParamList, "StaffInicio">;

function saudacaoAgora(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function StaffInicioScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const nome = (currentUser?.username as string | undefined)?.trim() || "Usuário";
  const subBase = (currentUser?.sub_base as string | undefined)?.trim() || "";
  const mostrarColeta = effectivePodeLerColeta(currentUser);
  const mostrarEntrada = effectiveEntradaObrigatoria(currentUser);
  const mostrarConferencia = effectiveConferenciaSaida(currentUser);
  const unreadAvisos = useAvisosUnreadStore((s) => s.unreadCount);
  const refreshUnreadAvisos = useAvisosUnreadStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadAvisos();
    }, [refreshUnreadAvisos])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: space.xxl },
        body: { paddingHorizontal: space.md, marginTop: space.sm },
        gestaoLink: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          paddingVertical: space.sm,
          minHeight: 44,
        },
        gestaoLinkText: {
          ...textStyle("body"),
          fontWeight: "700",
          color: colors.primary,
        },
      }),
    [colors]
  );

  const goOperacao = (screen: keyof OperacaoStackParamList) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tabNav = navigation.getParent();
    (tabNav as { navigate: (a: string, b?: object) => void } | undefined)?.navigate("Operacao", {
      screen,
    });
  };

  const goGestao = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tabNav = navigation.getParent();
    (tabNav as { navigate: (a: string) => void } | undefined)?.navigate("Gestao");
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
        titleNode={<AppBrandTitleLogo size="header" />}
        subtitle={`${saudacaoAgora()}, ${nome}`}
        tertiary={subBase || undefined}
        rightElement={
          <NotificationBellButton unreadCount={unreadAvisos} onPress={navigateToAvisos} />
        }
      />

      <View style={styles.body}>
        <OperacaoActionCard
          variant="primary"
          title="Consultar pacote"
          subtitle="Código, etiqueta ou histórico"
          icon="search-outline"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("ConsultaCodigos");
          }}
        />

        <MenuSection label="Ações rápidas">
          {mostrarEntrada ? (
            <PressableMenuRow
              icon="enter-outline"
              title="Registrar entrada"
              subtitle="Entrada na base"
              onPress={() => goOperacao("LeituraEntradas")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
            />
          ) : null}
          {mostrarColeta ? (
            <PressableMenuRow
              icon="layers-outline"
              title="Registrar coleta"
              subtitle="Pacotes coletados"
              onPress={() => goOperacao("LeituraColetas")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
            />
          ) : null}
          {mostrarColeta ? (
            <PressableMenuRow
              icon="list-outline"
              title="Consultar coletas"
              subtitle="Pendentes e andamento"
              onPress={() => goOperacao("ConsultarColetas")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
            />
          ) : null}
          <PressableMenuRow
            icon="scan-outline"
            title="Registrar saída"
            subtitle="Pacotes para motoboy"
            onPress={() => goOperacao("LeituraSaidas")}
            iconColor={colors.primary}
            iconSoftBg={colors.primarySoft}
            isLast={!mostrarConferencia}
          />
          {mostrarConferencia ? (
            <PressableMenuRow
              icon="checkmark-done-outline"
              title="Conferir pacotes"
              subtitle="Pendentes e concluídos"
              onPress={() => goOperacao("ConferenciaSaida")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
              isLast
            />
          ) : null}
        </MenuSection>

        <TouchableOpacity
          style={styles.gestaoLink}
          onPress={goGestao}
          accessibilityRole="button"
          accessibilityLabel="Ver gestão"
        >
          <AppText style={styles.gestaoLinkText}>Ver gestão</AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
