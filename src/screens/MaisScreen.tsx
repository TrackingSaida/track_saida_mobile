import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import { useAvisosUnreadStore } from "../store/avisosUnreadStore";
import MenuSection from "../components/ui/MenuSection";
import PressableMenuRow from "../components/ui/PressableMenuRow";
import { useThemeColors } from "../theme/colors";
import { useProfileTheme } from "../theme/profileTheme";
import { space } from "../theme/spacing";
import {
  isAdminRole,
  isMotoboyRole,
  staffRoleLabel,
} from "../utils/role";

export type MaisStackParamList = {
  MaisInicio: undefined;
  MeusDados: undefined;
  Configuracoes: undefined;
  Privacidade: undefined;
  SobreRotevo: undefined;
  EnviarAviso: undefined;
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
  const currentUser = useAuthStore((s) => s.currentUser);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: space.xxl + insets.bottom },
        headerGradient: {
          paddingHorizontal: space.md,
          paddingBottom: space.md,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.backgroundCard,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 2,
          borderColor: profile.accentSoft,
        },
        avatarText: {
          fontSize: 18,
          lineHeight: 22,
          fontWeight: "800",
          color: profile.accent,
        },
        headerTextCol: { flex: 1, minWidth: 0 },
        nome: {
          fontSize: 17,
          lineHeight: 22,
          fontWeight: "800",
          color: colors.text,
          letterSpacing: -0.2,
        },
        meta: {
          fontSize: 13,
          lineHeight: 18,
          color: colors.textSecondary,
          fontWeight: "500",
          marginTop: 2,
        },
        verPerfil: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          marginTop: 6,
          gap: 2,
        },
        verPerfilText: {
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "700",
          color: profile.accent,
        },
        body: { paddingHorizontal: space.md, marginTop: space.sm },
      }),
    [colors, insets.bottom, profile]
  );

  const nome = (currentUser?.username as string | undefined)?.trim() || "Usuário";
  const subBase = (currentUser?.sub_base as string | undefined)?.trim() || "";
  const role = currentUser?.role as number | undefined;
  const labelPerfil = staffRoleLabel(role);
  const showMotoboyMenu = isMotoboyRole(role);
  const mostrarEnviarAviso = !showMotoboyMenu && isAdminRole(role);
  const unreadAvisos = useAvisosUnreadStore((s) => s.unreadCount);
  const refreshUnreadAvisos = useAvisosUnreadStore((s) => s.refresh);

  const metaParts = [subBase || null, showMotoboyMenu ? null : labelPerfil || null].filter(
    Boolean
  ) as string[];
  const metaLine = metaParts.join(" · ");

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
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[...profile.headerGradient]}
        locations={[0, 1]}
        style={[styles.headerGradient, { paddingTop: Math.max(space.md, insets.top) }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{nome.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.nome} numberOfLines={1}>
              {nome}
            </Text>
            {metaLine ? (
              <Text style={styles.meta} numberOfLines={1}>
                {metaLine}
              </Text>
            ) : null}
            <Pressable
              style={styles.verPerfil}
              onPress={() => navigation.navigate("MeusDados")}
              accessibilityRole="button"
              accessibilityLabel="Ver meu perfil"
            >
              <Text style={styles.verPerfilText}>Ver meu perfil</Text>
              <Ionicons name="chevron-forward" size={14} color={profile.accent} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <MenuSection label="Conta">
          <PressableMenuRow
            icon="person-outline"
            title="Meu perfil"
            subtitle="Dados pessoais e acesso"
            onPress={() => navigation.navigate("MeusDados")}
            iconColor={profile.accent}
            iconSoftBg={profile.accentSoft}
            isLast={!subBase}
          />
          {subBase ? (
            <PressableMenuRow
              icon="business-outline"
              title="Base atual"
              subtitle={subBase}
              onPress={() => undefined}
              iconColor={profile.accent}
              iconSoftBg={profile.accentSoft}
              showChevron={false}
              disabled
              isLast
            />
          ) : null}
        </MenuSection>

        {mostrarEnviarAviso ? (
          <MenuSection label="Comunicação">
            <PressableMenuRow
              icon="notifications-outline"
              title="Enviar aviso"
              subtitle="Comunicar motoboys da base"
              onPress={() => navigation.navigate("EnviarAviso")}
              iconColor={profile.accent}
              iconSoftBg={profile.accentSoft}
              isLast
            />
          </MenuSection>
        ) : null}

        <MenuSection label="Aplicativo">
          <PressableMenuRow
            icon="settings-outline"
            title="Preferências"
            subtitle="Configurações do aplicativo"
            onPress={() => navigation.navigate("Configuracoes")}
            iconColor={profile.accent}
            iconSoftBg={profile.accentSoft}
          />
          <PressableMenuRow
            icon="information-circle-outline"
            title="Sobre o ROTEVO"
            subtitle="Versão e privacidade"
            onPress={() => navigation.navigate("SobreRotevo")}
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
            title="Sair da conta"
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
