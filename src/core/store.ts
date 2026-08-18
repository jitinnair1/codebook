// src/core/store.ts
import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppState } from './types';
import { createExerciseSlice } from './store/slices/exerciseSlice';
import { createChatSlice } from './store/slices/chatSlice';
import { createSettingsSlice } from './store/slices/settingsSlice';
import { getInitialProgressState, sanitizeBackupData } from './store/backup';
import { syncStateStorage } from './store/storage/encryptedStorage';
import { decryptStoredChatSettings } from './store/storage/decryptSettings';

export const store = createStore<AppState>()(
  persist(
    (set, get, api) => ({
      ...createExerciseSlice(set, get, api),
      ...createChatSlice(set, get, api),
      ...createSettingsSlice(set, get, api),

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

// Re-export all types and bootstrap helpers for complete backward compatibility
export * from './types';
export { decryptStoredChatSettings };
