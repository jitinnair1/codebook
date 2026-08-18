// src/core/store/storage/encryptedStorage.ts
import { StateStorage } from 'zustand/middleware';
import { encryptSecret } from '../../crypto';
import { ChatEndpoint } from '../../types';

export const syncStateStorage: StateStorage = {
  getItem: (name: string): string | null => {
    return localStorage.getItem(name);
  },

  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      const hasChatSettings = !!parsed?.state?.chatSettings;
      const hasSyncSettings = !!parsed?.state?.gistSyncSettings;

      if (hasChatSettings || hasSyncSettings) {
        // Asynchronously encrypt chat settings and sync token in background before writing to localStorage
        (async () => {
          try {
            if (hasChatSettings) {
              const cs = { ...parsed.state.chatSettings };
              if (cs.apiKey) {
                cs.apiKey = await encryptSecret(cs.apiKey);
              }
              if (Array.isArray(cs.endpoints)) {
                cs.endpoints = await Promise.all(
                  cs.endpoints.map(async (ep: ChatEndpoint) => ({
                    ...ep,
                    apiKey: ep.apiKey ? await encryptSecret(ep.apiKey) : '',
                  }))
                );
              }
              parsed.state.chatSettings = cs;
            }

            if (hasSyncSettings) {
              const ss = { ...parsed.state.gistSyncSettings };
              if (ss.token) {
                ss.token = await encryptSecret(ss.token);
              }
              parsed.state.gistSyncSettings = ss;
            }

            localStorage.setItem(name, JSON.stringify(parsed));
          } catch {
            localStorage.setItem(name, value);
          }
        })();
        return;
      }
      localStorage.setItem(name, value);
    } catch {
      localStorage.setItem(name, value);
    }
  },

  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};
