import { AppState } from '../../types';
import { BackupModule, LessonProgressItem, LessonsPayload } from '../types';
import { isValidExerciseId, exercises } from '../../../exercises/exercise-registry';

export function exportLessons(state: AppState): LessonsPayload {
  const lessonMap = new Map<string, { completed: boolean; code: Record<string, string> }>();

  // 1. Index completed lesson slugs
  for (const id of state.completedIds || []) {
    if (!id || typeof id !== 'string') continue;
    const cleanSlug = id.trim();
    if (!isValidExerciseId(cleanSlug)) continue;
    if (!lessonMap.has(cleanSlug)) {
      lessonMap.set(cleanSlug, { completed: true, code: {} });
    } else {
      lessonMap.get(cleanSlug)!.completed = true;
    }
  }

  // 2. Index user code per lesson and language
  for (const [compoundKey, code] of Object.entries(state.userCode || {})) {
    if (!compoundKey || typeof code !== 'string') continue;

    const colonIdx = compoundKey.indexOf(':');
    if (colonIdx !== -1) {
      const rawLesson = compoundKey.slice(0, colonIdx).trim();
      const langId = compoundKey.slice(colonIdx + 1).trim();
      if (!isValidExerciseId(rawLesson) || !langId) continue;

      if (!lessonMap.has(rawLesson)) {
        lessonMap.set(rawLesson, { completed: false, code: {} });
      }
      if (code.trim()) {
        lessonMap.get(rawLesson)!.code[langId] = code;
      }
    }
  }

  // 3. Transform map into structured list
  const lessons: LessonProgressItem[] = [];
  for (const [slug, item] of lessonMap.entries()) {
    const hasCode = Object.keys(item.code).length > 0;
    lessons.push({
      slug,
      completed: item.completed,
      ...(hasCode ? { code: item.code } : {}),
    });
  }

  // Stable sort by lesson slug
  lessons.sort((a, b) => a.slug.localeCompare(b.slug));

  const activeLessonSlug = isValidExerciseId(state.currentExerciseId)
    ? state.currentExerciseId
    : exercises[0]?.id || '';

  return {
    version: 1,
    activeLessonSlug,
    activeLanguageId: state.currentLanguageId || '',
    lessons,
  };
}

export function sanitizeLessons(raw: unknown, current: AppState): Partial<AppState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const payload = raw as any;

  const rawActiveLesson =
    typeof payload.activeLessonSlug === 'string' && isValidExerciseId(payload.activeLessonSlug)
      ? payload.activeLessonSlug
      : isValidExerciseId(current.currentExerciseId)
      ? current.currentExerciseId
      : exercises[0]?.id || '';

  const resolvedActiveLang =
    typeof payload.activeLanguageId === 'string' && payload.activeLanguageId
      ? payload.activeLanguageId
      : current.currentLanguageId;

  const completedSet = new Set<string>();
  const userCode: Record<string, string> = {};

  if (Array.isArray(payload.lessons)) {
    for (const item of payload.lessons) {
      if (!item || typeof item !== 'object') continue;
      const lessonSlug = String(item.slug || '').trim();
      if (!isValidExerciseId(lessonSlug)) continue;

      if (item.completed) {
        completedSet.add(lessonSlug);
      }

      if (item.code && typeof item.code === 'object') {
        for (const [langId, codeStr] of Object.entries(item.code)) {
          if (typeof codeStr === 'string' && codeStr.trim()) {
            userCode[`${lessonSlug}:${langId}`] = codeStr;
          }
        }
      }
    }
  }

  return {
    currentExerciseId: rawActiveLesson,
    currentLanguageId: resolvedActiveLang,
    completedIds: Array.from(completedSet),
    userCode,
  };
}

export function mergeLessons(local: AppState, remote: LessonsPayload | any): Partial<AppState> {
  const sanitizedRemote = sanitizeLessons(remote, local);

  const localCompleted = Array.isArray(local.completedIds) ? local.completedIds : [];
  const remoteCompleted = Array.isArray(sanitizedRemote.completedIds) ? sanitizedRemote.completedIds : [];
  const mergedCompleted = Array.from(new Set([...localCompleted, ...remoteCompleted]));

  const mergedUserCode: Record<string, string> = {
    ...(sanitizedRemote.userCode || {}),
    ...(local.userCode || {}),
  };

  return {
    completedIds: mergedCompleted,
    userCode: mergedUserCode,
    currentExerciseId: local.currentExerciseId || sanitizedRemote.currentExerciseId,
    currentLanguageId: local.currentLanguageId || sanitizedRemote.currentLanguageId,
  };
}

export const lessonsModule: BackupModule<LessonsPayload> = {
  id: 'lessons',
  filename: 'lessons.json',
  exportData: (state) => exportLessons(state),
  sanitizeData: (raw, current) => sanitizeLessons(raw, current),
  mergeData: (local, remote) => mergeLessons(local, remote),
};
