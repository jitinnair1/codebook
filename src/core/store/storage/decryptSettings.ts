// src/core/store/storage/decryptSettings.ts
import { StoreApi } from 'zustand/vanilla';
import { decryptSecret } from '../../crypto';
import { AppState } from '../../types';

let decryptionPromise: Promise<void> | null = null;

export function ensureSettingsDecrypted(storeApi?: StoreApi<AppState> | { getState: () => AppState }): Promise<void> {
  if (!decryptionPromise) {
    if (storeApi) {
      decryptionPromise = decryptStoredSettings(storeApi);
    } else {
      return Promise.resolve();
    }
  }
  return decryptionPromise;
}

export async function decryptStoredSettings(storeApi: StoreApi<AppState> | { getState: () => AppState }): Promise<void> {
  if (!decryptionPromise) {
    decryptionPromise = (async () => {
  // 1. Decrypt Chat Settings
  const currentChat = storeApi.getState().chatSettings;
  if (currentChat) {
    let needsChatUpdate = false;
    let decryptedApiKey = currentChat.apiKey;
    if (currentChat.apiKey && currentChat.apiKey.startsWith('enc:v1:')) {
      decryptedApiKey = await decryptSecret(currentChat.apiKey);
      needsChatUpdate = true;
    }

    let decryptedEndpoints = currentChat.endpoints;
    if (Array.isArray(currentChat.endpoints)) {
      const updated = await Promise.all(
        currentChat.endpoints.map(async (ep) => {
          if (ep.apiKey && ep.apiKey.startsWith('enc:v1:')) {
            needsChatUpdate = true;
            return { ...ep, apiKey: await decryptSecret(ep.apiKey) };
          }
          return ep;
        })
      );
      if (needsChatUpdate) {
        decryptedEndpoints = updated;
      }
    }

    if (needsChatUpdate) {
      storeApi.getState().setChatSettings({
        apiKey: decryptedApiKey,
        endpoints: decryptedEndpoints,
      });
    }
  }

  // 2. Decrypt Gist Sync Settings
  const currentSync = storeApi.getState().gistSyncSettings;
  if (currentSync?.token && currentSync.token.startsWith('enc:v1:')) {
    const decryptedToken = await decryptSecret(currentSync.token);
    storeApi.getState().setGistSyncSettings({
      token: decryptedToken,
    });
  }
    })();
  }
  return decryptionPromise;
}

