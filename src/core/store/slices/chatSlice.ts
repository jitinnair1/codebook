// src/core/store/slices/chatSlice.ts
import { StateCreator } from 'zustand/vanilla';
import { AppState, ChatConversation, ChatMessage, ChatSlice } from '../../types';

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set, get) => ({
  chatConversations: {},
  activeConversationId: {},

  createConversation: (exerciseId: string, languageId: string, title?: string) => {
    const convs = get().chatConversations[exerciseId] || [];
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newConv: ChatConversation = {
      id,
      exerciseId,
      languageId,
      title: title || 'Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    set({
      chatConversations: {
        ...get().chatConversations,
        [exerciseId]: [...convs, newConv],
      },
      activeConversationId: {
        ...get().activeConversationId,
        [exerciseId]: id,
      },
    });
    return id;
  },

  setActiveConversation: (exerciseId: string, conversationId: string) => {
    const currentConvs = get().chatConversations[exerciseId] || [];
    const updatedConvs = currentConvs.map((c) =>
      c.id === conversationId ? { ...c, unread: false } : c
    );
    set({
      chatConversations: {
        ...get().chatConversations,
        [exerciseId]: updatedConvs,
      },
      activeConversationId: {
        ...get().activeConversationId,
        [exerciseId]: conversationId,
      },
    });
  },

  updateConversationLanguage: (exerciseId: string, conversationId: string, languageId: string) => {
    const currentConvs = get().chatConversations[exerciseId] || [];
    const updatedConvs = currentConvs.map((c) =>
      c.id === conversationId ? { ...c, languageId } : c
    );
    set({
      chatConversations: {
        ...get().chatConversations,
        [exerciseId]: updatedConvs,
      },
    });
  },

  updateConversationTitle: (exerciseId: string, conversationId: string, title: string) => {
    const currentConvs = get().chatConversations[exerciseId] || [];
    const updatedConvs = currentConvs.map((c) =>
      c.id === conversationId ? { ...c, title } : c
    );
    set({
      chatConversations: {
        ...get().chatConversations,
        [exerciseId]: updatedConvs,
      },
    });
  },

  deleteConversation: (exerciseId: string, conversationId: string) => {
    const currentConvs = get().chatConversations[exerciseId] || [];
    const updatedConvs = currentConvs.filter((c) => c.id !== conversationId);
    const activeId = get().activeConversationId[exerciseId];
    let nextActiveId = activeId;
    if (activeId === conversationId) {
      nextActiveId = updatedConvs.length > 0 ? updatedConvs[updatedConvs.length - 1].id : '';
    }
    set({
      chatConversations: {
        ...get().chatConversations,
        [exerciseId]: updatedConvs,
      },
      activeConversationId: {
        ...get().activeConversationId,
        [exerciseId]: nextActiveId,
      },
    });
  },

  getActiveConversation: (exerciseId: string) => {
    const state = get();
    const convs = state.chatConversations[exerciseId] || [];
    const activeId = state.activeConversationId[exerciseId];
    return convs.find((c) => c.id === activeId) || convs[0];
  },

  addChatMessage: (exerciseId: string, message: ChatMessage, conversationId?: string) => {
    const state = get();
    let convs = [...(state.chatConversations[exerciseId] || [])];
    let targetId = conversationId || state.activeConversationId[exerciseId];
    const isCurrentActive =
      state.currentExerciseId === exerciseId && state.activeConversationId[exerciseId] === targetId;
    const isUnread = !isCurrentActive && message.role === 'assistant';

    let targetConv = convs.find((c) => c.id === targetId);
    if (!targetConv) {
      const newId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      targetConv = {
        id: newId,
        exerciseId,
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

    const existingActiveId = state.activeConversationId[exerciseId];
    const nextActiveId = existingActiveId || targetId;

    set({
      chatConversations: {
        ...state.chatConversations,
        [exerciseId]: convs,
      },
      activeConversationId: {
        ...state.activeConversationId,
        [exerciseId]: nextActiveId,
      },
    });
  },

  clearChatHistory: (exerciseId: string, conversationId?: string) => {
    const state = get();
    const targetId = conversationId || state.activeConversationId[exerciseId];
    if (!targetId) return;

    const convs = (state.chatConversations[exerciseId] || []).map((c) => {
      if (c.id === targetId) {
        return { ...c, messages: [], updatedAt: Date.now() };
      }
      return c;
    });

    set({
      chatConversations: {
        ...state.chatConversations,
        [exerciseId]: convs,
      },
    });
  },
});
