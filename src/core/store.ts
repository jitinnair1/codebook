import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppState } from './types';
import { createExerciseSlice } from './store/slices/exerciseSlice';
import { createChatSlice } from './store/slices/chatSlice';
import { createSettingsSlice } from './store/slices/settingsSlice';
import { createSyncSlice } from './store/slices/syncSlice';
import { getInitialProgressState, sanitizeBackupData } from './store/backup';
import { syncStateStorage } from './store/storage/encryptedStorage';
import { decryptStoredSettings, ensureSettingsDecrypted } from './store/storage/decryptSettings';
import { SITE_SLUG } from './siteConfig';

export const STORAGE_KEY = `${SITE_SLUG}_storage`;

export const store = createStore<AppState>()(
  persist(
    (set, get, api) => ({
      ...createExerciseSlice(set, get, api),
      ...createChatSlice(set, get, api),
      ...createSettingsSlice(set, get, api),
      ...createSyncSlice(set, get, api),

      resetProgress: () => {
        set(getInitialProgressState());
      },

      restoreBackup: (backupState) => {
        set(sanitizeBackupData(backupState, get()));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => syncStateStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const current = store.getState();
          const sanitized = sanitizeBackupData(state, current);
          store.setState(sanitized);
        }
      },
    }
  )
);

export * from './types';
export { decryptStoredSettings, ensureSettingsDecrypted };


