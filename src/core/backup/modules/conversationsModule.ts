// src/core/backup/modules/conversationsModule.ts
import { AppState, ChatConversation } from '../../types';
import { BackupModule, ConversationsPayload } from '../types';

export function exportConversations(state: AppState): ConversationsPayload {
  return {
    chatConversations: state.chatConversations ? { ...state.chatConversations } : {},
    activeConversationId: state.activeConversationId ? { ...state.activeConversationId } : {},
  };
}

export function sanitizeConversations(raw: unknown, current: AppState): Partial<AppState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const payload = raw as Partial<ConversationsPayload>;

  let restoredConvs = current.chatConversations;
  let restoredActive = current.activeConversationId;

  if (payload.chatConversations && typeof payload.chatConversations === 'object') {
    restoredConvs = payload.chatConversations;
    if (payload.activeConversationId && typeof payload.activeConversationId === 'object') {
      restoredActive = payload.activeConversationId;
    }
  }

  return {
    chatConversations: restoredConvs,
    activeConversationId: restoredActive,
  };
}

export function mergeConversations(local: AppState, remote: ConversationsPayload): Partial<AppState> {
  const mergedConversations: Record<string, ChatConversation[]> = {
    ...(remote.chatConversations || {}),
  };

  if (local.chatConversations) {
    for (const [exId, convs] of Object.entries(local.chatConversations)) {
      if (!mergedConversations[exId]) {
        mergedConversations[exId] = convs;
      } else {
        const existingIds = new Set(mergedConversations[exId].map((c) => c.id));
        const nonDuplicateLocal = convs.filter((c) => !existingIds.has(c.id));
        mergedConversations[exId] = [...mergedConversations[exId], ...nonDuplicateLocal];
      }
    }
  }

  const mergedActiveConv: Record<string, string> = {
    ...(remote.activeConversationId || {}),
    ...(local.activeConversationId || {}),
  };

  return {
    chatConversations: mergedConversations,
    activeConversationId: mergedActiveConv,
  };
}

export const conversationsModule: BackupModule<ConversationsPayload> = {
  id: 'conversations',
  filename: 'conversations.json',
  exportData: (state) => exportConversations(state),
  sanitizeData: (raw, current) => sanitizeConversations(raw, current),
  mergeData: (local, remote) => mergeConversations(local, remote),
};
