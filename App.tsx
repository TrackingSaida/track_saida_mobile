import "./src/services/location/backgroundLocationTask";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { initAudioSession } from "./src/utils/sound";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "./src/store/authStore";
import { useDeliveryStore } from "./src/store/deliveryStore";
import { useThemeStore } from "./src/store/themeStore";
import { useMotoboyPrefsStore } from "./src/store/motoboyPrefsStore";
import { getColors, useThemeColors } from "./src/theme/colors";
import { getProfileThemeColors } from "./src/theme/profileTheme";
import LoginScreen from "./src/screens/LoginScreen";
import SelectSubBaseScreen from "./src/screens/SelectSubBaseScreen";
import ChangePasswordRequiredScreen from "./src/screens/ChangePasswordRequiredScreen";
import HomeScreen from "./src/screens/HomeScreen";
import MaisScreen, { type MaisStackParamList } from "./src/screens/MaisScreen";
import MeusDadosScreen from "./src/screens/MeusDadosScreen";
import PreferenciaScreen from "./src/screens/PreferenciaScreen";
import EntregasListScreen from "./src/features/entregas/screens/EntregasListScreen";
import EntregaDetailScreen from "./src/features/entregas/screens/EntregaDetailScreen";
import ScanScreen from "./src/features/entregas/screens/ScanScreen";
import PrepareDeliveriesScreen from "./src/features/entregas/screens/PrepareDeliveriesScreen";
import RouteBuilderScreen from "./src/screens/RouteBuilderScreen";
import MinhasEntregasScreen from "./src/features/entregas/screens/MinhasEntregasScreen";
import MinhasEntregasDiaScreen from "./src/features/entregas/screens/MinhasEntregasDiaScreen";
import StaffHomeStack from "./src/navigation/StaffHomeStack";
import { isMotoboyRole } from "./src/utils/role";

export type RootStackParamList = {
  HomeInicio: undefined;
  EntregasList: undefined;
  EntregaDetail: { idSaida: number };
  Scan: undefined;
  PrepareDeliveries: undefined;
  RouteBuilder: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SelectSubBase: { identifier: string; password: string; subBases: string[] };
};

export type MainTabParamList = {
  Home: undefined;
  Mais: undefined;
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
            onLogout={onLogout}
            onNavigateEntregas={() => navigation.navigate("EntregasList")}
            onNavigateScan={() => navigation.navigate("Scan")}
            onNavigateRouteBuilder={() => navigation.navigate("RouteBuilder")}
          />
        )}
      </HomeStack.Screen>
      <HomeStack.Screen name="EntregasList" component={EntregasListScreen} />
      <HomeStack.Screen name="EntregaDetail" component={EntregaDetailScreen} />
      <HomeStack.Screen name="Scan" component={ScanScreen} />
      <HomeStack.Screen name="PrepareDeliveries" component={PrepareDeliveriesScreen} />
      <HomeStack.Screen name="RouteBuilder" component={RouteBuilderScreen} />
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
      <MaisStack.Screen name="Preferencia" component={PreferenciaScreen} />
      <MaisStack.Screen name="MinhasEntregas" component={MinhasEntregasScreen} />
      <MaisStack.Screen name="MinhasEntregasDia" component={MinhasEntregasDiaScreen} />
      <MaisStack.Screen name="EntregaDetail" component={EntregaDetailScreen} />
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
    useDeliveryStore.getState().clearActiveRouteState();
    await logoutFromStore();
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
      useDeliveryStore.getState().clearActiveRouteState();
    });
    return () => {
      useAuthStore.getState().setSessionExpiredCallback(null);
    };
  }, []);

  if (isLoading) {
    return null;
  }

  const showMainApp = token != null && !requiresBiometricUnlock;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
        <StatusBar style={theme === "dark" ? "light" : "dark"} />
        {pendingChangePassword ? (
          <ChangePasswordRequiredScreen onDone={() => setPendingChangePassword(false)} />
        ) : showMainApp ? (
          <MainTabs onLogout={logout} />
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
