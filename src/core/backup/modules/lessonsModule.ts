import { AppState } from '../../types';
import { BackupModule, LessonProgressItem, LessonsPayload } from '../types';
import { isValidExerciseId, exercises } from '../../../exercises/exercise-registry';

export function exportLessons(state: AppState): LessonsPayload {
  const lessonMap = new Map<string, { completed: boolean; code: Record<string, string> }>();

  // 1. Index completed lesson slugs
  for (const id of state.completedSlugs || []) {
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

  // 3. Transform map into structured list with per-lesson timestamps
  const lessons: LessonProgressItem[] = [];
  for (const [slug, item] of lessonMap.entries()) {
    const hasCode = Object.keys(item.code).length > 0;
    let maxTs = 0;
    if (state.userCodeTimestamps) {
      for (const langId of Object.keys(item.code)) {
        const ts = state.userCodeTimestamps[`${slug}:${langId}`];
        if (ts && ts > maxTs) maxTs = ts;
      }
    }
    lessons.push({
      slug,
      completed: item.completed,
      ...(hasCode ? { code: item.code } : {}),
      ...(maxTs > 0 ? { updatedAt: maxTs } : {}),
    });
  }

  // Stable sort by lesson slug
  lessons.sort((a, b) => a.slug.localeCompare(b.slug));

  const activeLessonSlug = isValidExerciseId(state.activeLessonSlug)
    ? state.activeLessonSlug
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
      : isValidExerciseId(current.activeLessonSlug)
      ? current.activeLessonSlug
      : exercises[0]?.id || '';

  const resolvedActiveLang =
    typeof payload.activeLanguageId === 'string' && payload.activeLanguageId
      ? payload.activeLanguageId
      : typeof payload.currentLanguageId === 'string' && payload.currentLanguageId
      ? payload.currentLanguageId
      : current.currentLanguageId;

  const completedSet = new Set<string>();
  const userCode: Record<string, string> = {};
  const userCodeTimestamps: Record<string, number> = {};

  if (Array.isArray(payload.lessons)) {
    for (const item of payload.lessons) {
      if (!item || typeof item !== 'object') continue;
      const lessonSlug = String(item.slug || '').trim();
      if (!isValidExerciseId(lessonSlug)) continue;

      if (item.completed) {
        completedSet.add(lessonSlug);
      }

      const itemUpdatedAt = typeof item.updatedAt === 'number' ? item.updatedAt : 0;

      if (item.code && typeof item.code === 'object') {
        for (const [langId, codeStr] of Object.entries(item.code)) {
          if (typeof codeStr === 'string' && codeStr.trim()) {
            const key = `${lessonSlug}:${langId}`;
            userCode[key] = codeStr;
            if (itemUpdatedAt > 0) {
              userCodeTimestamps[key] = itemUpdatedAt;
            }
          }
        }
      }
    }
  } else {
    if (Array.isArray(payload.completedSlugs)) {
      for (const id of payload.completedSlugs) {
        if (typeof id === 'string' && isValidExerciseId(id.trim())) {
          completedSet.add(id.trim());
        }
      }
    }

    if (payload.userCode && typeof payload.userCode === 'object') {
      for (const [key, code] of Object.entries(payload.userCode)) {
        if (typeof key === 'string' && typeof code === 'string' && code.trim()) {
          const colonIdx = key.indexOf(':');
          if (colonIdx !== -1) {
            const lessonSlug = key.slice(0, colonIdx).trim();
            const langId = key.slice(colonIdx + 1).trim();
            if (isValidExerciseId(lessonSlug) && langId) {
              userCode[`${lessonSlug}:${langId}`] = code;
            }
          }
        }
      }
    }

    if (payload.userCodeTimestamps && typeof payload.userCodeTimestamps === 'object') {
      for (const [key, ts] of Object.entries(payload.userCodeTimestamps)) {
        if (typeof key === 'string' && typeof ts === 'number' && ts > 0) {
          userCodeTimestamps[key] = ts;
        }
      }
    }
  }

  return {
    activeLessonSlug: rawActiveLesson,
    currentLanguageId: resolvedActiveLang,
    completedSlugs: Array.from(completedSet),
    userCode,
    userCodeTimestamps,
  };
}

export function mergeLessons(local: AppState, remote: LessonsPayload | any): Partial<AppState> {
  const sanitizedRemote = sanitizeLessons(remote, local);

  const localCompleted = Array.isArray(local.completedSlugs) ? local.completedSlugs : [];
  const remoteCompleted = Array.isArray(sanitizedRemote.completedSlugs) ? sanitizedRemote.completedSlugs : [];
  const mergedCompleted = Array.from(new Set([...localCompleted, ...remoteCompleted]));

  const localCode = local.userCode || {};
  const localTimestamps = local.userCodeTimestamps || {};
  const remoteCode = sanitizedRemote.userCode || {};
  const remoteTimestamps = sanitizedRemote.userCodeTimestamps || {};

  const mergedUserCode: Record<string, string> = { ...localCode };
  const mergedTimestamps: Record<string, number> = { ...localTimestamps };

  // Compare per-exercise timestamps: newer remote code overwrites stale local code
  for (const [key, rCode] of Object.entries(remoteCode)) {
    const lCode = localCode[key];
    const rTs = remoteTimestamps[key] || 0;
    const lTs = localTimestamps[key] || 0;

    // If local has no code for this key, or remote timestamp is strictly newer
    if (!lCode || rTs > lTs) {
      mergedUserCode[key] = rCode;
      mergedTimestamps[key] = rTs || lTs || Date.now();
    }
  }

  return {
    completedSlugs: mergedCompleted,
    userCode: mergedUserCode,
    userCodeTimestamps: mergedTimestamps,
    activeLessonSlug: local.activeLessonSlug || sanitizedRemote.activeLessonSlug,
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
