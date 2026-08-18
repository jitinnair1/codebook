// src/core/store/slices/exerciseSlice.ts
import { StateCreator } from 'zustand/vanilla';
import { exercises } from '../../../exercises/exercise-registry';
import { defaultLanguageId } from '../../../languages/language-registry';
import { AppState, ExerciseSlice } from '../../types';

export const createExerciseSlice: StateCreator<AppState, [], [], ExerciseSlice> = (set, get) => ({
  currentExerciseId: exercises[0]?.id || '1.1',
  currentLanguageId: defaultLanguageId,
  completedIds: [],
  userCode: {},
  vimMode: false,

  markComplete: (id: string) => {
    const { completedIds } = get();
    if (!completedIds.includes(id)) {
      set({ completedIds: [...completedIds, id] });
    }
  },

  setCurrent: (id: string) => set({ currentExerciseId: id }),

  setLanguage: (langId: string) => set({ currentLanguageId: langId }),

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
});
