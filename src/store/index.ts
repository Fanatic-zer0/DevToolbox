import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface AppStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  recentTools: string[];
  addRecentTool: (id: string) => void;
  pinnedTools: string[];
  togglePin: (id: string) => void;
  cmdPaletteOpen: boolean;
  setCmdPaletteOpen: (v: boolean) => void;
  detectionInput: string;
  setDetectionInput: (v: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      recentTools: [],
      addRecentTool: (id) => {
        const recent = [id, ...get().recentTools.filter((r) => r !== id)].slice(0, 8);
        set({ recentTools: recent });
      },
      pinnedTools: [],
      togglePin: (id) => {
        const pinned = get().pinnedTools;
        set({ pinnedTools: pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id] });
      },
      cmdPaletteOpen: false,
      setCmdPaletteOpen: (cmdPaletteOpen) => set({ cmdPaletteOpen }),
      detectionInput: '',
      setDetectionInput: (detectionInput) => set({ detectionInput }),
    }),
    { name: 'devtoolbox-app' }
  )
);

export function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

// Tool preferences store
interface ToolPrefsStore {
  prefs: Record<string, Record<string, unknown>>;
  setPref: (toolId: string, key: string, value: unknown) => void;
  getPrefs: (toolId: string) => Record<string, unknown>;
}

export const useToolPrefsStore = create<ToolPrefsStore>()(
  persist(
    (set, get) => ({
      prefs: {},
      setPref: (toolId, key, value) => {
        const prefs = { ...get().prefs };
        prefs[toolId] = { ...(prefs[toolId] ?? {}), [key]: value };
        set({ prefs });
      },
      getPrefs: (toolId) => get().prefs[toolId] ?? {},
    }),
    { name: 'devtoolbox-prefs' }
  )
);

// PGP key store
export interface StoredPgpKey {
  id: string;
  fingerprint: string;
  keyId: string;
  userIds: string[];
  type: 'public' | 'private';
  armoredKey: string;
  createdAt: string;
  expiresAt?: string;
  algorithm?: string;
  capabilities: Array<'encrypt' | 'sign' | 'verify' | 'auth'>;
}

interface PgpKeyStore {
  keys: StoredPgpKey[];
  addKey: (key: StoredPgpKey) => void;
  removeKey: (id: string) => void;
}

export const usePgpKeyStore = create<PgpKeyStore>()(
  persist(
    (set, get) => ({
      keys: [],
      addKey: (key) => set({ keys: [...get().keys, key] }),
      removeKey: (id) => set({ keys: get().keys.filter((k) => k.id !== id) }),
    }),
    { name: 'devtoolbox-pgp-keys' }
  )
);
