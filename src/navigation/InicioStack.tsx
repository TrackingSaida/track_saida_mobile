import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StaffInicioScreen from "../screens/StaffInicioScreen";
import ConsultaCodigosScreen from "../features/operacao/screens/ConsultaCodigosScreen";
import type { InicioStackParamList } from "./staffStackTypes";
import { useThemeColors } from "../theme/colors";

const Stack = createNativeStackNavigator<InicioStackParamList>();

export default function InicioStack() {
  const colors = useThemeColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.backgroundCard },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: "600" },
        headerShadowVisible: false,
        statusBarTranslucent: false,
      }}
    >
      <Stack.Screen name="StaffInicio" component={StaffInicioScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConsultaCodigos" component={ConsultaCodigosScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
