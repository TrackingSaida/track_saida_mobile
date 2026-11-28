import { create } from "zustand";
import type {
  PendingCaptureScope,
  TakePhotoResult,
} from "../services/photoFlowUtils";
import { CAMERA_HARDWARE_RELEASE_MS } from "../services/photoFlowUtils";

type PendingCapture = {
  resolve: (result: TakePhotoResult) => void;
};

let pending: PendingCapture | null = null;
let captureScope: PendingCaptureScope | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

type PhotoCaptureState = {
  /** Scanners devem desmontar o CameraView enquanto isto for true. */
  hardwareBusy: boolean;
  /** Overlay de captura in-app visível. */
  modalVisible: boolean;
  /** Persist + prepare em andamento (overlay "Processando foto…"). */
  processing: boolean;
  requestCapture: (scope?: PendingCaptureScope) => Promise<TakePhotoResult>;
  complete: (result: TakePhotoResult) => void;
  setProcessing: (value: boolean) => void;
  releaseHardware: () => void;
  getCaptureScope: () => PendingCaptureScope | null;
};

export const usePhotoCaptureStore = create<PhotoCaptureState>((set) => ({
  hardwareBusy: false,
  modalVisible: false,
  processing: false,

  requestCapture: (scope) => {
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    if (pending) {
      const previous = pending;
      pending = null;
      previous.resolve({ ok: false, reason: "cancel" });
    }
    captureScope = scope ?? null;
    return new Promise<TakePhotoResult>((resolve) => {
      pending = { resolve };
      set({ hardwareBusy: true, modalVisible: true, processing: false });
    });
  },

  complete: (result) => {
    const current = pending;
    pending = null;
    captureScope = null;
    set({ modalVisible: false, processing: false });
    current?.resolve(result);
  },

  setProcessing: (value) => set({ processing: value }),

  getCaptureScope: () => captureScope,

  releaseHardware: () => {
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      set({ hardwareBusy: false });
      // Retoma a fila após liberar a câmera (PRD-014).
      void import("../services/outbox/syncEngine")
        .then((m) => m.processOutboxQueue())
        .catch(() => {});
    }, CAMERA_HARDWARE_RELEASE_MS);
  },
}));

export function isPhotoCaptureActive(): boolean {
  const state = usePhotoCaptureStore.getState();
  return state.hardwareBusy || state.modalVisible;
}
