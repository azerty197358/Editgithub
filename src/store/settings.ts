import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, Provider } from '@/types';

const DEFAULTS: Settings = {
  provider: 'openrouter',
  openrouterKey: '',
  geminiKey: '',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  githubToken: '',
  model: '',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};

interface SettingsStore {
  settings: Settings;
  set: (patch: Partial<Settings>) => void;
  setProvider: (p: Provider) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: { ...DEFAULTS },
      set: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setProvider: (p) => set((s) => ({ settings: { ...s.settings, provider: p } })),
      reset: () => set({ settings: { ...DEFAULTS } }),
    }),
    { name: 'opencode-settings' }
  )
);
