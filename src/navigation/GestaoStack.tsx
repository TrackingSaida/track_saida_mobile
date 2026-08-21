import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StaffGestaoScreen from "../screens/StaffGestaoScreen";
import IndicadoresOperacaoScreen from "../features/operacao/screens/IndicadoresOperacaoScreen";
import AcompanharOperacaoScreen from "../features/operacao/screens/AcompanharOperacaoScreen";
import AcompanharMotoboyDiaScreen from "../features/operacao/screens/AcompanharMotoboyDiaScreen";
import type { GestaoStackParamList } from "./staffStackTypes";
import { useThemeColors } from "../theme/colors";

const Stack = createNativeStackNavigator<GestaoStackParamList>();

export default function GestaoStack() {
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
      <Stack.Screen name="StaffGestao" component={StaffGestaoScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="IndicadoresOperacao"
        component={IndicadoresOperacaoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="AcompanharOperacao" component={AcompanharOperacaoScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="AcompanharMotoboyDia"
        component={AcompanharMotoboyDiaScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

