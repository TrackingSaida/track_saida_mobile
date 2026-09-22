import "./src/services/location/backgroundLocationTask";
import React, { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { initAudioSession } from "./src/utils/sound";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { rootNavigationRef } from "./src/navigation/rootNavigation";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "./src/store/authStore";
import { useThemeStore } from "./src/store/themeStore";
import { useMotoboyPrefsStore } from "./src/store/motoboyPrefsStore";
import { getColors } from "./src/theme/colors";
import LoginScreen from "./src/screens/LoginScreen";
import SelectSubBaseScreen from "./src/screens/SelectSubBaseScreen";
import ChangePasswordRequiredScreen from "./src/screens/ChangePasswordRequiredScreen";
import { SessionExpiredModal } from "./src/components/SessionExpiredModal";
import PendingSyncBanner from "./src/components/PendingSyncBanner";
import OperationalToast from "./src/components/OperationalToast";
import { startSyncEngine } from "./src/services/outbox/syncEngine";
import { hydrateOutboxStore } from "./src/store/outboxStore";
import { ensureFreshAccessToken } from "./src/services/apiClient";
import { recoverRouteState } from "./src/features/entregas/services/routeRecovery";
import BackgroundLocationDisclosureModal from "./src/components/BackgroundLocationDisclosureModal";
import DiaRotaConcluidaModal from "./src/features/entregas/components/DiaRotaConcluidaModal";
import { isMotoboyRole } from "./src/utils/role";
import UrgentAvisoGate from "./src/features/avisos/components/UrgentAvisoGate";
import BirthdayGreetingGate from "./src/features/aniversario/BirthdayGreetingGate";
import InAppPhotoCaptureModal from "./src/components/InAppPhotoCaptureModal";
import PhotoDraftResumeGate from "./src/components/PhotoDraftResumeGate";
import {
  attachPushListeners,
  ensurePushAppStateSync,
  getLastNotificationData,
  syncPushRegistration,
} from "./src/services/push/pushService";
import { navigateFromPushData } from "./src/services/push/navigationFromPush";
import {
  consumePendingPush,
  enqueuePendingPush,
} from "./src/services/push/pendingPushNavigation";
import MotoboyRootNavigator from "./src/navigation/MotoboyNavigator";
import StaffNavigator from "./src/navigation/StaffNavigator";
import type { EntregasListInitialTab } from "./src/features/entregas/types";

export type { EntregasListInitialTab };
export type { RootStackParamList } from "./src/navigation/motoboyStackTypes";

export type AuthStackParamList = {
  Login: undefined;
  SelectSubBase: {
    identifier: string;
    password: string;
    subBases: string[];
    mode?: "motoboy" | "root";
  };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export default function App() {
  const { token, currentUser, isLoading, loadToken, requiresBiometricUnlock, logout: logoutFromStore } =
    useAuthStore();
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
    if (!isMotoboyRole(currentUser.role)) return;
    void ensureFreshAccessToken();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void ensureFreshAccessToken();
      }
    });
    return () => sub.remove();
  }, [token, currentUser, requiresBiometricUnlock]);

  useEffect(() => {
    if (!token || requiresBiometricUnlock || !currentUser) return;
    void syncPushRegistration({ attempts: 3 });
    const canFlushPush = () => {
      if (!rootNavigationRef.isReady()) return false;
      const name = rootNavigationRef.getCurrentRoute()?.name ?? "";
      return name !== "Login" && name !== "SelectSubBase";
    };
    const detachListeners = attachPushListeners((data) => {
      if (canFlushPush()) {
        navigateFromPushData(rootNavigationRef, data);
      } else {
        enqueuePendingPush(data);
      }
    });
    const detachAppState = ensurePushAppStateSync();
    const flushPending = () => {
      if (!canFlushPush()) return;
      const queued = consumePendingPush();
      if (queued) navigateFromPushData(rootNavigationRef, queued);
    };
    void getLastNotificationData().then((data) => {
      if (!data) {
        flushPending();
        return;
      }
      if (canFlushPush()) {
        navigateFromPushData(rootNavigationRef, data);
      } else {
        enqueuePendingPush(data);
      }
    });
    const readyPoll = setInterval(() => {
      if (canFlushPush()) {
        clearInterval(readyPoll);
        flushPending();
      }
    }, 250);
    return () => {
      clearInterval(readyPoll);
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
  const motoboy = isMotoboyRole(currentUser?.role);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={rootNavigationRef}
          theme={navTheme}
          onReady={() => {
            const name = rootNavigationRef.getCurrentRoute()?.name ?? "";
            if (name === "Login" || name === "SelectSubBase") return;
            const queued = consumePendingPush();
            if (queued) navigateFromPushData(rootNavigationRef, queued);
          }}
        >
          <StatusBar style={theme === "dark" ? "light" : "dark"} />
          {pendingChangePassword ? (
            <ChangePasswordRequiredScreen onDone={() => setPendingChangePassword(false)} />
          ) : showMainApp ? (
            <View style={{ flex: 1 }}>
              <PendingSyncBanner />
              <View style={{ flex: 1 }}>
                {motoboy ? (
                  <MotoboyRootNavigator onLogout={logout} />
                ) : (
                  <StaffNavigator onLogout={logout} />
                )}
              </View>
              <BirthdayGreetingGate />
              <UrgentAvisoGate />
              <PhotoDraftResumeGate />
              <InAppPhotoCaptureModal />
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
                    onSelectSubBase={(identifier, password, subBases, mode) =>
                      navigation.navigate("SelectSubBase", {
                        identifier,
                        password,
                        subBases,
                        mode: mode || "motoboy",
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
                    mode={route.params.mode || "motoboy"}
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
