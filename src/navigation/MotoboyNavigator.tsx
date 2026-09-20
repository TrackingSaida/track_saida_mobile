import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";
import { getProfileThemeColors } from "../theme/profileTheme";
import { useThemeStore } from "../store/themeStore";
import { useAuthStore } from "../store/authStore";
import { useFontScale } from "../hooks/useFontScale";
import { textStyle } from "../theme/typography";
import { effectivePodeLerColeta } from "../utils/role";
import type { MotoboyRootStackParamList, MotoboyTabParamList } from "./motoboyStackTypes";
import HomeScreen from "../screens/HomeScreen";
import EntregasListScreen from "../features/entregas/screens/EntregasListScreen";
import MotoboyRotasScreen from "../screens/MotoboyRotasScreen";
import MaisScreen from "../screens/MaisScreen";
import ScanActionSheet, { type ScanSheetAction } from "../features/home/components/ScanActionSheet";
import ScanScreen from "../features/entregas/screens/ScanScreen";
import DeliverScanScreen from "../features/entregas/screens/DeliverScanScreen";
import PrepareDeliveriesScreen from "../features/entregas/screens/PrepareDeliveriesScreen";
import RouteBuilderScreen from "../screens/RouteBuilderScreen";
import RotasHistoricoScreen from "../features/home/screens/RotasHistoricoScreen";
import DevolverPacotesScreen from "../features/entregas/screens/DevolverPacotesScreen";
import EntregaDetailScreen from "../features/entregas/screens/EntregaDetailScreen";
import HomeResumoDetalheScreen from "../features/home/screens/HomeResumoDetalheScreen";
import LeituraColetasScreen from "../features/operacao/screens/LeituraColetasScreen";
import LeiturasColetaScreen from "../features/operacao/screens/LeiturasColetaScreen";
import ConsultarColetasScreen from "../features/operacao/screens/ConsultarColetasScreen";
import MeusDadosScreen from "../screens/MeusDadosScreen";
import ConfiguracoesScreen from "../screens/ConfiguracoesScreen";
import PrivacidadeScreen from "../screens/PrivacidadeScreen";
import SobreRotevoScreen from "../screens/SobreRotevoScreen";
import MinhasEntregasScreen from "../features/entregas/screens/MinhasEntregasScreen";
import MinhasEntregasDiaScreen from "../features/entregas/screens/MinhasEntregasDiaScreen";
import MeusFechamentosScreen from "../features/fechamentos/screens/MeusFechamentosScreen";
import FechamentoDetailScreen from "../features/fechamentos/screens/FechamentoDetailScreen";
import AvisosScreen from "../features/avisos/screens/AvisosScreen";
import AvisoDetailScreen from "../features/avisos/screens/AvisoDetailScreen";
import EnviarAvisoScreen from "../features/avisos/screens/EnviarAvisoScreen";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

const RootStack = createNativeStackNavigator<MotoboyRootStackParamList>();
const Tab = createBottomTabNavigator<MotoboyTabParamList>();

function EscanearPlaceholder() {
  const navigation = useNavigation<BottomTabNavigationProp<MotoboyTabParamList>>();
  useFocusEffect(
    useCallback(() => {
      navigation.navigate("Inicio");
    }, [navigation])
  );
  return <View style={{ flex: 1 }} />;
}

