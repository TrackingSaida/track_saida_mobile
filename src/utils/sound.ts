import * as FileSystem from "expo-file-system";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { generateBeepWav } from "./beepWav";

type SoundType = "success" | "error" | "warn";

/** Mapeamento para os mesmos sons do front (leituras saídas/coletas): ok, err, warn */
const BEEP_KIND: Record<SoundType, "ok" | "warn" | "err"> = {
  success: "ok",
  error: "err",
  warn: "warn",
};

const BEEP_FILES: Record<SoundType, string> = {
  success: "beep_ok.wav",
  error: "beep_err.wav",
  warn: "beep_warn.wav",
};

let cached: Partial<Record<SoundType, AudioPlayer>> = {};
let fileUris: Partial<Record<SoundType, string>> = {};
let modeSet = false;

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += BASE64_ALPHABET[a >>> 2];
    out += BASE64_ALPHABET[((a & 3) << 4) | (b >>> 4)];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[((b & 15) << 2) | (c >>> 6)] : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET[c & 63] : "=";
  }
  return out;
}

async function ensureMode(): Promise<void> {
  if (modeSet) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
      allowsRecording: false,
    });
    modeSet = true;
  } catch {
    modeSet = true;
  }
}

async function getBeepUri(type: SoundType): Promise<string> {
  const existing = fileUris[type];
  if (existing) return existing;

  const kind = BEEP_KIND[type];
  const wav = generateBeepWav(kind);
  const base64 = arrayBufferToBase64(wav);
  const dir = FileSystem.cacheDirectory ?? "";
  const filename = BEEP_FILES[type];
  const path = dir.endsWith("/") ? `${dir}${filename}` : `${dir}/${filename}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const uri = path.startsWith("file://") ? path : `file://${path}`;
  fileUris[type] = uri;
  return uri;
}

export async function playSound(type: SoundType): Promise<void> {
  try {
    await ensureMode();
    const uri = await getBeepUri(type);
    let player = cached[type];
    if (!player) {
      player = createAudioPlayer(uri, { downloadFirst: true });
      cached[type] = player;
    }
    await player.seekTo(0);
    player.play();
  } catch {
    // Ignore: permissão ou áudio indisponível
  }
}

export function playSoundSync(type: SoundType): void {
  playSound(type);
}
