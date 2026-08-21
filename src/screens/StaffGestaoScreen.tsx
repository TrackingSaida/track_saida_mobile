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
import { isAdminRole } from "../utils/role";
import type { GestaoStackParamList } from "../navigation/staffStackTypes";

type Props = NativeStackScreenProps<GestaoStackParamList, "StaffGestao">;

export default function StaffGestaoScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const subBase = (currentUser?.sub_base as string | undefined)?.trim() || "";
  const mostrarIndicadores = isAdminRole(currentUser?.role as number | undefined);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: space.xxl },
        body: { paddingHorizontal: space.md, marginTop: space.sm },
      }),
    [colors]
  );

  const go = (route: keyof GestaoStackParamList) => {
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
        title="Gestão"
        tertiary={subBase || undefined}
      />

      <View style={styles.body}>
        <MenuSection label="Como está a operação">
          {mostrarIndicadores ? (
            <PressableMenuRow
              icon="bar-chart-outline"
              title="Indicadores"
              subtitle="Saídas, entradas e coletas"
              onPress={() => go("IndicadoresOperacao")}
              iconColor={colors.primary}
              iconSoftBg={colors.primarySoft}
            />
          ) : null}
          <PressableMenuRow
            icon="analytics-outline"
            title="Acompanhamento"
            subtitle="Progresso e desempenho"
            onPress={() => go("AcompanharOperacao")}
            iconColor={colors.primary}
            iconSoftBg={colors.primarySoft}
            isLast
          />
        </MenuSection>
      </View>
    </ScrollView>
  );
}
