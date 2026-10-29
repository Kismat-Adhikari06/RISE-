import { create } from 'zustand';
import type { ObjectScanConfig } from '../types';

export type Tab = 'alarms' | 'insights' | 'settings';
export type Overlay =
  | { name: 'editor'; alarmId: string | null }
  | { name: 'nightstand' }
  | { name: 'scannerTest'; config: ObjectScanConfig }
  | null;

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface UIState {
  tab: Tab;
  overlay: Overlay;
  toasts: Toast[];
  setTab: (t: Tab) => void;
  open: (o: Exclude<Overlay, null>) => void;
  close: () => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  tab: 'alarms',
  overlay: null,
  toasts: [],
  setTab: (tab) => set({ tab }),
  open: (overlay) => set({ overlay }),
  close: () => set({ overlay: null }),
  toast(message, tone = 'success') {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
