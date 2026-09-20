import { create } from "zustand";
import type { PendingCaptureScope, PhotoPickResult } from "../services/photoFlowUtils";
import { CAMERA_HARDWARE_RELEASE_MS } from "../services/photoFlowUtils";

type PendingCapture = {
  resolve: (result: PhotoPickResult | null) => void;
};

let pending: PendingCapture | null = null;
let captureScope: PendingCaptureScope | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

type PhotoCaptureState = {
  /** Scanners devem desmontar o CameraView enquanto isto for true. */
  hardwareBusy: boolean;
  /** Overlay de captura in-app visível. */
  modalVisible: boolean;
  requestCapture: (scope?: PendingCaptureScope) => Promise<PhotoPickResult | null>;
  complete: (result: PhotoPickResult | null) => void;
  releaseHardware: () => void;
  getCaptureScope: () => PendingCaptureScope | null;
};

export const usePhotoCaptureStore = create<PhotoCaptureState>((set) => ({
  hardwareBusy: false,
  modalVisible: false,

  requestCapture: (scope) => {
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    if (pending) {
      const previous = pending;
      pending = null;
      previous.resolve(null);
    }
    captureScope = scope ?? null;
    return new Promise<PhotoPickResult | null>((resolve) => {
      pending = { resolve };
      set({ hardwareBusy: true, modalVisible: true });
    });
  },

  complete: (result) => {
    const current = pending;
    pending = null;
    captureScope = null;
    set({ modalVisible: false });
    current?.resolve(result);
  },

  getCaptureScope: () => captureScope,

  releaseHardware: () => {
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      set({ hardwareBusy: false });
    }, CAMERA_HARDWARE_RELEASE_MS);
  },
}));

export function isPhotoCaptureActive(): boolean {
  const state = usePhotoCaptureStore.getState();
  return state.hardwareBusy || state.modalVisible;
}
