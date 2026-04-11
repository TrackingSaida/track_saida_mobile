import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StaffHomeScreen from "../screens/StaffHomeScreen";
import LeituraSaidasScreen from "../features/operacao/screens/LeituraSaidasScreen";
import LeituraColetasScreen from "../features/operacao/screens/LeituraColetasScreen";
import ConsultaCodigosScreen from "../features/operacao/screens/ConsultaCodigosScreen";
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
      }}
    >
      <Stack.Screen name="StaffHome" component={StaffHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="LeituraSaidas"
        component={LeituraSaidasScreen}
        options={{ title: "Leitura de saídas", headerBackTitle: "Operação" }}
      />
      <Stack.Screen
        name="LeituraColetas"
        component={LeituraColetasScreen}
        options={{ title: "Leitura de coletas", headerBackTitle: "Operação" }}
      />
      <Stack.Screen
        name="ConsultaCodigos"
        component={ConsultaCodigosScreen}
        options={{ title: "Consulta de códigos", headerBackTitle: "Operação" }}
      />
    </Stack.Navigator>
  );
}
