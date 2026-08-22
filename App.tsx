import "./src/services/location/backgroundLocationTask";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { initAudioSession } from "./src/utils/sound";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFontScale } from "./src/hooks/useFontScale";
import { textStyle } from "./src/theme/typography";
import {
  NavigationContainer,
  DefaultTheme,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { rootNavigationRef } from "./src/navigation/rootNavigation";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "./src/store/authStore";
import { useThemeStore } from "./src/store/themeStore";
import { useMotoboyPrefsStore } from "./src/store/motoboyPrefsStore";
import { getColors, useThemeColors } from "./src/theme/colors";
import { getProfileThemeColors } from "./src/theme/profileTheme";
import LoginScreen from "./src/screens/LoginScreen";
import SelectSubBaseScreen from "./src/screens/SelectSubBaseScreen";
import ChangePasswordRequiredScreen from "./src/screens/ChangePasswordRequiredScreen";
import { SessionExpiredModal } from "./src/components/SessionExpiredModal";
import PendingSyncBanner from "./src/components/PendingSyncBanner";
import OperationalToast from "./src/components/OperationalToast";
import { startSyncEngine } from "./src/services/outbox/syncEngine";
import { hydrateOutboxStore } from "./src/store/outboxStore";
import { recoverRouteState } from "./src/features/entregas/services/routeRecovery";
import HomeScreen from "./src/screens/HomeScreen";
import MaisScreen, { type MaisStackParamList } from "./src/screens/MaisScreen";
import MeusDadosScreen from "./src/screens/MeusDadosScreen";
import ConfiguracoesScreen from "./src/screens/ConfiguracoesScreen";
import PrivacidadeScreen from "./src/screens/PrivacidadeScreen";
import SobreRotevoScreen from "./src/screens/SobreRotevoScreen";
import BackgroundLocationDisclosureModal from "./src/components/BackgroundLocationDisclosureModal";
import EntregasListScreen from "./src/features/entregas/screens/EntregasListScreen";
import EntregaDetailScreen from "./src/features/entregas/screens/EntregaDetailScreen";
import ScanScreen from "./src/features/entregas/screens/ScanScreen";
import DeliverScanScreen from "./src/features/entregas/screens/DeliverScanScreen";
import PrepareDeliveriesScreen from "./src/features/entregas/screens/PrepareDeliveriesScreen";
import RouteBuilderScreen from "./src/screens/RouteBuilderScreen";
import MinhasEntregasScreen from "./src/features/entregas/screens/MinhasEntregasScreen";
import MinhasEntregasDiaScreen from "./src/features/entregas/screens/MinhasEntregasDiaScreen";
import DevolverPacotesScreen from "./src/features/entregas/screens/DevolverPacotesScreen";
import DiaRotaConcluidaModal from "./src/features/entregas/components/DiaRotaConcluidaModal";
import RotasHistoricoScreen from "./src/features/home/screens/RotasHistoricoScreen";
import InicioStack from "./src/navigation/InicioStack";
import OperacaoStack from "./src/navigation/OperacaoStack";
import GestaoStack from "./src/navigation/GestaoStack";
import LeituraColetasScreen from "./src/features/operacao/screens/LeituraColetasScreen";
import LeiturasColetaScreen from "./src/features/operacao/screens/LeiturasColetaScreen";
import ConsultarColetasScreen from "./src/features/operacao/screens/ConsultarColetasScreen";
import type {
  GestaoStackParamList,
  InicioStackParamList,
  OperacaoStackParamList,
} from "./src/navigation/staffStackTypes";
import EnviarAvisoScreen from "./src/features/avisos/screens/EnviarAvisoScreen";
import {
  navigateToConfiguracoes,
  navigateToMinhasEntregas,
} from "./src/features/entregas/utils/navigationHelpers";
import { isMotoboyRole } from "./src/utils/role";
import MeusFechamentosScreen from "./src/features/fechamentos/screens/MeusFechamentosScreen";
import FechamentoDetailScreen from "./src/features/fechamentos/screens/FechamentoDetailScreen";
import AvisosScreen from "./src/features/avisos/screens/AvisosScreen";
import AvisoDetailScreen from "./src/features/avisos/screens/AvisoDetailScreen";
import UrgentAvisoGate from "./src/features/avisos/components/UrgentAvisoGate";
import {
  attachPushListeners,
  ensurePushAppStateSync,
  getLastNotificationData,
  syncPushRegistration,
} from "./src/services/push/pushService";
import { navigateFromPushData } from "./src/services/push/navigationFromPush";

import type { EntregasListInitialTab } from "./src/features/entregas/types";

export type { EntregasListInitialTab };

export type RootStackParamList = {
  HomeInicio: undefined;
  EntregasList:
    | {
        initialTab?: EntregasListInitialTab;
        todosPendentes?: boolean;
        initialMapMode?: "map";
      }
    | undefined;
  EntregaDetail: { idSaida: number };
  Scan: undefined;
  DeliverScan: undefined;
  PrepareDeliveries: undefined;
  RouteBuilder:
    | {
        openLocatePackage?: boolean;
        openSeparation?: boolean;
        highlightLocatePackage?: boolean;
        pendingAddToRoute?: number;
      }
    | undefined;
  RotasHistorico: undefined;
  DevolverPacotes: undefined;
  LeituraColetas: { baseId?: number; baseNome?: string } | undefined;
  LeiturasColeta: {
    baseId: number;
    baseNome: string;
    dataOperacao?: string;
  };
  ConsultarColetas: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SelectSubBase: { identifier: string; password: string; subBases: string[] };
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<RootStackParamList> | undefined;
  Inicio: NavigatorScreenParams<InicioStackParamList> | undefined;
  Operacao: NavigatorScreenParams<OperacaoStackParamList> | undefined;
  Gestao: NavigatorScreenParams<GestaoStackParamList> | undefined;
  Mais: NavigatorScreenParams<MaisStackParamList> | undefined;
};

const HomeStack = createNativeStackNavigator<RootStackParamList>();
const MaisStack = createNativeStackNavigator<MaisStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function HomeStackScreen({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeInicio">
        {({ navigation }) => (
          <HomeScreen
            onNavigateEntregas={(tab, opts) =>
              navigation.navigate("EntregasList", {
                ...(tab ? { initialTab: tab } : {}),
                ...(opts?.todosPendentes ? { todosPendentes: true } : {}),
                ...(opts?.initialMapMode ? { initialMapMode: opts.initialMapMode } : {}),
              })
            }
            onNavigateScan={() => navigation.navigate("Scan")}
            onNavigateDeliverScan={() => navigation.navigate("DeliverScan")}
            onNavigatePrepareRoute={() => navigation.navigate("PrepareDeliveries")}
            onNavigateRouteBuilder={(opts) =>
              navigation.navigate("RouteBuilder", {
                ...(opts?.openLocatePackage ? { openLocatePackage: true } : {}),
                ...(opts?.openSeparation ? { openSeparation: true } : {}),
                ...(opts?.highlightLocatePackage ? { highlightLocatePackage: true } : {}),
                ...(opts?.pendingAddToRoute != null
                  ? { pendingAddToRoute: opts.pendingAddToRoute }
                  : {}),
              })
            }
            onNavigateRotasHistorico={() => navigation.navigate("RotasHistorico")}
            onNavigateMinhasEntregas={() => navigateToMinhasEntregas(navigation)}
            onNavigatePreferencias={() => navigateToConfiguracoes(navigation)}
            onNavigateAvisos={() => {
              if (rootNavigationRef.isReady()) {
                (rootNavigationRef as { navigate: (...args: any[]) => void }).navigate("Mais", {
                  screen: "Avisos",
                });
              }
            }}
            onNavigateDevolverPacotes={() => navigation.navigate("DevolverPacotes")}
            onNavigateLeituraColetas={() => navigation.navigate("LeituraColetas")}
            onNavigateConsultarColetas={() => navigation.navigate("ConsultarColetas")}
          />
        )}
      </HomeStack.Screen>
      <HomeStack.Screen name="EntregasList" component={EntregasListScreen} />
      <HomeStack.Screen name="EntregaDetail" component={EntregaDetailScreen} />
      <HomeStack.Screen name="Scan" component={ScanScreen} />
      <HomeStack.Screen name="DeliverScan" component={DeliverScanScreen} />
      <HomeStack.Screen
        name="PrepareDeliveries"
        component={PrepareDeliveriesScreen}
        options={{ title: "Preparar Rota" }}
      />
      <HomeStack.Screen name="RouteBuilder" component={RouteBuilderScreen} />
      <HomeStack.Screen name="RotasHistorico" component={RotasHistoricoScreen} />
      <HomeStack.Screen name="DevolverPacotes" component={DevolverPacotesScreen} />
      <HomeStack.Screen name="LeituraColetas" component={LeituraColetasScreen} />
      <HomeStack.Screen name="LeiturasColeta" component={LeiturasColetaScreen} />
      <HomeStack.Screen name="ConsultarColetas" component={ConsultarColetasScreen} />
    </HomeStack.Navigator>
  );
}

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

function MainTabs({ onLogout }: { onLogout: () => Promise<void> }) {
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.theme);
  const role = useAuthStore((s) => s.currentUser?.role);
  const isMotoboy = isMotoboyRole(role);
  const profileTab = useMemo(() => getProfileThemeColors(themeMode, role as number | undefined), [themeMode, role]);
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

  if (isMotoboy) {
    return (
      <Tab.Navigator screenOptions={tabScreenOptions}>
        <Tab.Screen
          name="Home"
          options={{
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size ?? 24} color={color} />,
          }}
        >
          {() => <HomeStackScreen onLogout={onLogout} />}
        </Tab.Screen>
        <Tab.Screen
          name="Mais"
          options={{
            tabBarLabel: "Mais",
            tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size ?? 24} color={color} />,
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

  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Inicio"
        options={{
          tabBarLabel: "Início",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size ?? 24} color={color} />,
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
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size ?? 24} color={color} />,
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
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size ?? 24} color={color} />,
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
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size ?? 24} color={color} />,
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

export default function App() {
  const { token, currentUser, isLoading, loadToken, requiresBiometricUnlock, logout: logoutFromStore } = useAuthStore();
  const theme = useThemeStore((s) => s.theme);
  const loadTheme = useThemeStore((s) => s.loadTheme);
  const [pendingChangePassword, setPendingChangePassword] = useState(false);

  const logout = useCallback(async () => {
    useMotoboyPrefsStore.getState().resetToDefaults();
    await logoutFromStore({ revokeRemote: true });
  }, [logoutFromStore]);

  const navTheme = React.useMemo(
    () => ({
      ...DefaultTheme,
      dark: theme === "dark",
      colors: {
        primary: getColors(theme).primary,
        background: getColors(theme).background,
        card: getColors(theme).backgroundCard,
        text: getColors(theme).text,
        border: getColors(theme).border,
        notification: getColors(theme).primary,
      },
    }),
    [theme]
  );

  useEffect(() => {
    loadToken();
    loadTheme();
  }, [loadToken, loadTheme]);

  useEffect(() => {
    initAudioSession();
  }, []);

  useEffect(() => {
    if (!token || requiresBiometricUnlock || !currentUser) return;
    useMotoboyPrefsStore.getState().loadForCurrentUser().catch(() => {});
  }, [token, currentUser, requiresBiometricUnlock]);

  useEffect(() => {
    useAuthStore.getState().setSessionExpiredCallback(() => {
      /* preserva rota local e no servidor — não limpar deliveryStore */
    });
    return () => {
      useAuthStore.getState().setSessionExpiredCallback(null);
    };
  }, []);

  useEffect(() => {
    if (!token || requiresBiometricUnlock || !currentUser) return;
    void recoverRouteState({ force: true });
  }, [token, currentUser, requiresBiometricUnlock]);

  useEffect(() => {
    if (!token || requiresBiometricUnlock || !currentUser) return;
    void hydrateOutboxStore();
    const stopSync = startSyncEngine();
    return () => stopSync();
  }, [token, currentUser, requiresBiometricUnlock]);

  useEffect(() => {
    if (!token || requiresBiometricUnlock || !currentUser) return;
    void syncPushRegistration({ attempts: 3 });
    const detachListeners = attachPushListeners((data) => {
      navigateFromPushData(rootNavigationRef.isReady() ? rootNavigationRef : null, data);
    });
    const detachAppState = ensurePushAppStateSync();
    void getLastNotificationData().then((data) => {
      if (data && rootNavigationRef.isReady()) {
        navigateFromPushData(rootNavigationRef, data);
      }
    });
    return () => {
      detachListeners();
      detachAppState();
    };
  }, [token, currentUser, requiresBiometricUnlock]);

  if (isLoading) {
    const loadingColors = getColors(theme);
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: loadingColors.background,
            }}
            edges={["top", "bottom"]}
          >
            <ActivityIndicator size="large" color={loadingColors.primary} />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  const showMainApp = token != null && !requiresBiometricUnlock;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={rootNavigationRef} theme={navTheme}>
        <StatusBar style={theme === "dark" ? "light" : "dark"} />
        {pendingChangePassword ? (
          <ChangePasswordRequiredScreen onDone={() => setPendingChangePassword(false)} />
        ) : showMainApp ? (
          <View style={{ flex: 1 }}>
            <PendingSyncBanner />
            <View style={{ flex: 1 }}>
              <MainTabs onLogout={logout} />
            </View>
            <UrgentAvisoGate />
            <OperationalToast />
            <DiaRotaConcluidaModal />
            <BackgroundLocationDisclosureModal />
            <SessionExpiredModal onRelogin={() => {}} />
          </View>
        ) : (
          <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen
                  onLoginSuccess={() => {}}
                  onMustChangePassword={() => setPendingChangePassword(true)}
                  onSelectSubBase={(identifier, password, subBases) =>
                    navigation.navigate("SelectSubBase", {
                      identifier,
                      password,
                      subBases,
                    })
                  }
                />
              )}
            </AuthStack.Screen>
            <AuthStack.Screen name="SelectSubBase">
              {({ route, navigation }) => (
                <SelectSubBaseScreen
                  identifier={route.params.identifier}
                  password={route.params.password}
                  subBases={route.params.subBases}
                  onSuccess={() => {}}
                  onMustChangePassword={() => setPendingChangePassword(true)}
                  onBack={() => navigation.goBack()}
                />
              )}
            </AuthStack.Screen>
          </AuthStack.Navigator>
        )}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
