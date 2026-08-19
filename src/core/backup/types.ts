// src/core/backup/types.ts
import { AppState, ChatConversation, ChatSettings, GistSyncSettings } from '../types';

export interface MetadataPayload {
  version: number;
  siteTitle: string;
  siteSlug: string;
  exportedAt: string;
  updatedAt: number;
}

export interface LessonsPayload {
  currentExerciseId: string;
  currentLanguageId: string;
  completedIds: string[];
  userCode: Record<string, string>;
  vimMode: boolean;
}

export interface ConversationsPayload {
  chatConversations: Record<string, ChatConversation[]>;
  activeConversationId: Record<string, string>;
}

export interface SettingsPayload {
  chatSettings: ChatSettings;
  gistSyncSettings: GistSyncSettings;
}

export interface ModularBackupPayload {
  metadata: MetadataPayload;
  lessons: LessonsPayload;
  conversations: ConversationsPayload;
  settings: SettingsPayload;
}

export interface ExportOptions {
  includeKeys?: boolean;
}

export interface BackupModule<T> {
  id: string;
  filename: string;
  exportData: (state: AppState, options?: ExportOptions) => Promise<T> | T;
  sanitizeData: (raw: unknown, current: AppState) => Partial<AppState>;
  mergeData: (local: AppState, remote: T) => Partial<AppState>;
}
