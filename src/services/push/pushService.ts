import { AppState, Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { playSound } from "../../utils/sound";
import { registerPushToken, unregisterPushToken } from "./pushApi";

/** IDs alinhados ao backend — canais novos garantem importância HIGH + som no Android. */
const CHANNEL_DEFAULT = "avisos_geral";
const CHANNEL_URGENT = "avisos_urgente";

/**
 * Push remoto Android foi removido do Expo Go no SDK 53+.
 * Em Expo Go Android, não importamos/chamamos APIs de token para evitar o console.error do LogBox.
 */
const REMOTE_PUSH_UNSUPPORTED = isRunningInExpoGo() && Platform.OS === "android";

let lastToken: string | null = null;
let listenersAttached = false;
let notificationsModule: typeof import("expo-notifications") | null = null;
let handlerConfigured = false;
let syncInFlight: Promise<boolean> | null = null;
let appStateAttached = false;

async function getNotifications(): Promise<typeof import("expo-notifications") | null> {
  if (REMOTE_PUSH_UNSUPPORTED) return null;
  if (!notificationsModule) {
    notificationsModule = await import("expo-notifications");
    if (!handlerConfigured) {
      handlerConfigured = true;
      notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  }
  return notificationsModule;
}

async function ensureChannels(
  Notifications: typeof import("expo-notifications")
): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
    name: "Avisos e alertas",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 120, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_URGENT, {
    name: "Avisos urgentes",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
  });
}

export async function requestPushPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

export async function getExpoPushTokenSafe(): Promise<string | null> {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) {
      console.warn("[push] modulo indisponivel (Expo Go Android?)");
      return null;
    }
    await ensureChannels(Notifications);
    const ok = await requestPushPermissions();
    if (!ok) {
      console.warn("[push] permissao negada");
      return null;
    }
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      console.warn("[push] projectId EAS ausente — token Expo pode falhar");
    }
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResp.data || null;
    if (!token) console.warn("[push] getExpoPushTokenAsync retornou vazio");
    return token;
  } catch (e) {
    console.warn("[push] falha ao obter ExpoPushToken", e);
    return null;
  }
}

/**
 * Registra token no backend. Retorna true se registrou.
 * Faz retries — no Android o FCM/token pode demorar após conceder permissão.
 */
export async function syncPushRegistration(opts?: { attempts?: number }): Promise<boolean> {
  if (REMOTE_PUSH_UNSUPPORTED) {
    console.warn("[push] remoto nao suportado neste runtime");
    return false;
  }
  if (syncInFlight) return syncInFlight;

  const attempts = Math.max(1, opts?.attempts ?? 3);
  syncInFlight = (async () => {
    let lastErr: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const token = await getExpoPushTokenSafe();
        if (!token) {
          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
            continue;
          }
          console.warn("[push] sync abortado: sem token apos retries");
          return false;
        }
        lastToken = token;
        await registerPushToken(token, Platform.OS);
        console.warn("[push] register ok");
        return true;
      } catch (e) {
        lastErr = e;
        console.warn("[push] register falhou tentativa", i + 1, e);
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        }
      }
    }
    if (lastErr) console.warn("[push] sync falhou definitivamente", lastErr);
    return false;
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

/** Re-sincroniza ao voltar ao foreground (permissão concedida depois, FCM atrasado). */
export function ensurePushAppStateSync(): () => void {
  if (REMOTE_PUSH_UNSUPPORTED || appStateAttached) {
    return () => undefined;
  }
  appStateAttached = true;
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void syncPushRegistration({ attempts: 2 });
    }
  });
  return () => {
    sub.remove();
    appStateAttached = false;
  };
}

export async function unregisterPush(): Promise<void> {
  if (REMOTE_PUSH_UNSUPPORTED) {
    lastToken = null;
    return;
  }
  const token = lastToken || (await getExpoPushTokenSafe());
  if (!token) return;
  try {
    await unregisterPushToken(token);
  } catch {
    // ignore
  }
  lastToken = null;
}

export type PushNavHandler = (data: Record<string, unknown>) => void;

export function attachPushListeners(onNavigate: PushNavHandler): () => void {
  if (REMOTE_PUSH_UNSUPPORTED || listenersAttached) {
    return () => undefined;
  }
  listenersAttached = true;
  let detach: (() => void) | null = null;
  let cancelled = false;

  void getNotifications().then((Notifications) => {
    if (!Notifications || cancelled) {
      listenersAttached = false;
      return;
    }

    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = (notification.request.content.data || {}) as Record<string, unknown>;
      const tipo = String(data.type || "");
      // Sempre toca no foreground; avisos usam beep operacional
      void playSound(tipo === "aviso_urgente" ? "error" : "warn");
      if (tipo === "aviso_base" || tipo === "aviso_urgente") {
        void import("../../store/avisosUnreadStore").then(({ useAvisosUnreadStore }) => {
          void useAvisosUnreadStore.getState().refresh({ playOnIncrease: false });
        });
      }
    });

    const response = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = (resp.notification.request.content.data || {}) as Record<string, unknown>;
      onNavigate(data);
    });

    detach = () => {
      received.remove();
      response.remove();
      listenersAttached = false;
    };
  });

  return () => {
    cancelled = true;
    if (detach) detach();
    else listenersAttached = false;
  };
}

export async function getLastNotificationData(): Promise<Record<string, unknown> | null> {
  if (REMOTE_PUSH_UNSUPPORTED) return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  const last = await Notifications.getLastNotificationResponseAsync();
  if (!last) return null;
  return (last.notification.request.content.data || {}) as Record<string, unknown>;
}
