// src/core/store.ts
import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { exercises } from '../exercises/exercise-registry';
import { defaultLanguageId } from '../languages/language-registry';
import { encryptSecret, decryptSecret } from './crypto';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatConversation {
  id: string;
  exerciseId: string;
  languageId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  unread?: boolean;
}

export interface ChatEndpoint {
  id: string;
  name?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  selectedEndpointId: string;
  endpoints: ChatEndpoint[];
}

export interface AppState {
  currentExerciseId: string;
  currentLanguageId: string;
  completedIds: string[];
  markComplete: (id: string) => void;
  setCurrent: (id: string) => void;
  setLanguage: (langId: string) => void;
  userCode: Record<string, string>;
  saveUserCode: (exerciseId: string, languageId: string, code: string) => void;
  getUserCode: (exerciseId: string, languageId: string) => string | undefined;
  vimMode: boolean;
  setVimMode: (enabled: boolean) => void;
  chatSettings: ChatSettings;
  setChatSettings: (settings: Partial<ChatSettings>) => void;
  chatConversations: Record<string, ChatConversation[]>;
  activeConversationId: Record<string, string>;
  createConversation: (exerciseId: string, languageId: string, title?: string) => string;
  setActiveConversation: (exerciseId: string, conversationId: string) => void;
  updateConversationLanguage: (exerciseId: string, conversationId: string, languageId: string) => void;
  updateConversationTitle: (exerciseId: string, conversationId: string, title: string) => void;
  deleteConversation: (exerciseId: string, conversationId: string) => void;
  getActiveConversation: (exerciseId: string) => ChatConversation | undefined;
  addChatMessage: (exerciseId: string, message: ChatMessage, conversationId?: string) => void;
  clearChatHistory: (exerciseId: string, conversationId?: string) => void;
  resetProgress: () => void;
  restoreBackup: (backupState: Partial<AppState>) => void;
}

const defaultChatSettings: ChatSettings = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  model: '',
  selectedEndpointId: 'default-endpoint',
  endpoints: [
    {
      id: 'default-endpoint',
      name: '',
      baseUrl: '',
      apiKey: '',
      model: '',
    },
  ],
};

const syncStateStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      // Migrate legacy aiSettings to chatSettings if present
      if (parsed?.state?.aiSettings && !parsed?.state?.chatSettings) {
        parsed.state.chatSettings = parsed.state.aiSettings;
        delete parsed.state.aiSettings;
      }

      // Migrate legacy chatHistory to chatConversations if present
      if (parsed?.state?.chatHistory && !parsed?.state?.chatConversations) {
        const legacyHistory = parsed.state.chatHistory;
        const migratedConvs: Record<string, ChatConversation[]> = {};
        const migratedActive: Record<string, string> = {};
        for (const [exId, msgs] of Object.entries(legacyHistory)) {
          if (Array.isArray(msgs) && msgs.length > 0) {
            const convId = `conv-${Date.now()}-${exId}`;
            migratedConvs[exId] = [
              {
                id: convId,
                exerciseId: exId,
                languageId: parsed.state.currentLanguageId || defaultLanguageId,
                title: 'Chat 1',
                createdAt: (msgs[0] as any)?.timestamp || Date.now(),
                updatedAt: (msgs[msgs.length - 1] as any)?.timestamp || Date.now(),
                messages: msgs as ChatMessage[],
              },
            ];
            migratedActive[exId] = convId;
          }
        }
        parsed.state.chatConversations = migratedConvs;
        parsed.state.activeConversationId = migratedActive;
        delete parsed.state.chatHistory;
      }

      if (parsed?.state?.chatSettings) {
        const cs = parsed.state.chatSettings;
        if (!Array.isArray(cs.endpoints) || cs.endpoints.length === 0) {
          cs.endpoints = [
            {
              id: cs.selectedEndpointId || 'default-endpoint',
              name: cs.baseUrl?.includes('openai.com') ? 'OpenAI API' : (cs.baseUrl ? 'Custom Endpoint' : 'Endpoint 1'),
              baseUrl: cs.baseUrl || '',
              apiKey: cs.apiKey || '',
              model: cs.model || '',
            },
          ];
          cs.selectedEndpointId = cs.endpoints[0].id;
        }
      }

      return JSON.stringify(parsed);
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.chatSettings) {
        // Asynchronously encrypt chat settings in background before writing to localStorage
        (async () => {
          try {
            const cs = { ...parsed.state.chatSettings };
            if (cs.apiKey) {
              cs.apiKey = await encryptSecret(cs.apiKey);
            }
            if (Array.isArray(cs.endpoints)) {
              cs.endpoints = await Promise.all(
                cs.endpoints.map(async (ep: ChatEndpoint) => ({
                  ...ep,
                  apiKey: ep.apiKey ? await encryptSecret(ep.apiKey) : '',
                }))
              );
            }
            parsed.state.chatSettings = cs;
            localStorage.setItem(name, JSON.stringify(parsed));
          } catch {
            localStorage.setItem(name, value);
          }
        })();
        return;
      }
      localStorage.setItem(name, value);
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};

