// src/core/store/backup.ts
import { exercises } from '../../exercises/exercise-registry';
import { AppState } from '../types';
import { sanitizeLessons } from '../backup/modules/lessonsModule';
import { sanitizeConversations } from '../backup/modules/conversationsModule';
import { sanitizeSettings } from '../backup/modules/settingsModule';

/**
 * Returns the reset state for user progress while keeping settings intact.
 */
export function getInitialProgressState(): Partial<AppState> {
  return {
    completedSlugs: [],
    userCode: {},
    userCodeTimestamps: {},
    chatConversations: {},
    activeConversationId: {},
    activeLessonSlug: exercises[0]?.id || '',
  };
}

/**
 * Validates and sanitizes a raw backup state payload using domain modules.
 */
export function sanitizeBackupData(
  backupState: Partial<AppState>,
  current: AppState
): Partial<AppState> {
  return {
    ...sanitizeLessons(backupState, current),
    ...sanitizeConversations(backupState, current),
    ...sanitizeSettings(backupState, current),
  };
}
