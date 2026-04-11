import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import GradientScreenHeader from "../components/ui/GradientScreenHeader";
import { useThemeColors } from "../theme/colors";
import { space, radius } from "../theme/spacing";
import { effectivePodeLerColeta, staffRoleLabel } from "../utils/role";
import type { StaffStackParamList } from "../navigation/staffStackTypes";

type Props = NativeStackScreenProps<StaffStackParamList, "StaffHome">;

export default function StaffHomeScreen({ navigation }: Props) {
  const themeMode = useThemeStore((s) => s.theme);
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
        badge: {
          alignSelf: "flex-start",
          marginTop: space.md,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          borderRadius: radius.full,
          backgroundColor: colors.primarySoft,
        },
        badgeText: { fontSize: 13, color: colors.primary, fontWeight: "700" },
        heroShadow: {
          borderRadius: radius.xl,
          marginBottom: space.md,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 14,
          elevation: 6,
        },
        heroBtn: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          paddingVertical: space.lg,
          paddingHorizontal: space.lg,
          minHeight: 58,
          borderRadius: radius.xl,
          overflow: "hidden",
        },
        heroBtnText: {
          color: colors.primaryContrast,
          fontSize: 18,
          fontWeight: "800",
          letterSpacing: 0.2,
        },
        grid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: space.sm,
        },
        gridItem: {
          flexGrow: 1,
          flexBasis: "45%",
          minWidth: 140,
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          paddingVertical: space.lg,
          paddingHorizontal: space.md,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
        gridIcon: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: space.sm,
        },
        gridTitle: { fontSize: 16, fontWeight: "800", color: colors.text, textAlign: "center" },
        gridSub: {
          fontSize: 11,
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: 4,
          lineHeight: 15,
          fontWeight: "500",
        },
        gridItemWide: {
          flexBasis: "100%",
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
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{labelPerfil}</Text>
        </View>
      </GradientScreenHeader>

      <View style={styles.body}>
        <View style={styles.heroShadow}>
          <TouchableOpacity
            onPress={() => go("LeituraSaidas")}
            activeOpacity={0.92}
            accessibilityRole="button"
            accessibilityLabel="Escanear saída"
          >
            <LinearGradient
              colors={
                themeMode === "dark"
                  ? [colors.primary, "#2563ab"]
                  : [colors.primary, "#0a58ca"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBtn}
            >
              <Ionicons name="scan-outline" size={28} color={colors.primaryContrast} />
              <Text style={styles.heroBtnText}>Escanear saída</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {mostrarColeta ? (
            <TouchableOpacity style={styles.gridItem} onPress={() => go("LeituraColetas")} activeOpacity={0.88}>
              <View style={styles.gridIcon}>
                <Ionicons name="layers-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.gridTitle}>Coleta</Text>
              <Text style={styles.gridSub} numberOfLines={2}>
                Shopee, ML e avulsas
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.gridItem, !mostrarColeta && styles.gridItemWide]}
            onPress={() => go("ConsultaCodigos")}
            activeOpacity={0.88}
          >
            <View style={styles.gridIcon}>
              <Ionicons name="search-outline" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.gridTitle, !mostrarColeta && { fontSize: 17 }]}>Consultar</Text>
            <Text style={styles.gridSub} numberOfLines={2}>
              Códigos e status
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
