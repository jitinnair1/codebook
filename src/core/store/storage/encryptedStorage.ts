// src/core/store/storage/encryptedStorage.ts
import { StateStorage } from 'zustand/middleware';
import { encryptSecret } from '../../crypto';
import { ChatEndpoint } from '../../types';

export const syncStateStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      if (parsed?.state?.chatSettings) {
        const cs = parsed.state.chatSettings;
        if (!Array.isArray(cs.endpoints) || cs.endpoints.length === 0) {
          cs.endpoints = [
            {
              id: cs.selectedEndpointId || 'default-endpoint',
              name: cs.baseUrl?.includes('openai.com')
                ? 'OpenAI API'
                : (cs.baseUrl ? 'Custom Endpoint' : 'Endpoint 1'),
              baseUrl: cs.baseUrl || '',
              apiKey: cs.apiKey || '',
              model: cs.model || '',
            },
          ];
          cs.selectedEndpointId = cs.endpoints[0].id;
        }
      }

      return JSON.stringify(parsed);
    } catch {
      return localStorage.getItem(name);
    }
  },

  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.chatSettings) {
        // Asynchronously encrypt chat settings in background before writing to localStorage
        (async () => {
          try {
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
