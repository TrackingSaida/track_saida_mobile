import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { playSound } from "../../utils/sound";
import { registerPushToken, unregisterPushToken } from "./pushApi";

const CHANNEL_DEFAULT = "default";
const CHANNEL_URGENT = "urgent";

let lastToken: string | null = null;
let listenersAttached = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
    name: "Geral",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    vibrationPattern: [0, 250, 120, 250],
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_URGENT, {
    name: "Avisos urgentes",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 400, 200, 400],
  });
}

export async function requestPushPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

export async function getExpoPushTokenSafe(): Promise<string | null> {
  try {
    await ensureChannels();
    const ok = await requestPushPermissions();
    if (!ok) return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResp.data || null;
  } catch {
    return null;
  }
}

export async function syncPushRegistration(): Promise<void> {
  const token = await getExpoPushTokenSafe();
  if (!token) return;
  lastToken = token;
  try {
    await registerPushToken(token, Platform.OS);
  } catch {
    // silencioso — não bloqueia login
  }
}

export async function unregisterPush(): Promise<void> {
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
  if (listenersAttached) {
    return () => undefined;
  }
  listenersAttached = true;

  const received = Notifications.addNotificationReceivedListener(() => {
    void playSound("warn");
  });

  const response = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data = (resp.notification.request.content.data || {}) as Record<string, unknown>;
    onNavigate(data);
  });

  return () => {
    received.remove();
    response.remove();
    listenersAttached = false;
  };
}

export async function getLastNotificationData(): Promise<Record<string, unknown> | null> {
  const last = await Notifications.getLastNotificationResponseAsync();
  if (!last) return null;
  return (last.notification.request.content.data || {}) as Record<string, unknown>;
}
