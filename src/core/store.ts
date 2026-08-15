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

export interface AISettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
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
  aiSettings: AISettings;
  setAISettings: (settings: Partial<AISettings>) => void;
  chatHistory: Record<string, ChatMessage[]>;
  addChatMessage: (exerciseId: string, message: ChatMessage) => void;
  clearChatHistory: (exerciseId: string) => void;
  resetProgress: () => void;
}

const defaultAISettings: AISettings = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};

const encryptedStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.aiSettings?.apiKey) {
        parsed.state.aiSettings.apiKey = await decryptSecret(parsed.state.aiSettings.apiKey);
        return JSON.stringify(parsed);
      }
      return raw;
    } catch {
      return raw;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.aiSettings?.apiKey) {
        parsed.state.aiSettings.apiKey = await encryptSecret(parsed.state.aiSettings.apiKey);
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
      aiSettings: defaultAISettings,
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

      setAISettings: (newSettings) => {
        set({
          aiSettings: {
            ...get().aiSettings,
            ...newSettings,
          },
        });
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

    }),
    {
      name: 'storage',
      storage: createJSONStorage(() => encryptedStateStorage),
    }
  )
);


