import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { effectivePodeLerColeta, staffRoleLabel } from "../utils/role";
import type { StaffStackParamList } from "../navigation/staffStackTypes";

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
        content: { paddingBottom: 48 },
        gradientHeader: {
          paddingBottom: 20,
          paddingHorizontal: 20,
          paddingTop: 20,
        },
        title: { fontSize: 28, fontWeight: "700", marginBottom: 4, color: colors.text },
        greeting: { fontSize: 16, color: colors.textSecondary },
        subBase: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
        badge: {
          alignSelf: "flex-start",
          marginTop: 10,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: colors.chipBackground,
        },
        badgeText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
        body: { paddingHorizontal: 16, marginTop: 8 },
        heroBtn: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          backgroundColor: colors.primary,
          paddingVertical: 18,
          paddingHorizontal: 20,
          borderRadius: 16,
          marginBottom: 16,
          minHeight: 56,
        },
        heroBtnText: {
          color: colors.primaryContrast,
          fontSize: 18,
          fontWeight: "700",
        },
        grid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
        },
        gridItem: {
          flexGrow: 1,
          flexBasis: "45%",
          minWidth: 140,
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          paddingVertical: 20,
          paddingHorizontal: 14,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        gridIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        },
        gridTitle: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
        gridSub: {
          fontSize: 12,
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: 4,
        },
      }),
    [colors]
  );

  const go = (route: keyof StaffStackParamList) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(route);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[colors.primarySoft, colors.background]}
        locations={[0, 1]}
        style={styles.gradientHeader}
      >
        <Text style={styles.title}>Operação</Text>
        <Text style={styles.greeting}>Olá, {nome}</Text>
        {subBase ? <Text style={styles.subBase}>Base: {subBase}</Text> : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{labelPerfil}</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <TouchableOpacity
          style={styles.heroBtn}
          onPress={() => go("LeituraSaidas")}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Escanear saída"
        >
          <Ionicons name="scan-outline" size={28} color={colors.primaryContrast} />
          <Text style={styles.heroBtnText}>Escanear saída</Text>
        </TouchableOpacity>

        <View style={styles.grid}>
          {mostrarColeta ? (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => go("LeituraColetas")}
              activeOpacity={0.88}
            >
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
            style={[styles.gridItem, !mostrarColeta && { flexBasis: "100%" }]}
            onPress={() => go("ConsultaCodigos")}
            activeOpacity={0.88}
          >
            <View style={styles.gridIcon}>
              <Ionicons name="search-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Consultar</Text>
            <Text style={styles.gridSub} numberOfLines={2}>
              Códigos e status
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
