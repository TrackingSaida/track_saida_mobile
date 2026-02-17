import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "./src/store/authStore";
import LoginScreen from "./src/screens/LoginScreen";
import SelectSubBaseScreen from "./src/screens/SelectSubBaseScreen";
import HomeScreen from "./src/screens/HomeScreen";

export type RootStackParamList = {
  Login: undefined;
  SelectSubBase: { identifier: string; password: string; subBases: string[] };
  Home: undefined;
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
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Home">
            {() => <HomeScreen onLogout={logout} />}
          </Stack.Screen>
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
  );
}
