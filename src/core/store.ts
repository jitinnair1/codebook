import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppState } from './types';
import { createExerciseSlice } from './store/slices/exerciseSlice';
import { createChatSlice } from './store/slices/chatSlice';
import { createSettingsSlice } from './store/slices/settingsSlice';
import { createSyncSlice } from './store/slices/syncSlice';
import { getInitialProgressState, sanitizeBackupData } from './store/backup';
import { syncStateStorage } from './store/storage/encryptedStorage';
import { decryptStoredSettings } from './store/storage/decryptSettings';

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
      name: 'storage',
      storage: createJSONStorage(() => syncStateStorage),
    }
  )
);

export * from './types';
export { decryptStoredSettings };

