// src/core/backup/modules/lessonsModule.ts
import { AppState } from '../../types';
import { BackupModule, LessonsPayload } from '../types';

export function exportLessons(state: AppState): LessonsPayload {
  return {
    currentExerciseId: state.currentExerciseId || '',
    currentLanguageId: state.currentLanguageId || '',
    completedIds: Array.isArray(state.completedIds) ? [...state.completedIds] : [],
    userCode: state.userCode ? { ...state.userCode } : {},
    vimMode: !!state.vimMode,
  };
}

export function sanitizeLessons(raw: unknown, current: AppState): Partial<AppState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const payload = raw as Partial<LessonsPayload>;

  return {
    currentExerciseId:
      typeof payload.currentExerciseId === 'string'
        ? payload.currentExerciseId
        : current.currentExerciseId,
    currentLanguageId:
      typeof payload.currentLanguageId === 'string'
        ? payload.currentLanguageId
        : current.currentLanguageId,
    completedIds: Array.isArray(payload.completedIds)
      ? payload.completedIds.filter((id) => typeof id === 'string')
      : current.completedIds,
    userCode:
      payload.userCode && typeof payload.userCode === 'object'
        ? payload.userCode
        : current.userCode,
    vimMode:
      typeof payload.vimMode === 'boolean'
        ? payload.vimMode
        : current.vimMode,
  };
}

export function mergeLessons(local: AppState, remote: LessonsPayload): Partial<AppState> {
  const localCompleted = Array.isArray(local.completedIds) ? local.completedIds : [];
  const remoteCompleted = Array.isArray(remote.completedIds) ? remote.completedIds : [];
  const mergedCompleted = Array.from(new Set([...localCompleted, ...remoteCompleted]));

  const mergedUserCode: Record<string, string> = {
    ...(remote.userCode || {}),
    ...(local.userCode || {}),
  };

  return {
    completedIds: mergedCompleted,
    userCode: mergedUserCode,
    vimMode: typeof remote.vimMode === 'boolean' ? remote.vimMode : local.vimMode,
    currentExerciseId: local.currentExerciseId || remote.currentExerciseId,
    currentLanguageId: local.currentLanguageId || remote.currentLanguageId,
  };
}

export const lessonsModule: BackupModule<LessonsPayload> = {
  id: 'lessons',
  filename: 'lessons.json',
  exportData: (state) => exportLessons(state),
  sanitizeData: (raw, current) => sanitizeLessons(raw, current),
  mergeData: (local, remote) => mergeLessons(local, remote),
};
