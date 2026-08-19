import { StateCreator } from 'zustand/vanilla';
import { exercises } from '../../../exercises/exercise-registry';
import { defaultLanguageId } from '../../../languages/language-registry';
import { AppState, ExerciseSlice, getExerciseVariant } from '../../types';
import { scheduleAutoPush, triggerImmediatePush } from '../../sync/syncManager';

export const createExerciseSlice: StateCreator<AppState, [], [], ExerciseSlice> = (set, get) => ({
  currentExerciseId: exercises[0]?.id || '1.1',
  currentLanguageId: defaultLanguageId,
  completedIds: [],
  userCode: {},
  userTestCode: {},
  activeEditorTab: 'code',
  vimMode: false,

  markComplete: (id: string) => {
    const { completedIds } = get();
    if (!completedIds.includes(id)) {
      set({ completedIds: [...completedIds, id] });
      triggerImmediatePush();
    }
  },

  setCurrent: (id: string) => set({ currentExerciseId: id }),

  setLanguage: (langId: string) => set({ currentLanguageId: langId }),

  saveUserCode: (exerciseId: string, languageId: string, code: string) => {
    const key = `${exerciseId}:${languageId}`;
    set({ userCode: { ...get().userCode, [key]: code } });
    scheduleAutoPush();
  },

  getUserCode: (exerciseId: string, languageId: string) => {
    const { userCode } = get();
    const key = `${exerciseId}:${languageId}`;
    return userCode[key];
  },

  saveUserTestCode: (exerciseId: string, languageId: string, code: string) => {
    const key = `${exerciseId}:${languageId}`;
    const currentEx = exercises.find((e) => e.id === exerciseId);
    const canonical = currentEx ? getExerciseVariant(currentEx, languageId).testCode : '';

    const currentUserTestCode = { ...get().userTestCode };

    // Sparse storage: if code equals canonical test code, remove the key completely (0 bytes overhead)
    if (code === canonical) {
      if (key in currentUserTestCode) {
        delete currentUserTestCode[key];
        set({ userTestCode: currentUserTestCode });
        scheduleAutoPush();
      }
    } else {
      if (currentUserTestCode[key] !== code) {
        set({ userTestCode: { ...currentUserTestCode, [key]: code } });
        scheduleAutoPush();
      }
    }
  },

  getUserTestCode: (exerciseId: string, languageId: string) => {
    const { userTestCode } = get();
    const key = `${exerciseId}:${languageId}`;
    return userTestCode[key];
  },

  setActiveEditorTab: (tab: 'code' | 'test') => {
    set({ activeEditorTab: tab });
  },

  setVimMode: (enabled: boolean) => {
    set({ vimMode: enabled });
    scheduleAutoPush();
  },
});

