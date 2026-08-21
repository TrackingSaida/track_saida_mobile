import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import ScreenHeaderBar from "../components/ScreenHeaderBar";
import MenuSection from "../components/ui/MenuSection";
import PressableMenuRow from "../components/ui/PressableMenuRow";
import { useThemeColors } from "../theme/colors";
import { useProfileTheme } from "../theme/profileTheme";
import { space } from "../theme/spacing";
import type { MaisStackParamList } from "./MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "SobreRotevo">;

const APP_VERSION =
  Constants.expoConfig?.version ??
  (typeof Constants.nativeAppVersion === "string" ? Constants.nativeAppVersion : null) ??
  "—";

export default function SobreRotevoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const profile = useProfileTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: {
          paddingHorizontal: space.md,
          marginTop: space.sm,
          paddingBottom: space.xxl + insets.bottom,
        },
        versionCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingHorizontal: space.md,
          paddingVertical: space.md,
          marginBottom: space.lg,
        },
        versionLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
        versionValue: {
          fontSize: 16,
          color: colors.text,
          fontWeight: "700",
          marginTop: 4,
        },
      }),
    [colors, insets.bottom]
  );

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Sobre o ROTEVO"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.versionCard}>
          <Text style={styles.versionLabel}>Versão do aplicativo</Text>
          <Text style={styles.versionValue}>Versão {APP_VERSION}</Text>
        </View>
        <MenuSection label="Documentos">
          <PressableMenuRow
            icon="shield-checkmark-outline"
            title="Política de privacidade"
            subtitle="Como tratamos seus dados"
            onPress={() => navigation.navigate("Privacidade")}
            iconColor={profile.accent}
            iconSoftBg={profile.accentSoft}
            isLast
          />
        </MenuSection>
      </ScrollView>
    </View>
  );
}
