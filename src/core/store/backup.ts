// src/core/store/backup.ts
import { exercises } from '../../exercises/exercise-registry';
import { AppState, ChatConversation, ChatMessage, defaultChatSettings } from '../types';

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
 * Validates and sanitizes a raw backup state payload, handling backward compatibility.
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
  } else if ((backupState as any).chatHistory && typeof (backupState as any).chatHistory === 'object') {
    // Backward-compatibility import from legacy backup format
    const legacyHistory = (backupState as any).chatHistory;
    const migratedConvs: Record<string, ChatConversation[]> = {};
    const migratedActive: Record<string, string> = {};
    for (const [exId, msgs] of Object.entries(legacyHistory)) {
      if (Array.isArray(msgs) && msgs.length > 0) {
        const convId = `conv-${Date.now()}-${exId}`;
        migratedConvs[exId] = [
          {
            id: convId,
            exerciseId: exId,
            languageId: backupState.currentLanguageId || current.currentLanguageId,
            title: 'Chat 1',
            createdAt: (msgs[0] as any)?.timestamp || Date.now(),
            updatedAt: (msgs[msgs.length - 1] as any)?.timestamp || Date.now(),
            messages: msgs as ChatMessage[],
          },
        ];
        migratedActive[exId] = convId;
      }
    }
    restoredConvs = migratedConvs;
    restoredActive = migratedActive;
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
  };
}
