import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

type SoundType = "success" | "error" | "warn";

const SOUND_URIS: Record<SoundType, string> = {
  success: "https://assets.mixkit.co/active_storage/sfx/2560-success.mp3",
  error: "https://assets.mixkit.co/active_storage/sfx/2568-error.mp3",
  warn: "https://assets.mixkit.co/active_storage/sfx/2570-warning-alert.mp3",
};

let cached: Partial<Record<SoundType, AudioPlayer>> = {};
let modeSet = false;

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

export async function playSound(type: SoundType): Promise<void> {
  try {
    await ensureMode();
    const uri = SOUND_URIS[type];
    let player = cached[type];
    if (!player) {
      // downloadFirst: false evita falha de download com URLs externas (CORS/rede) e usa streaming
      player = createAudioPlayer(uri, { downloadFirst: false });
      cached[type] = player;
    }
    await player.seekTo(0);
    player.play();
  } catch {
    // Ignore: sem rede, asset indisponível ou permissão
  }
}

export function playSoundSync(type: SoundType): void {
  playSound(type);
}
