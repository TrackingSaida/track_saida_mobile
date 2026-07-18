import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { LightSensor } from "expo-sensors";

export type ScannerTorchMode = "auto" | "on" | "off";

const DARK_ON_LUX = 12;
const DARK_OFF_LUX = 25;

export function useScannerTorch(active: boolean) {
  const [mode, setMode] = useState<ScannerTorchMode>("auto");
  const [cameraReady, setCameraReady] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const cycleMode = useCallback(() => {
    setMode((prev) => (prev === "auto" ? "on" : prev === "on" ? "off" : "auto"));
  }, []);

  const onCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  useEffect(() => {
    if (!active) {
      setCameraReady(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active || mode !== "auto" || Platform.OS !== "android") {
      setIsDark(false);
      return;
    }

    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const available = await LightSensor.isAvailableAsync();
        if (cancelled || !available) return;

        subscription = LightSensor.addListener(({ illuminance }) => {
          setIsDark((prev) => (prev ? illuminance < DARK_OFF_LUX : illuminance < DARK_ON_LUX));
        });
      } catch {
        // Sensor indisponível — usuário usa modo manual.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      setIsDark(false);
    };
  }, [active, mode]);

  const enableTorch = useMemo(() => {
    if (!active || !cameraReady) return false;
    if (mode === "on") return true;
    if (mode === "off") return false;
    return Platform.OS === "android" && isDark;
  }, [active, cameraReady, mode, isDark]);

  return { mode, cycleMode, enableTorch, onCameraReady };
}
