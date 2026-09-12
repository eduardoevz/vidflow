import { create } from 'zustand';
import { DEFAULT_SETTINGS, type AppSettings } from '../../shared/settings-types';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await window.vidflow.getSettings();
    set({ settings, loaded: true });
  },
  update: async (patch) => {
    const settings = await window.vidflow.updateSettings(patch);
    set({ settings });
  },
}));
