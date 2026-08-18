// src/core/store/backup.ts
import { exercises } from '../../exercises/exercise-registry';
import { AppState, defaultChatSettings, defaultGistSyncSettings } from '../types';

/**
 * Returns the reset state for user progress while keeping settings intact.
 */
export function getInitialProgressState(): Partial<AppState> {
  return {
    completedIds: [],
    userCode: {},
    chatConversations: {},
    activeConversationId: {},
    currentExerciseId: exercises[0]?.id || '1.1',
  };
}

/**
 * Validates and sanitizes a raw backup state payload.
 */
export function sanitizeBackupData(
  backupState: Partial<AppState>,
  current: AppState
): Partial<AppState> {
  let restoredChatSettings = current.chatSettings;
  if (backupState.chatSettings && typeof backupState.chatSettings === 'object') {
    const rawCs = backupState.chatSettings;
    const endpoints = Array.isArray(rawCs.endpoints)
      ? rawCs.endpoints.map((ep) => ({
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

  let restoredConvs = current.chatConversations;
  let restoredActive = current.activeConversationId;

  if (backupState.chatConversations && typeof backupState.chatConversations === 'object') {
    restoredConvs = backupState.chatConversations;
    if (backupState.activeConversationId && typeof backupState.activeConversationId === 'object') {
      restoredActive = backupState.activeConversationId;
    }
  }

  let restoredGistSyncSettings = current.gistSyncSettings || defaultGistSyncSettings;
  if (backupState.gistSyncSettings && typeof backupState.gistSyncSettings === 'object') {
    const rawSync = backupState.gistSyncSettings;
    restoredGistSyncSettings = {
      enabled: typeof rawSync.enabled === 'boolean' ? rawSync.enabled : restoredGistSyncSettings.enabled,
      token: (typeof rawSync.token === 'string' && rawSync.token.trim()) ? rawSync.token.trim() : (restoredGistSyncSettings.token || ''),
      gistId: typeof rawSync.gistId === 'string' ? rawSync.gistId.trim() : (restoredGistSyncSettings.gistId || ''),
      autoSync: typeof rawSync.autoSync === 'boolean' ? rawSync.autoSync : (restoredGistSyncSettings.autoSync !== false),
      lastSyncedAt: typeof rawSync.lastSyncedAt === 'number' ? rawSync.lastSyncedAt : restoredGistSyncSettings.lastSyncedAt,
    };
  }

  return {
    currentExerciseId:
      typeof backupState.currentExerciseId === 'string'
        ? backupState.currentExerciseId
        : current.currentExerciseId,
    currentLanguageId:
      typeof backupState.currentLanguageId === 'string'
        ? backupState.currentLanguageId
        : current.currentLanguageId,
    completedIds: Array.isArray(backupState.completedIds)
      ? backupState.completedIds.filter((id) => typeof id === 'string')
      : current.completedIds,
    userCode:
      backupState.userCode && typeof backupState.userCode === 'object'
        ? backupState.userCode
        : current.userCode,
    vimMode:
      typeof backupState.vimMode === 'boolean'
        ? backupState.vimMode
        : current.vimMode,
    chatSettings: restoredChatSettings,
    chatConversations: restoredConvs,
    activeConversationId: restoredActive,
    gistSyncSettings: restoredGistSyncSettings,
  };
}