export async function decryptStoredChatSettings(storeApi: typeof store): Promise<void> {
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

export const store = createStore<AppState>()(
  persist(
    (set, get) => ({
      //initial state
      currentExerciseId: exercises[0]?.id || "1.1",
      currentLanguageId: defaultLanguageId,
      completedIds: [],
      userCode: {},
      vimMode: false,
      chatSettings: defaultChatSettings,
      chatConversations: {},
      activeConversationId: {},

      //actions
      markComplete: (id) => {
        const { completedIds } = get();
        if (!completedIds.includes(id)) {
          set({ completedIds: [...completedIds, id] });
        }
      },

      setCurrent: (id) => set({ currentExerciseId: id }),

      setLanguage: (langId) => set({ currentLanguageId: langId }),

      saveUserCode: (exerciseId: string, languageId: string, code: string) => {
        const key = `${exerciseId}:${languageId}`;
        set({ userCode: { ...get().userCode, [key]: code } });
      },

      getUserCode: (exerciseId: string, languageId: string) => {
        const { userCode } = get();
        const key = `${exerciseId}:${languageId}`;
        return userCode[key] ?? userCode[exerciseId];
      },

      setVimMode: (enabled: boolean) => set({ vimMode: enabled }),

      setChatSettings: (newSettings) => {
        const current = get().chatSettings;
        const updated: ChatSettings = {
          ...current,
          ...newSettings,
        };

        // Ensure endpoints array exists
        if (!updated.endpoints || updated.endpoints.length === 0) {
          updated.endpoints = [
            {
              id: updated.selectedEndpointId || 'default-endpoint',
              name: updated.baseUrl?.includes('openai.com') ? 'OpenAI API' : (updated.baseUrl ? 'Custom Endpoint' : 'Endpoint 1'),
              baseUrl: updated.baseUrl || '',
              apiKey: updated.apiKey || '',
              model: updated.model || '',
            },
          ];
        }

        // If switching selected endpoint, pull its configuration into active fields
        if (newSettings.selectedEndpointId && newSettings.selectedEndpointId !== current.selectedEndpointId) {
          const target = updated.endpoints.find(e => e.id === newSettings.selectedEndpointId);
          if (target) {
            updated.baseUrl = target.baseUrl;
            updated.apiKey = target.apiKey;
            updated.model = target.model;
          }
        } else {
          // If active fields changed, keep current endpoint in endpoints list in sync
          const activeIndex = updated.endpoints.findIndex(e => e.id === updated.selectedEndpointId);
          if (activeIndex >= 0) {
            updated.endpoints[activeIndex] = {
              ...updated.endpoints[activeIndex],
              baseUrl: updated.baseUrl,
              apiKey: updated.apiKey,
              model: updated.model,
            };
          }
        }

        set({ chatSettings: updated });
      },

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
        const updatedConvs = currentConvs.map(c =>
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
        const updatedConvs = currentConvs.map(c =>
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
        const updatedConvs = currentConvs.map(c =>
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
        const updatedConvs = currentConvs.filter(c => c.id !== conversationId);
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
        return convs.find(c => c.id === activeId) || convs[0];
      },

      addChatMessage: (exerciseId: string, message: ChatMessage, conversationId?: string) => {
        const state = get();
        let convs = [...(state.chatConversations[exerciseId] || [])];
        let targetId = conversationId || state.activeConversationId[exerciseId];
        const isCurrentActive = state.currentExerciseId === exerciseId && state.activeConversationId[exerciseId] === targetId;
        const isUnread = !isCurrentActive && message.role === 'assistant';

        let targetConv = convs.find(c => c.id === targetId);
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
          convs = convs.map(c => {
            if (c.id === targetId) {
              return {
                ...c,
                updatedAt: Date.now(),
                messages: [...c.messages, message],
                unread: isCurrentActive ? false : (c.unread || isUnread),
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

        const convs = (state.chatConversations[exerciseId] || []).map(c => {
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

      resetProgress: () => {
        set({
          completedIds: [],
          userCode: {},
          chatConversations: {},
          activeConversationId: {},
          currentExerciseId: exercises[0]?.id || "1.1",
        });
      },

      restoreBackup: (backupState) => {
        const current = get();

        let restoredChatSettings = current.chatSettings;
        if (backupState.chatSettings && typeof backupState.chatSettings === 'object') {
          const rawCs = backupState.chatSettings;
          const endpoints = Array.isArray(rawCs.endpoints) ? rawCs.endpoints.map(ep => ({
            id: String(ep.id || 'default-endpoint'),
            name: ep.name ? String(ep.name) : undefined,
            baseUrl: String(ep.baseUrl || ''),
            apiKey: String(ep.apiKey || ''),
            model: String(ep.model || ''),
          })) : defaultChatSettings.endpoints;

          restoredChatSettings = {
            enabled: typeof rawCs.enabled === 'boolean' ? rawCs.enabled : defaultChatSettings.enabled,
            baseUrl: typeof rawCs.baseUrl === 'string' ? rawCs.baseUrl : defaultChatSettings.baseUrl,
            apiKey: typeof rawCs.apiKey === 'string' ? rawCs.apiKey : defaultChatSettings.apiKey,
            model: typeof rawCs.model === 'string' ? rawCs.model : defaultChatSettings.model,
            selectedEndpointId: typeof rawCs.selectedEndpointId === 'string' ? rawCs.selectedEndpointId : (endpoints[0]?.id || 'default-endpoint'),
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
          // Backward-compat import from legacy backup format
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

        set({
          currentExerciseId: typeof backupState.currentExerciseId === 'string' ? backupState.currentExerciseId : current.currentExerciseId,
          currentLanguageId: typeof backupState.currentLanguageId === 'string' ? backupState.currentLanguageId : current.currentLanguageId,
          completedIds: Array.isArray(backupState.completedIds) ? backupState.completedIds.filter(id => typeof id === 'string') : current.completedIds,
          userCode: (backupState.userCode && typeof backupState.userCode === 'object') ? backupState.userCode : current.userCode,
          vimMode: typeof backupState.vimMode === 'boolean' ? backupState.vimMode : current.vimMode,
          chatSettings: restoredChatSettings,
          chatConversations: restoredConvs,
          activeConversationId: restoredActive,
        });
      },

    }),
    {
      name: 'storage',
      storage: createJSONStorage(() => syncStateStorage),
    }
  )
);


