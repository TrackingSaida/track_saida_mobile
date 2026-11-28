import * as FileSystem from "expo-file-system/legacy";
import { AppState, type AppStateStatus } from "react-native";

import { apiClient } from "../apiClient";
import { useAuthStore } from "../../store/authStore";
import { getDeviceTelemetrySnapshot, type DeviceTelemetryFields } from "./deviceSnapshot";

export type TelemetryEventName =
  | "saida_confirmada_client"
  | "pendentes_abertos"
  | "baixa_form_aberto"
  | "baixa_foto_capturada"
  | "baixa_foto_stage"
  | "baixa_confirm_tap"
  | "outbox_enqueued"
  | "outbox_sync_stage"
  | "app_foreground"
  | "device_snapshot";

type TelemetryTrackInput = {
  event_name: TelemetryEventName;
  client_action_id?: string | null;
  id_saida?: number | null;
  duration_ms?: number | null;
  stage?: string | null;
  props?: Record<string, unknown>;
};

type BufferedEvent = TelemetryTrackInput &
  Omit<DeviceTelemetryFields, "is_device"> & { event_at: string };

const ALLOWED_SUB_BASES = new Set(
  String(process.env.EXPO_PUBLIC_TELEMETRY_SUB_BASES || "GG FLEX")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase())
);

const TELEMETRY_ENABLED =
  String(process.env.EXPO_PUBLIC_TELEMETRY ?? "1").trim().toLowerCase() !== "0";

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_BATCH_SIZE = 40;
const MAX_BUFFER = 200;
const APP_FOREGROUND_MIN_INTERVAL_MS = 5 * 60_000;
const BUFFER_PATH = `${FileSystem.documentDirectory || ""}telemetry_buffer.json`;

let buffer: BufferedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let backoffMs = 2_000;
let started = false;
let deviceSnapshotSent = false;
let lastAppForegroundAt = 0;
let appStateSub: { remove: () => void } | null = null;

function currentSubBase(): string | null {
  const sub = useAuthStore.getState().currentUser?.sub_base;
  return typeof sub === "string" && sub.trim() ? sub.trim() : null;
}

function isTelemetryAllowed(): boolean {
  if (!TELEMETRY_ENABLED) return false;
  const sub = currentSubBase();
  if (!sub) return false;
  return ALLOWED_SUB_BASES.has(sub.toUpperCase());
}

async function persistBuffer(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  try {
    await FileSystem.writeAsStringAsync(
      BUFFER_PATH,
      JSON.stringify(buffer.slice(-MAX_BUFFER))
    );
  } catch {
    /* best-effort */
  }
}

async function hydrateBuffer(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  try {
    const info = await FileSystem.getInfoAsync(BUFFER_PATH);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(BUFFER_PATH);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      buffer = parsed.slice(-MAX_BUFFER) as BufferedEvent[];
    }
  } catch {
    /* ignore corrupt buffer */
  }
}

function scheduleFlush(delayMs = FLUSH_INTERVAL_MS): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetry();
  }, delayMs);
}

export async function trackTelemetry(input: TelemetryTrackInput): Promise<void> {
  if (!isTelemetryAllowed()) return;
  try {
    const device = await getDeviceTelemetrySnapshot();
    const { is_device, ...deviceFields } = device;
    buffer.push({
      ...input,
      ...deviceFields,
      props: {
        ...(input.props || {}),
        ...(typeof is_device === "boolean" ? { is_device } : {}),
      },
      event_at: new Date().toISOString(),
    });
    if (buffer.length > MAX_BUFFER) {
      buffer = buffer.slice(-MAX_BUFFER);
    }
    void persistBuffer();
    if (buffer.length >= FLUSH_BATCH_SIZE) {
      void flushTelemetry();
    } else {
      scheduleFlush();
    }
  } catch {
    /* never block UX */
  }
}

export async function flushTelemetry(): Promise<void> {
  if (flushing) return;
  if (!isTelemetryAllowed()) {
    buffer = [];
    void persistBuffer();
    return;
  }
  if (!buffer.length) return;
  if (!useAuthStore.getState().token) return;

  flushing = true;
  const batch = buffer.slice(0, FLUSH_BATCH_SIZE);
  try {
    await apiClient.post("/mobile/telemetry/events", {
      events: batch.map((ev) => ({
        event_name: ev.event_name,
        event_at: ev.event_at,
        client_action_id: ev.client_action_id ?? null,
        id_saida: ev.id_saida ?? null,
        duration_ms: ev.duration_ms ?? null,
        stage: ev.stage ?? null,
        app_version: ev.app_version,
        platform: ev.platform,
        device_brand: ev.device_brand,
        device_manufacturer: ev.device_manufacturer,
        device_model: ev.device_model,
        os_name: ev.os_name,
        os_version: ev.os_version,
        android_api_level: ev.android_api_level,
        device_total_memory_mb: ev.device_total_memory_mb,
        cpu_arch: ev.cpu_arch,
        props: ev.props ?? {},
      })),
    });
    buffer = buffer.slice(batch.length);
    backoffMs = 2_000;
    void persistBuffer();
    if (buffer.length) scheduleFlush(1_000);
  } catch {
    backoffMs = Math.min(backoffMs * 2, 60_000);
    scheduleFlush(backoffMs);
  } finally {
    flushing = false;
  }
}

async function maybeSendDeviceSnapshot(): Promise<void> {
  if (deviceSnapshotSent || !isTelemetryAllowed()) return;
  deviceSnapshotSent = true;
  await trackTelemetry({ event_name: "device_snapshot" });
  void flushTelemetry();
}

function onAppStateChange(state: AppStateStatus): void {
  if (state !== "active") return;
  const now = Date.now();
  if (now - lastAppForegroundAt < APP_FOREGROUND_MIN_INTERVAL_MS) return;
  lastAppForegroundAt = now;
  void trackTelemetry({ event_name: "app_foreground" });
  void flushTelemetry();
}

/** Inicia flush periódico + device_snapshot (GG FLEX). Idempotente. */
export function startTelemetryClient(): () => void {
  if (started) {
    return () => undefined;
  }
  started = true;
  void (async () => {
    await hydrateBuffer();
    await maybeSendDeviceSnapshot();
    if (buffer.length) void flushTelemetry();
  })();
  scheduleFlush();
  appStateSub = AppState.addEventListener("change", onAppStateChange);
  return () => {
    started = false;
    deviceSnapshotSent = false;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    appStateSub?.remove();
    appStateSub = null;
    void flushTelemetry();
  };
}

export { createClientActionId } from "../outbox/types";
