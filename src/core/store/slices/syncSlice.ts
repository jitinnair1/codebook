// src/core/store/slices/syncSlice.ts
import { StateCreator } from 'zustand/vanilla';
import { AppState, defaultGistSyncSettings, GistSyncSettings, SyncSlice } from '../../types';

export const createSyncSlice: StateCreator<AppState, [], [], SyncSlice> = (set, get) => ({
  gistSyncSettings: defaultGistSyncSettings,

  setGistSyncSettings: (newSettings: Partial<GistSyncSettings>) => {
    const current = get().gistSyncSettings || defaultGistSyncSettings;
    set({
      gistSyncSettings: {
        ...current,
        ...newSettings,
      },
    });
  },

  unlinkGist: () => {
    const current = get().gistSyncSettings || defaultGistSyncSettings;
    set({
      gistSyncSettings: {
        ...current,
        enabled: false,
        gistId: '',
        lastSyncedAt: undefined,
      },
    });
  },
});
