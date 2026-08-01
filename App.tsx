import "./src/services/location/backgroundLocationTask";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { initAudioSession } from "./src/utils/sound";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationContainer,
  DefaultTheme,
  type NavigatorScreenParams,
} from "@react-navigation/native";
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
import StaffHomeStack from "./src/navigation/StaffHomeStack";
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
};

export type AuthStackParamList = {
  Login: undefined;
  SelectSubBase: { identifier: string; password: string; subBases: string[] };
};

export type MainTabParamList = {
  Home: undefined;
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
            onNavigateDevolverPacotes={() => navigation.navigate("DevolverPacotes")}
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

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: profileTab.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: 6,
          paddingBottom: 8,
          minHeight: 58,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: isMotoboy ? "Home" : "Operação",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={isMotoboy ? "home-outline" : "briefcase-outline"} size={size ?? 24} color={color} />
          ),
        }}
      >
        {() =>
          isMotoboy ? (
            <HomeStackScreen onLogout={onLogout} />
          ) : (
            <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
              <StaffHomeStack />
            </SafeAreaView>
          )
        }
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
  const navigationRef = useRef<any>(null);

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
    void syncPushRegistration();
    const detach = attachPushListeners((data) => {
      navigateFromPushData(navigationRef.current, data);
    });
    void getLastNotificationData().then((data) => {
      if (data) navigateFromPushData(navigationRef.current, data);
    });
    return detach;
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
        <NavigationContainer ref={navigationRef} theme={navTheme}>
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
