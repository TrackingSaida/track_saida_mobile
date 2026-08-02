import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../components/ScreenHeaderBar";
import MenuSection from "../components/ui/MenuSection";
import PressableMenuRow from "../components/ui/PressableMenuRow";
import { useThemeColors } from "../theme/colors";
import { useProfileTheme } from "../theme/profileTheme";
import { space } from "../theme/spacing";
import { hasPrivacyPolicyUrl, PRIVACY_POLICY_URL } from "../config/privacy";
import type { MaisStackParamList } from "./MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "Privacidade">;

export default function PrivacidadeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const profile = useProfileTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: { paddingHorizontal: space.md, marginTop: space.sm, paddingBottom: space.xxl },
        hint: {
          fontSize: 13,
          lineHeight: 18,
          color: colors.textSecondary,
          marginTop: space.md,
          marginHorizontal: space.xs,
        },
      }),
    [colors]
  );

  const openPolicy = async () => {
    if (!hasPrivacyPolicyUrl()) {
      Alert.alert(
        "Política indisponível",
        "A Política de Privacidade ainda não foi publicada. Em breve ela estará disponível neste menu."
      );
      return;
    }
    try {
      const can = await Linking.canOpenURL(PRIVACY_POLICY_URL);
      if (!can) {
        Alert.alert("Erro", "Não foi possível abrir o link da Política de Privacidade.");
        return;
      }
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o link da Política de Privacidade.");
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Privacidade"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <MenuSection label="Documentos">
          <PressableMenuRow
            icon="document-text-outline"
            title="Política de Privacidade"
            subtitle="Saiba como seus dados são utilizados"
            onPress={() => {
              void openPolicy();
            }}
            iconColor={profile.accent}
            iconSoftBg={profile.accentSoft}
            isLast
          />
        </MenuSection>
        {!hasPrivacyPolicyUrl() ? (
          <Text style={styles.hint}>
            O link público ainda não está configurado neste build. Quando a política for publicada
            em HTTPS, configure EXPO_PUBLIC_PRIVACY_POLICY_URL.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
