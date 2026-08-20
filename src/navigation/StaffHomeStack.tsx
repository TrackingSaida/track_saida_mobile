import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StaffHomeScreen from "../screens/StaffHomeScreen";
import LeituraSaidasScreen from "../features/operacao/screens/LeituraSaidasScreen";
import LeituraColetasScreen from "../features/operacao/screens/LeituraColetasScreen";
import MinhasColetasScreen from "../features/operacao/screens/MinhasColetasScreen";
import LeituraEntradasScreen from "../features/operacao/screens/LeituraEntradasScreen";
import ConferenciaSaidaScreen from "../features/operacao/screens/ConferenciaSaidaScreen";
import ConsultaCodigosScreen from "../features/operacao/screens/ConsultaCodigosScreen";
import SaidasPorMotoboyScreen from "../features/operacao/screens/SaidasPorMotoboyScreen";
import IndicadoresOperacaoScreen from "../features/operacao/screens/IndicadoresOperacaoScreen";
import AcompanharOperacaoScreen from "../features/operacao/screens/AcompanharOperacaoScreen";
import AcompanharMotoboyDiaScreen from "../features/operacao/screens/AcompanharMotoboyDiaScreen";
import EnviarAvisoScreen from "../features/avisos/screens/EnviarAvisoScreen";
import type { StaffStackParamList } from "./staffStackTypes";
import { useThemeColors } from "../theme/colors";

export type { StaffStackParamList };

const Stack = createNativeStackNavigator<StaffStackParamList>();

export default function StaffHomeStack() {
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
      <Stack.Screen name="StaffHome" component={StaffHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="LeituraSaidas"
        component={LeituraSaidasScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LeituraColetas"
        component={LeituraColetasScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="MinhasColetas" component={MinhasColetasScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="LeituraEntradas"
        component={LeituraEntradasScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ConferenciaSaida"
        component={ConferenciaSaidaScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EnviarAviso"
        component={EnviarAvisoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ConsultaCodigos"
        component={ConsultaCodigosScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SaidasPorMotoboy"
        component={SaidasPorMotoboyScreen}
        options={{ headerShown: false }}
      />
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
