import "./src/services/location/backgroundLocationTask";
import React, { useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { initAudioSession } from "./src/utils/sound";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "./src/store/authStore";
import { useDeliveryStore } from "./src/store/deliveryStore";
import { useThemeStore } from "./src/store/themeStore";
import { getColors, useThemeColors } from "./src/theme/colors";
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

function MaisStackScreen() {
  return (
    <MaisStack.Navigator screenOptions={{ headerShown: false }}>
      <MaisStack.Screen name="MaisInicio" component={MaisScreen} />
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: { backgroundColor: colors.tabBarBackground },
      }}
    >
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
        component={MaisStackScreen}
        options={{
          tabBarLabel: "Mais",
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size ?? 24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { token, isLoading, loadToken, requiresBiometricUnlock, logout: logoutFromStore } = useAuthStore();
  const theme = useThemeStore((s) => s.theme);
  const loadTheme = useThemeStore((s) => s.loadTheme);
  const [authDone, setAuthDone] = useState(false);
  const [pendingChangePassword, setPendingChangePassword] = useState<{ currentPassword: string } | null>(null);

  const logout = useCallback(async () => {
    useDeliveryStore.getState().clearActiveRouteState();
    await logoutFromStore();
    setAuthDone(false);
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
    useAuthStore.getState().setSessionExpiredCallback(() => {
      useDeliveryStore.getState().clearActiveRouteState();
      setAuthDone(false);
    });
    return () => {
      useAuthStore.getState().setSessionExpiredCallback(null);
    };
  }, []);

  if (isLoading) {
    return null;
  }

  const showMainApp = (token != null && !requiresBiometricUnlock) || authDone;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
        <StatusBar style={theme === "dark" ? "light" : "dark"} />
        {pendingChangePassword ? (
          <ChangePasswordRequiredScreen
            currentPassword={pendingChangePassword.currentPassword}
            onDone={() => setPendingChangePassword(null)}
          />
        ) : showMainApp ? (
          <MainTabs onLogout={logout} />
        ) : (
          <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen
                  onLoginSuccess={() => setAuthDone(true)}
                  onMustChangePassword={(currentPassword) => setPendingChangePassword({ currentPassword })}
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
                  onSuccess={() => setAuthDone(true)}
                  onMustChangePassword={(currentPassword) => setPendingChangePassword({ currentPassword })}
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
