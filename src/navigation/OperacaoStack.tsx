import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StaffOperacaoScreen from "../screens/StaffOperacaoScreen";
import LeituraSaidasScreen from "../features/operacao/screens/LeituraSaidasScreen";
import LeituraColetasScreen from "../features/operacao/screens/LeituraColetasScreen";
import ConsultarColetasScreen from "../features/operacao/screens/ConsultarColetasScreen";
import LeituraEntradasScreen from "../features/operacao/screens/LeituraEntradasScreen";
import ConferenciaSaidaScreen from "../features/operacao/screens/ConferenciaSaidaScreen";
import SaidasPorMotoboyScreen from "../features/operacao/screens/SaidasPorMotoboyScreen";
import type { OperacaoStackParamList } from "./staffStackTypes";
import { useThemeColors } from "../theme/colors";

const Stack = createNativeStackNavigator<OperacaoStackParamList>();

export default function OperacaoStack() {
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
      <Stack.Screen name="StaffOperacao" component={StaffOperacaoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LeituraSaidas" component={LeituraSaidasScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LeituraColetas" component={LeituraColetasScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConsultarColetas" component={ConsultarColetasScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LeituraEntradas" component={LeituraEntradasScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConferenciaSaida" component={ConferenciaSaidaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SaidasPorMotoboy" component={SaidasPorMotoboyScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
