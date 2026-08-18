import { StateCreator } from 'zustand/vanilla';
import { AppState, ChatSettings, defaultChatSettings, SettingsSlice } from '../../types';
import { scheduleAutoPush } from '../../sync/syncManager';

/**
 * Pure helper function to synchronize chat settings and active endpoint fields.
 */
export function syncChatSettings(
  current: ChatSettings,
  newSettings: Partial<ChatSettings>
): ChatSettings {
  const updated: ChatSettings = {
    ...current,
    ...newSettings,
  };

  // If switching selected endpoint, pull its configuration into active fields
  if (newSettings.selectedEndpointId && newSettings.selectedEndpointId !== current.selectedEndpointId) {
    const target = updated.endpoints.find((e) => e.id === newSettings.selectedEndpointId);
    if (target) {
      updated.baseUrl = target.baseUrl;
      updated.apiKey = target.apiKey;
      updated.model = target.model;
    }
  } else {
    // If active fields changed, keep current endpoint in endpoints list in sync
    const activeIndex = updated.endpoints.findIndex((e) => e.id === updated.selectedEndpointId);
    if (activeIndex >= 0) {
      updated.endpoints[activeIndex] = {
        ...updated.endpoints[activeIndex],
        baseUrl: updated.baseUrl,
        apiKey: updated.apiKey,
        model: updated.model,
      };
    }
  }

  return updated;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set, get) => ({
  chatSettings: defaultChatSettings,

  setChatSettings: (newSettings: Partial<ChatSettings>) => {
    const current = get().chatSettings;
    set({ chatSettings: syncChatSettings(current, newSettings) });
    scheduleAutoPush();
  },
});
