import { Audio } from "expo-av";

type SoundType = "success" | "error";

const SOUND_URIS: Record<SoundType, string> = {
  success: "https://assets.mixkit.co/active_storage/sfx/2560-success.mp3",
  error: "https://assets.mixkit.co/active_storage/sfx/2568-error.mp3",
};

let cached: Partial<Record<SoundType, Awaited<ReturnType<typeof Audio.Sound.createAsync>>["sound"]>> = {};
let modeSet = false;

async function ensureMode(): Promise<void> {
  if (modeSet) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
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
    let sound = cached[type];
    if (!sound) {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      sound = s;
      cached[type] = sound;
    }
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Ignore: sem rede, asset indisponível ou permissão
  }
}

export function playSoundSync(type: SoundType): void {
  playSound(type);
}
