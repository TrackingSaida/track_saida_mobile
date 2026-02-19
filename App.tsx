import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "./src/store/authStore";
import LoginScreen from "./src/screens/LoginScreen";
import SelectSubBaseScreen from "./src/screens/SelectSubBaseScreen";
import HomeScreen from "./src/screens/HomeScreen";
import EntregasListScreen from "./src/features/entregas/screens/EntregasListScreen";
import EntregaDetailScreen from "./src/features/entregas/screens/EntregaDetailScreen";
import ScanScreen from "./src/features/entregas/screens/ScanScreen";
import PrepareDeliveriesScreen from "./src/features/entregas/screens/PrepareDeliveriesScreen";

export type RootStackParamList = {
  Login: undefined;
  SelectSubBase: { identifier: string; password: string; subBases: string[] };
  Home: undefined;
  EntregasList: undefined;
  EntregaDetail: { idSaida: number };
  Scan: undefined;
  PrepareDeliveries: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { token, isLoading, loadToken, logout } = useAuthStore();

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  if (isLoading) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Home">
              {({ navigation }) => (
                <HomeScreen
                  onLogout={logout}
                  onNavigateEntregas={() => navigation.navigate("EntregasList")}
                  onNavigateScan={() => navigation.navigate("Scan")}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="EntregasList" component={EntregasListScreen} />
            <Stack.Screen name="EntregaDetail" component={EntregaDetailScreen} />
            <Stack.Screen name="Scan" component={ScanScreen} />
            <Stack.Screen name="PrepareDeliveries" component={PrepareDeliveriesScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login">
              {({ navigation }) => (
                <LoginScreen
                  onLoginSuccess={() => {}}
                  onSelectSubBase={(identifier, password, subBases) =>
                    navigation.navigate("SelectSubBase", {
                      identifier,
                      password,
                      subBases,
                    })
                  }
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="SelectSubBase">
              {({ route, navigation }) => (
                <SelectSubBaseScreen
                  identifier={route.params.identifier}
                  password={route.params.password}
                  subBases={route.params.subBases}
                  onSuccess={() => {}}
                  onBack={() => navigation.goBack()}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
