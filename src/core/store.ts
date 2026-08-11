// src/core/store.ts
import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { exercises } from '../exercises/exercise-registry';
import { defaultLanguageId } from '../languages/language-registry';

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
}

export const store = createStore<AppState>()(
  persist(
    (set, get) => ({
      //initial state
      currentExerciseId: exercises[0]?.id || "1.1",
      currentLanguageId: defaultLanguageId,
      completedIds: [],
      userCode: {},

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
      }

    }),
    {
      name: 'storage',
      //todo: maybe filter out later what all gets saved?
    }
  )
);
