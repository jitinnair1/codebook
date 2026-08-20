// src/core/backup/backupManager.ts
import { SITE_TITLE, SITE_SLUG } from '../siteConfig';
import { AppState } from '../types';
import { ExportOptions, MetadataPayload, ModularBackupPayload } from './types';
import { exportLessons, sanitizeLessons, mergeLessons, lessonsModule } from './modules/lessonsModule';
import { exportConversations, sanitizeConversations, mergeConversations, conversationsModule } from './modules/conversationsModule';
import { exportSettings, sanitizeSettings, mergeSettings, settingsModule } from './modules/settingsModule';

export const BACKUP_VERSION = 1;

export const BACKUP_FILENAMES = {
  METADATA: `_${SITE_SLUG}.json`,
  LESSONS: lessonsModule.filename,
  CONVERSATIONS: conversationsModule.filename,
  SETTINGS: settingsModule.filename,
} as const;

export function createMetadata(): MetadataPayload {
  return {
    version: BACKUP_VERSION,
    siteTitle: SITE_TITLE,
    siteSlug: SITE_SLUG,
    storageKey: `${SITE_SLUG}_storage`,
    exportedAt: new Date().toISOString(),
    updatedAt: Date.now(),
  };
}

/**
 * Builds the map of files to write to the GitHub Gist during sync.
 * API keys and tokens are strictly excluded from Gist sync files.
 */
export async function buildGistFiles(state: AppState): Promise<Record<string, string>> {
  const metadata = createMetadata();
  const lessons = exportLessons(state);
  const conversations = exportConversations(state);
  const settings = await exportSettings(state, { includeKeys: false });

  return {
    [BACKUP_FILENAMES.METADATA]: JSON.stringify(metadata, null, 2),
    [BACKUP_FILENAMES.LESSONS]: JSON.stringify(lessons, null, 2),
    [BACKUP_FILENAMES.CONVERSATIONS]: JSON.stringify(conversations, null, 2),
    [BACKUP_FILENAMES.SETTINGS]: JSON.stringify(settings, null, 2),
  };
}

/**
 * Parses and merges multi-file Gist contents into the application state.
 */
export function parseAndMergeGistFiles(
  files: Record<string, { content?: string }>,
  currentState: AppState,
  smartMerge = true
): { data: Partial<AppState>; updatedAt?: number; siteTitle?: string } | null {
  if (!files || typeof files !== 'object') {
    return null;
  }

  let metadata: Partial<MetadataPayload> | undefined;
  const metaFile = files[BACKUP_FILENAMES.METADATA];
  if (metaFile?.content) {
    try {
      metadata = JSON.parse(metaFile.content);
    } catch {
      // Non-fatal if metadata fails to parse
    }
  }

  let merged: Partial<AppState> = {};

  // 1. Lessons
  if (files[BACKUP_FILENAMES.LESSONS]?.content) {
    try {
      const parsedLessons = JSON.parse(files[BACKUP_FILENAMES.LESSONS].content!);
      const lessonsData = smartMerge
        ? mergeLessons(currentState, parsedLessons)
        : sanitizeLessons(parsedLessons, currentState);
      merged = { ...merged, ...lessonsData };
    } catch (e) {
      console.warn('[sync] Failed to parse lessons file from Gist:', e);
    }
  }

  // 2. Conversations
  if (files[BACKUP_FILENAMES.CONVERSATIONS]?.content) {
    try {
      const parsedConvs = JSON.parse(files[BACKUP_FILENAMES.CONVERSATIONS].content!);
      const convsData = smartMerge
        ? mergeConversations(currentState, parsedConvs)
        : sanitizeConversations(parsedConvs, currentState);
      merged = { ...merged, ...convsData };
    } catch (e) {
      console.warn('[sync] Failed to parse conversations file from Gist:', e);
    }
  }

  // 3. Settings
  if (files[BACKUP_FILENAMES.SETTINGS]?.content) {
    try {
      const parsedSettings = JSON.parse(files[BACKUP_FILENAMES.SETTINGS].content!);
      const settingsData = smartMerge
        ? mergeSettings(currentState, parsedSettings)
        : sanitizeSettings(parsedSettings, currentState);
      merged = { ...merged, ...settingsData };
    } catch (e) {
      console.warn('[sync] Failed to parse settings file from Gist:', e);
    }
  }

  if (Object.keys(merged).length === 0) {
    return null;
  }

  return {
    data: merged,
    updatedAt: metadata?.updatedAt,
    siteTitle: metadata?.siteTitle,
  };
}

/**
 * Builds a single structured JSON string for manual file export.
 */
export async function buildManualExportPayload(
  state: AppState,
  options?: ExportOptions
): Promise<string> {
  const payload: ModularBackupPayload = {
    metadata: createMetadata(),
    lessons: exportLessons(state),
    conversations: exportConversations(state),
    settings: await exportSettings(state, options),
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and sanitizes a manual backup import file.
 */
export function parseManualImport(
  rawJson: string,
  currentState: AppState
): { success: boolean; data?: Partial<AppState>; siteTitle?: string; error?: string } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Backup file is not valid JSON.' };
    }

    const metadata: Partial<MetadataPayload> = parsed.metadata || {};
    const siteTitle = metadata.siteTitle || parsed.siteTitle;

    // Reject if explicitly from a different site
    if (siteTitle && siteTitle !== SITE_TITLE) {
      return {
        success: false,
        error: `Import rejected: Backup is for "${siteTitle}", but current site is "${SITE_TITLE}".`,
      };
    }

    const lessonsData = sanitizeLessons(parsed.lessons, currentState);
    const conversationsData = sanitizeConversations(parsed.conversations, currentState);
    const settingsData = sanitizeSettings(parsed.settings, currentState);

    const combined: Partial<AppState> = {
      ...lessonsData,
      ...conversationsData,
      ...settingsData,
    };

    if (Object.keys(combined).length === 0) {
      return { success: false, error: 'Backup file does not contain valid state data.' };
    }

    return {
      success: true,
      data: combined,
      siteTitle,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to parse backup JSON.' };
  }
}
