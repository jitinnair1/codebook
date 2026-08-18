// src/core/store/storage/decryptSettings.ts
import { StoreApi } from 'zustand/vanilla';
import { decryptSecret } from '../../crypto';
import { AppState } from '../../types';

export async function decryptStoredChatSettings(storeApi: StoreApi<AppState> | { getState: () => AppState }): Promise<void> {
  const current = storeApi.getState().chatSettings;
  if (!current) return;

  let needsUpdate = false;
  let decryptedApiKey = current.apiKey;
  if (current.apiKey && current.apiKey.startsWith('enc:v1:')) {
    decryptedApiKey = await decryptSecret(current.apiKey);
    needsUpdate = true;
  }

  let decryptedEndpoints = current.endpoints;
  if (Array.isArray(current.endpoints)) {
    const updated = await Promise.all(
      current.endpoints.map(async (ep) => {
        if (ep.apiKey && ep.apiKey.startsWith('enc:v1:')) {
          needsUpdate = true;
          return { ...ep, apiKey: await decryptSecret(ep.apiKey) };
        }
        return ep;
      })
    );
    if (needsUpdate) {
      decryptedEndpoints = updated;
    }
  }

  if (needsUpdate) {
    storeApi.getState().setChatSettings({
      apiKey: decryptedApiKey,
      endpoints: decryptedEndpoints,
    });
  }
}
