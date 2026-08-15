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
  chatHistory: Record<string, ChatMessage[]>;
  addChatMessage: (exerciseId: string, message: ChatMessage) => void;
  clearChatHistory: (exerciseId: string) => void;
  resetProgress: () => void;
  restoreBackup: (backupState: Partial<AppState>) => void;
}

const defaultChatSettings: ChatSettings = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
  selectedEndpointId: 'default-endpoint',
  endpoints: [
    {
      id: 'default-endpoint',
      name: 'OpenAI API',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: '',
    },
  ],
};

let isHydrating = true;
let hasHydrated = false;

const encryptedStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    isHydrating = true;
    const raw = localStorage.getItem(name);
    if (!raw) {
      isHydrating = false;
      hasHydrated = true;
      return null;
    }
    try {
      const parsed = JSON.parse(raw);

      // Migrate legacy aiSettings to chatSettings if present
      if (parsed?.state?.aiSettings && !parsed?.state?.chatSettings) {
        parsed.state.chatSettings = parsed.state.aiSettings;
        delete parsed.state.aiSettings;
      }

      if (parsed?.state?.chatSettings) {
        const cs = parsed.state.chatSettings;
        if (cs.apiKey) {
          cs.apiKey = await decryptSecret(cs.apiKey);
        }
        if (Array.isArray(cs.endpoints)) {
          for (const ep of cs.endpoints) {
            if (ep.apiKey) {
              ep.apiKey = await decryptSecret(ep.apiKey);
            }
            if (!ep.name) {
              ep.name = ep.baseUrl?.includes('openai.com') ? 'OpenAI API' : (ep.baseUrl ? 'Custom Endpoint' : 'OpenAI API');
            }
          }
        } else {
          // Initialize endpoints if absent
          cs.endpoints = [
            {
              id: cs.selectedEndpointId || 'default-endpoint',
              name: cs.baseUrl?.includes('openai.com') ? 'OpenAI API' : (cs.baseUrl ? 'Custom Endpoint' : 'OpenAI API'),
              baseUrl: cs.baseUrl || 'https://api.openai.com/v1',
              apiKey: cs.apiKey || '',
              model: cs.model || '',
            },
          ];
          cs.selectedEndpointId = cs.endpoints[0].id;
        }
      }
      isHydrating = false;
      hasHydrated = true;
      return JSON.stringify(parsed);
    } catch {
      isHydrating = false;
      hasHydrated = true;
      return raw;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (isHydrating || !hasHydrated) {
      // Guard against race conditions wiping local storage before initial hydration completes
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.chatSettings) {
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
      chatHistory: {},

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
              name: updated.baseUrl?.includes('openai.com') ? 'OpenAI API' : 'Custom Endpoint',
              baseUrl: updated.baseUrl || 'https://api.openai.com/v1',
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

      addChatMessage: (exerciseId, message) => {
        const { chatHistory } = get();
        const currentMessages = chatHistory[exerciseId] || [];
        set({
          chatHistory: {
            ...chatHistory,
            [exerciseId]: [...currentMessages, message],
          },
        });
      },

      clearChatHistory: (exerciseId) => {
        const { chatHistory } = get();
        const newHistory = { ...chatHistory };
        delete newHistory[exerciseId];
        set({ chatHistory: newHistory });
      },

      resetProgress: () => {
        set({
          completedIds: [],
          userCode: {},
          chatHistory: {},
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

        set({
          currentExerciseId: typeof backupState.currentExerciseId === 'string' ? backupState.currentExerciseId : current.currentExerciseId,
          currentLanguageId: typeof backupState.currentLanguageId === 'string' ? backupState.currentLanguageId : current.currentLanguageId,
          completedIds: Array.isArray(backupState.completedIds) ? backupState.completedIds.filter(id => typeof id === 'string') : current.completedIds,
          userCode: (backupState.userCode && typeof backupState.userCode === 'object') ? backupState.userCode : current.userCode,
          vimMode: typeof backupState.vimMode === 'boolean' ? backupState.vimMode : current.vimMode,
          chatSettings: restoredChatSettings,
          chatHistory: (backupState.chatHistory && typeof backupState.chatHistory === 'object') ? backupState.chatHistory : current.chatHistory,
        });
      },

    }),
    {
      name: 'storage',
      storage: createJSONStorage(() => encryptedStateStorage),
    }
  )
);


