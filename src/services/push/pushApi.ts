import { apiClient } from "../apiClient";

export type NotifPrefs = {
  fechamento: boolean;
  pacotes_atribuidos: boolean;
  atraso_d1: boolean;
  avisos_base: boolean;
  reconferir_saida: boolean;
};

export async function registerPushToken(expoPushToken: string, platform?: string): Promise<void> {
  await apiClient.post("/mobile/push/register", {
    expo_push_token: expoPushToken,
    platform: platform || undefined,
  });
}

export async function unregisterPushToken(expoPushToken: string): Promise<void> {
  await apiClient.post("/mobile/push/unregister", {
    expo_push_token: expoPushToken,
  });
}

export async function getNotifPrefs(): Promise<NotifPrefs> {
  const { data } = await apiClient.get<NotifPrefs>("/mobile/push/preferencias");
  return data;
}

export async function patchNotifPrefs(patch: Partial<NotifPrefs>): Promise<NotifPrefs> {
  const { data } = await apiClient.patch<NotifPrefs>("/mobile/push/preferencias", patch);
  return data;
}
