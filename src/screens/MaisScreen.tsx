import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../store/authStore";
import { useAvisosUnreadStore } from "../store/avisosUnreadStore";
import MenuSection from "../components/ui/MenuSection";
import PressableMenuRow from "../components/ui/PressableMenuRow";
import { useThemeColors } from "../theme/colors";
import { useProfileTheme } from "../theme/profileTheme";
import { space } from "../theme/spacing";
import { type as typo } from "../theme/typography";
import { decodeJwtPayload } from "../utils/jwt";
import { isMotoboyRole } from "../utils/role";

export type MaisStackParamList = {
  MaisInicio: undefined;
  MeusDados: undefined;
  Configuracoes: undefined;
  Privacidade: undefined;
  MinhasEntregas: { presetPeriodoHoje?: true } | undefined;
  MinhasEntregasDia: { data: string };
  EntregaDetail: { idSaida: number };
  MeusFechamentos: undefined;
  FechamentoDetail: { idFechamento: number };
  Avisos: undefined;
  AvisoDetail: { avisoId: number };
};

type Props = NativeStackScreenProps<MaisStackParamList, "MaisInicio"> & {
  onLogout: () => Promise<void>;
};

export default function MaisScreen({ navigation, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const profile = useProfileTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: space.xxl },
        headerGradient: {
          paddingHorizontal: space.lg,
          paddingBottom: space.xl,
          alignItems: "center",
        },
        avatar: {
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: colors.backgroundCard,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: space.md,
        },
        avatarText: { fontSize: 30, fontWeight: "800", color: profile.accent },
        greeting: { fontSize: typo.caption, color: colors.textSecondary, marginBottom: 4, fontWeight: "600" },
        nome: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
        body: { paddingHorizontal: space.md, marginTop: space.sm },
      }),
    [colors, profile]
  );
  const token = useAuthStore((s) => s.token);
  const claims = token ? decodeJwtPayload(token) : {};
  const nome = claims.username || "Usuário";
  const role = claims.role as number | undefined;
  const showMotoboyMenu = isMotoboyRole(role);
  const unreadAvisos = useAvisosUnreadStore((s) => s.unreadCount);
  const refreshUnreadAvisos = useAvisosUnreadStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      if (showMotoboyMenu) void refreshUnreadAvisos();
    }, [showMotoboyMenu, refreshUnreadAvisos])
  );

  const handleSair = () => {
    Alert.alert("Sair", "Deseja sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          void onLogout();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: 0 }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[...profile.headerGradient]}
        locations={[0, 1]}
        style={[styles.headerGradient, { paddingTop: Math.max(space.lg, insets.top) }]}
      >
        <View style={[styles.avatar, { borderWidth: 3, borderColor: profile.accentSoft }]}>
          <Text style={styles.avatarText}>{nome.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.greeting}>Olá</Text>
        <Text style={styles.nome}>{nome}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <MenuSection label="Conta">
          <PressableMenuRow
            icon="person-outline"
            title="Meus dados"
            onPress={() => navigation.navigate("MeusDados")}
            iconColor={profile.accent}
            iconSoftBg={profile.accentSoft}
            isLast
          />
        </MenuSection>

        <MenuSection label="Aplicativo">
          <PressableMenuRow
            icon="settings-outline"
            title="Configurações"
            onPress={() => navigation.navigate("Configuracoes")}
            iconColor={profile.accent}
            iconSoftBg={profile.accentSoft}
          />
          <PressableMenuRow
            icon="shield-checkmark-outline"
            title="Privacidade"
            subtitle="Política de Privacidade"
            onPress={() => navigation.navigate("Privacidade")}
            iconColor={profile.accent}
            iconSoftBg={profile.accentSoft}
            isLast
          />
        </MenuSection>

        {showMotoboyMenu ? (
          <MenuSection label="Operação">
            <PressableMenuRow
              icon="list-outline"
              title="Minhas entregas"
              onPress={() => navigation.navigate("MinhasEntregas")}
              iconColor={profile.accent}
              iconSoftBg={profile.accentSoft}
            />
            <PressableMenuRow
              icon="document-text-outline"
              title="Meus fechamentos"
              onPress={() => navigation.navigate("MeusFechamentos")}
              iconColor={profile.accent}
              iconSoftBg={profile.accentSoft}
            />
            <PressableMenuRow
              icon="notifications-outline"
              title="Avisos"
              onPress={() => navigation.navigate("Avisos")}
              iconColor={profile.accent}
              iconSoftBg={profile.accentSoft}
              badgeCount={unreadAvisos}
              isLast
            />
          </MenuSection>
        ) : null}

        <MenuSection label="Sessão">
          <PressableMenuRow
            icon="log-out-outline"
            title="Sair"
            onPress={handleSair}
            danger
            showChevron={false}
            isLast
          />
        </MenuSection>
      </View>
    </ScrollView>
  );
}