function MotoboyTabs({ onLogout }: { onLogout: () => Promise<void> }) {
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.theme);
  const currentUser = useAuthStore((s) => s.currentUser);
  const profileTab = useMemo(
    () => getProfileThemeColors(themeMode, currentUser?.role as number | undefined),
    [themeMode, currentUser?.role]
  );
  const insets = useSafeAreaInsets();
  const { ms } = useFontScale();
  const tabPadBottom = Math.max(8, insets.bottom);
  const tabMinHeight = ms(58) + Math.max(0, insets.bottom - 8);
  const [scanOpen, setScanOpen] = useState(false);
  const showColeta = effectivePodeLerColeta(currentUser);
  const stackNav = useNavigation<NativeStackNavigationProp<MotoboyRootStackParamList>>();

  const onSelectScan = useCallback(
    (action: ScanSheetAction) => {
      setScanOpen(false);
      if (action === "insert") stackNav.navigate("Scan");
      else if (action === "deliver") stackNav.navigate("DeliverScan");
      else stackNav.navigate("LeituraColetas");
    },
    [stackNav]
  );

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="Inicio"
        backBehavior="initialRoute"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
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
        }}
      >
        <Tab.Screen
          name="Inicio"
          component={HomeScreen}
          options={{
            tabBarLabel: "Início",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size ?? 24} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Entregas"
          component={EntregasListScreen}
          options={{
            tabBarLabel: "Entregas",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cube-outline" size={size ?? 24} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Escanear"
          component={EscanearPlaceholder}
          options={{
            tabBarLabel: "Escanear",
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: focused ? colors.deliveryAccentSoft : "transparent",
                  marginTop: -4,
                }}
              >
                <Ionicons
                  name="scan-outline"
                  size={26}
                  color={focused ? colors.deliveryAccent : color}
                />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setScanOpen(true);
            },
          }}
        />
        <Tab.Screen
          name="Rotas"
          component={MotoboyRotasScreen}
          options={{
            tabBarLabel: "Rotas",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map-outline" size={size ?? 24} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Mais"
          options={{
            tabBarLabel: "Mais",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="menu-outline" size={size ?? 24} color={color} />
            ),
          }}
        >
          {(props) => <MaisScreen {...props} onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
      <ScanActionSheet
        visible={scanOpen}
        showColeta={showColeta}
        onClose={() => setScanOpen(false)}
        onSelect={onSelectScan}
      />
    </View>
  );
}

export default function MotoboyRootNavigator({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Tabs">{() => <MotoboyTabs onLogout={onLogout} />}</RootStack.Screen>
      <RootStack.Screen name="Scan" component={ScanScreen} />
      <RootStack.Screen name="DeliverScan" component={DeliverScanScreen} />
      <RootStack.Screen name="PrepareDeliveries" component={PrepareDeliveriesScreen} />
      <RootStack.Screen name="RouteBuilder" component={RouteBuilderScreen} />
      <RootStack.Screen name="RotasHistorico" component={RotasHistoricoScreen} />
      <RootStack.Screen name="DevolverPacotes" component={DevolverPacotesScreen} />
      <RootStack.Screen name="LeituraColetas" component={LeituraColetasScreen} />
      <RootStack.Screen name="LeiturasColeta" component={LeiturasColetaScreen} />
      <RootStack.Screen name="ConsultarColetas" component={ConsultarColetasScreen} />
      <RootStack.Screen name="EntregaDetail" component={EntregaDetailScreen} />
      <RootStack.Screen name="ResumoDetalhe" component={HomeResumoDetalheScreen} />
      <RootStack.Screen name="MeusDados" component={MeusDadosScreen} />
      <RootStack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
      <RootStack.Screen name="Privacidade" component={PrivacidadeScreen} />
      <RootStack.Screen name="SobreRotevo" component={SobreRotevoScreen} />
      <RootStack.Screen name="EnviarAviso" component={EnviarAvisoScreen} />
      <RootStack.Screen name="MinhasEntregas" component={MinhasEntregasScreen} />
      <RootStack.Screen name="MinhasEntregasDia" component={MinhasEntregasDiaScreen} />
      <RootStack.Screen name="MeusFechamentos" component={MeusFechamentosScreen} />
      <RootStack.Screen name="FechamentoDetail" component={FechamentoDetailScreen} />
      <RootStack.Screen name="Avisos" component={AvisosScreen} />
      <RootStack.Screen name="AvisoDetail" component={AvisoDetailScreen} />
    </RootStack.Navigator>
  );
}
