// src/core/backup/modules/settingsModule.ts
import { AppState, ChatSettings, GistSyncSettings, defaultChatSettings, defaultGistSyncSettings } from '../../types';
import { decryptSecret } from '../../crypto';
import { BackupModule, ExportOptions, SettingsPayload } from '../types';

export async function exportSettings(
  state: AppState,
  options?: ExportOptions
): Promise<SettingsPayload> {
  const includeKeys = !!options?.includeKeys;

  // Clone chat settings
  const rawChat = state.chatSettings || defaultChatSettings;
  let chatSettings: ChatSettings = {
    ...rawChat,
    endpoints: (rawChat.endpoints || []).map((ep) => ({ ...ep })),
  };

  if (!includeKeys) {
    chatSettings.apiKey = '';
    chatSettings.endpoints = chatSettings.endpoints.map((ep) => ({
      ...ep,
      apiKey: '',
    }));
  } else {
    chatSettings.apiKey = await decryptSecret(chatSettings.apiKey || '');
    chatSettings.endpoints = await Promise.all(
      chatSettings.endpoints.map(async (ep) => ({
        ...ep,
        apiKey: await decryptSecret(ep.apiKey || ''),
      }))
    );
  }

  // Clone Gist sync settings
  const rawSync = state.gistSyncSettings || defaultGistSyncSettings;
  let gistSyncSettings: GistSyncSettings = {
    ...rawSync,
    token: '',
  };

  if (includeKeys && rawSync.token) {
    gistSyncSettings.token = await decryptSecret(rawSync.token);
  }

  return {
    vimMode: !!state.vimMode,
    chatSettings,
    gistSyncSettings,
  };
}

export function sanitizeSettings(raw: unknown, current: AppState): Partial<AppState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const payload = raw as any;

  const hasSettingsData =
    typeof payload.vimMode === 'boolean' ||
    (payload.editor && typeof payload.editor === 'object') ||
    (payload.chatSettings && typeof payload.chatSettings === 'object') ||
    (payload.gistSyncSettings && typeof payload.gistSyncSettings === 'object');

  if (!hasSettingsData) {
    return {};
  }

  let restoredVimMode = current.vimMode;
  if (typeof payload.vimMode === 'boolean') {
    restoredVimMode = payload.vimMode;
  } else if (payload.editor && typeof payload.editor === 'object' && typeof payload.editor.vimMode === 'boolean') {
    restoredVimMode = payload.editor.vimMode;
  }

  let restoredChatSettings = current.chatSettings || defaultChatSettings;
  if (payload.chatSettings && typeof payload.chatSettings === 'object') {
    const rawCs = payload.chatSettings;
    const endpoints = Array.isArray(rawCs.endpoints)
      ? rawCs.endpoints.map((ep: any) => ({
          id: String(ep.id || 'default-endpoint'),
          name: ep.name ? String(ep.name) : undefined,
          baseUrl: String(ep.baseUrl || ''),
          apiKey: String(ep.apiKey || ''),
          model: String(ep.model || ''),
        }))
      : defaultChatSettings.endpoints;

    restoredChatSettings = {
      enabled: typeof rawCs.enabled === 'boolean' ? rawCs.enabled : defaultChatSettings.enabled,
      baseUrl: typeof rawCs.baseUrl === 'string' ? rawCs.baseUrl : defaultChatSettings.baseUrl,
      apiKey: typeof rawCs.apiKey === 'string' ? rawCs.apiKey : defaultChatSettings.apiKey,
      model: typeof rawCs.model === 'string' ? rawCs.model : defaultChatSettings.model,
      selectedEndpointId:
        typeof rawCs.selectedEndpointId === 'string'
          ? rawCs.selectedEndpointId
          : (endpoints[0]?.id || 'default-endpoint'),
      endpoints,
    };
  }

  let restoredGistSyncSettings = current.gistSyncSettings || defaultGistSyncSettings;
  if (payload.gistSyncSettings && typeof payload.gistSyncSettings === 'object') {
    const rawSync = payload.gistSyncSettings;
    restoredGistSyncSettings = {
      enabled: typeof rawSync.enabled === 'boolean' ? rawSync.enabled : restoredGistSyncSettings.enabled,
      token: (typeof rawSync.token === 'string' && rawSync.token.trim()) ? rawSync.token.trim() : (restoredGistSyncSettings.token || ''),
      gistId: typeof rawSync.gistId === 'string' ? rawSync.gistId.trim() : (restoredGistSyncSettings.gistId || ''),
      autoSync: typeof rawSync.autoSync === 'boolean' ? rawSync.autoSync : (restoredGistSyncSettings.autoSync !== false),
      lastSyncedAt: typeof rawSync.lastSyncedAt === 'number' ? rawSync.lastSyncedAt : restoredGistSyncSettings.lastSyncedAt,
    };
  }

  return {
    vimMode: restoredVimMode,
    chatSettings: restoredChatSettings,
    gistSyncSettings: restoredGistSyncSettings,
  };
}

export function mergeSettings(local: AppState, remote: SettingsPayload | any): Partial<AppState> {
  const localChat = local.chatSettings || defaultChatSettings;
  const remoteChat = remote.chatSettings || defaultChatSettings;

  // Preserve local API keys if remote keys are empty/stripped
  const mergedEndpoints = (remoteChat.endpoints || []).map((remEp: any) => {
    const matchingLocal = localChat.endpoints?.find((locEp) => locEp.id === remEp.id);
    return {
      ...remEp,
      apiKey: remEp.apiKey || matchingLocal?.apiKey || '',
    };
  });

  const mergedChatSettings: ChatSettings = {
    ...remoteChat,
    apiKey: remoteChat.apiKey || localChat.apiKey || '',
    endpoints: mergedEndpoints.length > 0 ? mergedEndpoints : localChat.endpoints,
  };

  const localSync = local.gistSyncSettings || defaultGistSyncSettings;
  const remoteSync = remote.gistSyncSettings || defaultGistSyncSettings;

  const mergedSyncSettings: GistSyncSettings = {
    ...remoteSync,
    token: remoteSync.token || localSync.token || '',
    gistId: remoteSync.gistId || localSync.gistId || '',
    enabled: typeof remoteSync.enabled === 'boolean' ? remoteSync.enabled : localSync.enabled,
    autoSync: typeof remoteSync.autoSync === 'boolean' ? remoteSync.autoSync : localSync.autoSync,
  };

  const remoteVimMode =
    typeof (remote as any).vimMode === 'boolean'
      ? (remote as any).vimMode
      : remote.editor && typeof remote.editor.vimMode === 'boolean'
      ? remote.editor.vimMode
      : local.vimMode;

  return {
    vimMode: remoteVimMode,
    chatSettings: mergedChatSettings,
    gistSyncSettings: mergedSyncSettings,
  };
}

export const settingsModule: BackupModule<SettingsPayload> = {
  id: 'settings',
  filename: 'settings.json',
  exportData: (state, options) => exportSettings(state, options),
  sanitizeData: (raw, current) => sanitizeSettings(raw, current),
  mergeData: (local, remote) => mergeSettings(local, remote),
};
