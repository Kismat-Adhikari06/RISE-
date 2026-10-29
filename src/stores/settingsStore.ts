import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../constants';
import { storage } from '../services/storage';
import type { Settings } from '../types';
import { sanitizeSettings } from '../utils/validation';

interface SettingsState {
  settings: Settings;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  replace: (s: Settings) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  async hydrate() {
    try {
      const saved = await storage.loadSettings();
      if (saved) set({ settings: sanitizeSettings(saved) });
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  },
  update(patch) {
    get().replace({ ...get().settings, ...patch });
  },
  replace(s) {
    set({ settings: s });
    storage.saveSettings(s).catch((e) => console.error('Failed to save settings', e));
  },
}));
