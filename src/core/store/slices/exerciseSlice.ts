// src/core/store/slices/exerciseSlice.ts
import { StateCreator } from 'zustand/vanilla';
import { exercises } from '../../../exercises/exercise-registry';
import { defaultLanguageId } from '../../../languages/language-registry';
import { AppState, ExerciseSlice } from '../../types';
import { scheduleAutoPush, triggerImmediatePush } from '../../sync/syncManager';

export const createExerciseSlice: StateCreator<AppState, [], [], ExerciseSlice> = (set, get) => ({
  activeLessonSlug: exercises[0]?.id || '',
  currentLanguageId: defaultLanguageId,
  completedSlugs: [],
  userCode: {},
  userCodeTimestamps: {},
  vimMode: false,

  markComplete: (slug: string) => {
    const { completedSlugs } = get();
    if (!completedSlugs.includes(slug)) {
      set({ completedSlugs: [...completedSlugs, slug] });
      triggerImmediatePush();
    }
  },

  setCurrent: (slug: string) => set({ activeLessonSlug: slug }),

  setLanguage: (langId: string) => set({ currentLanguageId: langId }),

  saveUserCode: (lessonSlug: string, languageId: string, code: string) => {
    const key = `${lessonSlug}:${languageId}`;
    const now = Date.now();
    set({
      userCode: { ...get().userCode, [key]: code },
      userCodeTimestamps: { ...(get().userCodeTimestamps || {}), [key]: now },
    });
    scheduleAutoPush();
  },

  getUserCode: (lessonSlug: string, languageId: string) => {
    const { userCode } = get();
    const key = `${lessonSlug}:${languageId}`;
    return userCode[key];
  },

  setVimMode: (enabled: boolean) => {
    set({ vimMode: enabled });
    scheduleAutoPush();
  },
});
