import { AppState, ChatConversation, ChatMessage } from '../../types';
import { BackupModule, ConversationsPayload, SavedConversation } from '../types';
import { isValidExerciseId } from '../../../exercises/exercise-registry';

export function exportConversations(state: AppState): ConversationsPayload {
  const conversations: SavedConversation[] = [];

  for (const [slugKey, convList] of Object.entries(state.chatConversations || {})) {
    if (!Array.isArray(convList)) continue;
    for (const c of convList) {
      if (!c) continue;
      const lessonSlug = String(c.lessonSlug || slugKey || '').trim();
      if (!isValidExerciseId(lessonSlug)) continue;

      conversations.push({
        id: c.id,
        lessonSlug,
        languageId: c.languageId || '',
        title: c.title || 'Chat',
        createdAt: c.createdAt || Date.now(),
        updatedAt: c.updatedAt || Date.now(),
        messages: Array.isArray(c.messages)
          ? c.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              ...(m.isError ? { isError: true } : {}),
              ...(m.failedPrompt ? { failedPrompt: m.failedPrompt } : {}),
              ...(m.userMsgId ? { userMsgId: m.userMsgId } : {}),
            }))
          : [],
      });
    }
  }

  // Sort conversations by updatedAt ascending for stable, readable JSON
  conversations.sort((a, b) => a.createdAt - b.createdAt);

  return {
    version: 1,
    conversations,
  };
}

function extractRawConversationList(raw: unknown): any[] {
  if (!raw || typeof raw !== 'object') return [];

  // Case A: Gist / Export Payload ({ conversations: [...] })
  if (Array.isArray((raw as any).conversations)) {
    return (raw as any).conversations;
  }

  // Case B: AppState ({ chatConversations: { [lessonSlug]: [...] } })
  if ((raw as any).chatConversations && typeof (raw as any).chatConversations === 'object') {
    const list: any[] = [];
    for (const [slug, convList] of Object.entries((raw as any).chatConversations)) {
      if (Array.isArray(convList)) {
        for (const c of convList) {
          if (c && typeof c === 'object') {
            list.push({
              ...c,
              lessonSlug: (c as any).lessonSlug || slug,
            });
          }
        }
      }
    }
    return list;
  }

  // Case C: Array passed directly
  if (Array.isArray(raw)) {
    return raw;
  }

  return [];
}

export function sanitizeConversations(raw: unknown, current: AppState): Partial<AppState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const rawList = extractRawConversationList(raw);
  const hasConversationsKey =
    Array.isArray((raw as any).conversations) ||
    ((raw as any).chatConversations && typeof (raw as any).chatConversations === 'object') ||
    Array.isArray(raw);

  if (rawList.length === 0 && !hasConversationsKey) {
    return {};
  }

  const restoredConvs: Record<string, ChatConversation[]> = {};
  const incomingActive =
    (raw as any).activeConversationId && typeof (raw as any).activeConversationId === 'object'
      ? (raw as any).activeConversationId
      : {};
  const restoredActive: Record<string, string> = {
    ...(current.activeConversationId || {}),
    ...incomingActive,
  };

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const lessonSlug = String(item.lessonSlug || '').trim();
    if (!isValidExerciseId(lessonSlug)) continue;

    const conv: ChatConversation = {
      id: String(item.id || `conv-${Date.now()}`),
      lessonSlug,
      languageId: String(item.languageId || ''),
      title: String(item.title || 'Chat'),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
      messages: Array.isArray(item.messages)
        ? item.messages.map((m: any) => ({
            id: String(m.id || `msg-${Date.now()}`),
            role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
            content: String(m.content || ''),
            timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
            ...(m.isError ? { isError: true } : {}),
            ...(m.failedPrompt ? { failedPrompt: String(m.failedPrompt) } : {}),
            ...(m.userMsgId ? { userMsgId: String(m.userMsgId) } : {}),
          }))
        : [],
    };

    if (!restoredConvs[lessonSlug]) {
      restoredConvs[lessonSlug] = [];
    }
    restoredConvs[lessonSlug].push(conv);
  }

  // Ensure active conversation pointer for each lesson
  for (const [lessonSlug, convs] of Object.entries(restoredConvs)) {
    if (convs.length > 0) {
      const mostRecent = [...convs].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const existingActive = restoredActive[lessonSlug];
      if (!existingActive || !convs.some((c) => c.id === existingActive)) {
        restoredActive[lessonSlug] = mostRecent.id;
      }
    }
  }

  return {
    chatConversations: restoredConvs,
    activeConversationId: restoredActive,
  };
}

export function mergeConversations(local: AppState, remote: ConversationsPayload | any): Partial<AppState> {
  const remoteList = extractRawConversationList(remote);
  const localList: ChatConversation[] = Object.values(local.chatConversations || {}).flat();

  // Index all conversations by ID
  const convMap = new Map<string, ChatConversation>();

  for (const loc of localList) {
    if (loc?.id && isValidExerciseId(loc.lessonSlug)) {
      convMap.set(loc.id, { ...loc });
    }
  }

  for (const rem of remoteList) {
    if (!rem || typeof rem !== 'object') continue;
    const remId = String(rem.id || '').trim();
    const lessonSlug = String(rem.lessonSlug || '').trim();
    if (!remId || !isValidExerciseId(lessonSlug)) continue;

    const existing = convMap.get(remId);
    if (!existing) {
      convMap.set(remId, {
        id: remId,
        lessonSlug,
        languageId: String(rem.languageId || ''),
        title: String(rem.title || 'Chat'),
        createdAt: typeof rem.createdAt === 'number' ? rem.createdAt : Date.now(),
        updatedAt: typeof rem.updatedAt === 'number' ? rem.updatedAt : Date.now(),
        messages: Array.isArray(rem.messages) ? rem.messages : [],
      });
    } else {
      // Merge messages without duplicating by ID
      const existingMsgIds = new Set(existing.messages.map((m) => m.id));
      const newMessages: ChatMessage[] = Array.isArray(rem.messages)
        ? rem.messages.filter((m: any) => !existingMsgIds.has(m.id))
        : [];

      existing.messages = [...existing.messages, ...newMessages];
      existing.updatedAt = Math.max(existing.updatedAt, rem.updatedAt || 0);
      if (rem.title && !existing.title) existing.title = rem.title;
    }
  }

  // Regroup merged conversations by lessonSlug
  const mergedConvs: Record<string, ChatConversation[]> = {};
  const mergedActive: Record<string, string> = { ...(local.activeConversationId || {}) };

  for (const conv of convMap.values()) {
    if (!mergedConvs[conv.lessonSlug]) {
      mergedConvs[conv.lessonSlug] = [];
    }
    mergedConvs[conv.lessonSlug].push(conv);
  }

  for (const [lessonSlug, convs] of Object.entries(mergedConvs)) {
    if (convs.length > 0) {
      const mostRecent = [...convs].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const existingActive = mergedActive[lessonSlug];
      if (!existingActive || !convs.some((c) => c.id === existingActive)) {
        mergedActive[lessonSlug] = mostRecent.id;
      }
    }
  }

  return {
    chatConversations: mergedConvs,
    activeConversationId: mergedActive,
  };
}

export const conversationsModule: BackupModule<ConversationsPayload> = {
  id: 'conversations',
  filename: 'conversations.json',
  exportData: (state) => exportConversations(state),
  sanitizeData: (raw, current) => sanitizeConversations(raw, current),
  mergeData: (local, remote) => mergeConversations(local, remote),
};

