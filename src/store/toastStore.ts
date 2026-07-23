import { create } from "zustand";

export type ToastTone = "success" | "warn" | "info";

type ToastState = {
  visible: boolean;
  title: string;
  message: string;
  tone: ToastTone;
  show: (opts: { title: string; message?: string; tone?: ToastTone; durationMs?: number }) => void;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  title: "",
  message: "",
  tone: "success",

  show: ({ title, message = "", tone = "success", durationMs = 1600 }) => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    set({ visible: true, title, message, tone });
    hideTimer = setTimeout(() => {
      set({ visible: false });
      hideTimer = null;
    }, durationMs);
  },

  hide: () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    set({ visible: false });
  },
}));
