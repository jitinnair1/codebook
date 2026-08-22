// src/core/store/slices/chatSlice.ts
import { StateCreator } from 'zustand/vanilla';
import { AppState, ChatConversation, ChatMessage, ChatSlice } from '../../types';

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set, get) => ({
  chatConversations: {},
  activeConversationId: {},

  createConversation: (lessonSlug: string, languageId: string, title?: string) => {
    const convs = get().chatConversations[lessonSlug] || [];
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newConv: ChatConversation = {
      id,
      lessonSlug,
      languageId,
      title: title || 'Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    set({
      chatConversations: {
        ...get().chatConversations,
        [lessonSlug]: [...convs, newConv],
      },
      activeConversationId: {
        ...get().activeConversationId,
        [lessonSlug]: id,
      },
    });
    return id;
  },

  setActiveConversation: (lessonSlug: string, conversationId: string) => {
    const currentConvs = get().chatConversations[lessonSlug] || [];
    const updatedConvs = currentConvs.map((c) =>
      c.id === conversationId ? { ...c, unread: false } : c
    );
    set({
      chatConversations: {
        ...get().chatConversations,
        [lessonSlug]: updatedConvs,
      },
      activeConversationId: {
        ...get().activeConversationId,
        [lessonSlug]: conversationId,
      },
    });
  },

  updateConversationLanguage: (lessonSlug: string, conversationId: string, languageId: string) => {
    const currentConvs = get().chatConversations[lessonSlug] || [];
    const updatedConvs = currentConvs.map((c) =>
      c.id === conversationId ? { ...c, languageId } : c
    );
    set({
      chatConversations: {
        ...get().chatConversations,
        [lessonSlug]: updatedConvs,
      },
    });
  },

  updateConversationTitle: (lessonSlug: string, conversationId: string, title: string) => {
    const currentConvs = get().chatConversations[lessonSlug] || [];
    const updatedConvs = currentConvs.map((c) =>
      c.id === conversationId ? { ...c, title } : c
    );
    set({
      chatConversations: {
        ...get().chatConversations,
        [lessonSlug]: updatedConvs,
      },
    });
  },

  deleteConversation: (lessonSlug: string, conversationId: string) => {
    const currentConvs = get().chatConversations[lessonSlug] || [];
    const updatedConvs = currentConvs.filter((c) => c.id !== conversationId);
    const activeId = get().activeConversationId[lessonSlug];
    let nextActiveId = activeId;
    if (activeId === conversationId) {
      nextActiveId = updatedConvs.length > 0 ? updatedConvs[updatedConvs.length - 1].id : '';
    }
    set({
      chatConversations: {
        ...get().chatConversations,
        [lessonSlug]: updatedConvs,
      },
      activeConversationId: {
        ...get().activeConversationId,
        [lessonSlug]: nextActiveId,
      },
    });
  },

  getActiveConversation: (lessonSlug: string) => {
    const state = get();
    const convs = state.chatConversations[lessonSlug] || [];
    const activeId = state.activeConversationId[lessonSlug];
    return convs.find((c) => c.id === activeId) || convs[0];
  },

  addChatMessage: (lessonSlug: string, message: ChatMessage, conversationId?: string) => {
    const state = get();
    let convs = [...(state.chatConversations[lessonSlug] || [])];
    let targetId = conversationId || state.activeConversationId[lessonSlug];
    const isCurrentActive =
      state.activeLessonSlug === lessonSlug && state.activeConversationId[lessonSlug] === targetId;
    const isUnread = !isCurrentActive && message.role === 'assistant';

    let targetConv = convs.find((c) => c.id === targetId);
    if (!targetConv) {
      const newId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      targetConv = {
        id: newId,
        lessonSlug,
        languageId: state.currentLanguageId,
        title: 'Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [message],
        unread: isUnread,
      };
      convs.push(targetConv);
      targetId = newId;
    } else {
      convs = convs.map((c) => {
        if (c.id === targetId) {
          return {
            ...c,
            updatedAt: Date.now(),
            messages: [...c.messages, message],
            unread: isCurrentActive ? false : c.unread || isUnread,
          };
        }
        return c;
      });
    }

    const existingActiveId = state.activeConversationId[lessonSlug];
    const nextActiveId = existingActiveId || targetId;

    set({
      chatConversations: {
        ...state.chatConversations,
        [lessonSlug]: convs,
      },
      activeConversationId: {
        ...state.activeConversationId,
        [lessonSlug]: nextActiveId,
      },
    });
  },

  removeChatMessages: (lessonSlug: string, messageIds: string[], conversationId?: string) => {
    const state = get();
    const targetId = conversationId || state.activeConversationId[lessonSlug];
    if (!targetId || !messageIds.length) return;

    const idSet = new Set(messageIds);
    const convs = (state.chatConversations[lessonSlug] || []).map((c) => {
      if (c.id === targetId) {
        return {
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.filter((m) => !idSet.has(m.id)),
        };
      }
      return c;
    });

    set({
      chatConversations: {
        ...state.chatConversations,
        [lessonSlug]: convs,
      },
    });
  },

  clearChatHistory: (lessonSlug: string, conversationId?: string) => {
    const state = get();
    const targetId = conversationId || state.activeConversationId[lessonSlug];
    if (!targetId) return;

    const convs = (state.chatConversations[lessonSlug] || []).map((c) => {
      if (c.id === targetId) {
        return { ...c, messages: [], updatedAt: Date.now() };
      }
      return c;
    });

    set({
      chatConversations: {
        ...state.chatConversations,
        [lessonSlug]: convs,
      },
    });
  },
});
