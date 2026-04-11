import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { effectivePodeLerColeta, staffRoleLabel } from "../utils/role";
import type { StaffStackParamList } from "../navigation/staffStackTypes";

type Props = NativeStackScreenProps<StaffStackParamList, "StaffHome">;

type MenuItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof StaffStackParamList;
};

export default function StaffHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const nome = (currentUser?.username as string | undefined)?.trim() || "Usuário";
  const subBase = (currentUser?.sub_base as string | undefined) || "";
  const role = currentUser?.role as number | undefined;
  const labelPerfil = staffRoleLabel(role);
  const mostrarColeta = effectivePodeLerColeta(currentUser);

  const items: MenuItem[] = useMemo(() => {
    const base: MenuItem[] = [
      {
        key: "saidas",
        title: "Leitura de saídas",
        subtitle: "Escanear códigos e vincular ao motoboy",
        icon: "barcode-outline",
        route: "LeituraSaidas",
      },
    ];
    if (mostrarColeta) {
      base.push({
        key: "coletas",
        title: "Leitura de coletas",
        subtitle: "Registrar coletas Shopee, ML e avulsas",
        icon: "layers-outline",
        route: "LeituraColetas",
      });
    }
    base.push({
      key: "consulta",
      title: "Consulta de códigos",
      subtitle: "Buscar saídas por filtros e período",
      icon: "search-outline",
      route: "ConsultaCodigos",
    });
    return base;
  }, [mostrarColeta]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: 48 },
        gradientHeader: {
          paddingBottom: 20,
          paddingHorizontal: 20,
          paddingTop: Math.max(16, insets.top + 8),
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
        listWrap: { paddingHorizontal: 16, marginTop: 8 },
        row: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          paddingVertical: 16,
          paddingHorizontal: 14,
          marginBottom: 12,
          minHeight: 76,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
        rowPressed: { opacity: 0.92 },
        iconCircle: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        },
        rowTextWrap: { flex: 1, minWidth: 0 },
        rowTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
        rowSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
      }),
    [colors, insets.top]
  );

  const go = (route: keyof StaffStackParamList) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      <View style={styles.listWrap}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => go(item.route)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.subtitle}`}
          >
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={28} color={colors.primary} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSubtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
