import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { useThemeColors } from "../theme/colors";
import { getProfileThemeColors } from "../theme/profileTheme";
import { useThemeStore } from "../store/themeStore";
import { useAuthStore } from "../store/authStore";
import { useFontScale } from "../hooks/useFontScale";
import { textStyle } from "../theme/typography";
import InicioStack from "./InicioStack";
import OperacaoStack from "./OperacaoStack";
import GestaoStack from "./GestaoStack";
import type {
  GestaoStackParamList,
  InicioStackParamList,
  OperacaoStackParamList,
} from "./staffStackTypes";
import MaisScreen, { type MaisStackParamList } from "../screens/MaisScreen";
import MeusDadosScreen from "../screens/MeusDadosScreen";
import ConfiguracoesScreen from "../screens/ConfiguracoesScreen";
import PrivacidadeScreen from "../screens/PrivacidadeScreen";
import SobreRotevoScreen from "../screens/SobreRotevoScreen";
import EnviarAvisoScreen from "../features/avisos/screens/EnviarAvisoScreen";
import MinhasEntregasScreen from "../features/entregas/screens/MinhasEntregasScreen";
import MinhasEntregasDiaScreen from "../features/entregas/screens/MinhasEntregasDiaScreen";
import EntregaDetailScreen from "../features/entregas/screens/EntregaDetailScreen";
import MeusFechamentosScreen from "../features/fechamentos/screens/MeusFechamentosScreen";
import FechamentoDetailScreen from "../features/fechamentos/screens/FechamentoDetailScreen";
import AvisosScreen from "../features/avisos/screens/AvisosScreen";
import AvisoDetailScreen from "../features/avisos/screens/AvisoDetailScreen";

export type StaffTabParamList = {
  Inicio: NavigatorScreenParams<InicioStackParamList> | undefined;
  Operacao: NavigatorScreenParams<OperacaoStackParamList> | undefined;
  Gestao: NavigatorScreenParams<GestaoStackParamList> | undefined;
  Mais: NavigatorScreenParams<MaisStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<StaffTabParamList>();
const MaisStack = createNativeStackNavigator<MaisStackParamList>();

function MaisStackScreen({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <MaisStack.Navigator screenOptions={{ headerShown: false }}>
      <MaisStack.Screen name="MaisInicio">
        {(props) => <MaisScreen {...props} onLogout={onLogout} />}
      </MaisStack.Screen>
      <MaisStack.Screen name="MeusDados" component={MeusDadosScreen} />
      <MaisStack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
      <MaisStack.Screen name="Privacidade" component={PrivacidadeScreen} />
      <MaisStack.Screen name="SobreRotevo" component={SobreRotevoScreen} />
      <MaisStack.Screen name="EnviarAviso" component={EnviarAvisoScreen} />
      <MaisStack.Screen name="MinhasEntregas" component={MinhasEntregasScreen} />
      <MaisStack.Screen name="MinhasEntregasDia" component={MinhasEntregasDiaScreen} />
      <MaisStack.Screen name="EntregaDetail" component={EntregaDetailScreen} />
      <MaisStack.Screen name="MeusFechamentos" component={MeusFechamentosScreen} />
      <MaisStack.Screen name="FechamentoDetail" component={FechamentoDetailScreen} />
      <MaisStack.Screen name="Avisos" component={AvisosScreen} />
      <MaisStack.Screen name="AvisoDetail" component={AvisoDetailScreen} />
    </MaisStack.Navigator>
  );
}

export default function StaffNavigator({ onLogout }: { onLogout: () => Promise<void> }) {
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.theme);
  const role = useAuthStore((s) => s.currentUser?.role);
  const profileTab = useMemo(
    () => getProfileThemeColors(themeMode, role as number | undefined),
    [themeMode, role]
  );
  const insets = useSafeAreaInsets();
  const { ms } = useFontScale();
  const tabPadBottom = Math.max(8, insets.bottom);
  const tabMinHeight = ms(58) + Math.max(0, insets.bottom - 8);

  const tabScreenOptions = {
    headerShown: false,
    tabBarActiveTintColor: profileTab.tabBarActive,
    tabBarInactiveTintColor: colors.tabBarInactive,
    tabBarAllowFontScaling: true,
    tabBarLabelStyle: { ...textStyle("tabLabel"), fontWeight: "600" as const },
    tabBarStyle: {
      backgroundColor: colors.tabBarBackground,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 6,
      paddingBottom: tabPadBottom,
      minHeight: tabMinHeight,
    },
  };

  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Inicio"
        options={{
          tabBarLabel: "Início",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size ?? 24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("Inicio", { screen: "StaffInicio" });
          },
        })}
      >
        {() => <InicioStack />}
      </Tab.Screen>
      <Tab.Screen
        name="Operacao"
        options={{
          tabBarLabel: "Operação",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size ?? 24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("Operacao", { screen: "StaffOperacao" });
          },
        })}
      >
        {() => <OperacaoStack />}
      </Tab.Screen>
      <Tab.Screen
        name="Gestao"
        options={{
          tabBarLabel: "Gestão",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size ?? 24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("Gestao", { screen: "StaffGestao" });
          },
        })}
      >
        {() => <GestaoStack />}
      </Tab.Screen>
      <Tab.Screen
        name="Mais"
        options={{
          tabBarLabel: "Mais",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu-outline" size={size ?? 24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("Mais", { screen: "MaisInicio" });
          },
        })}
      >
        {() => <MaisStackScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
