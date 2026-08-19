// src/core/sync/syncManager.ts
import { SITE_TITLE } from '../siteConfig';
import { GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_WORKER_URL } from './oauthConfig';
import { store, AppState, ChatConversation, ChatSettings } from '../store';
import { createGist, fetchGist, updateGist, exchangeOAuthCode, findSiteGist, GistActionResult } from './gistClient';

export type SyncStatusType = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncStateEvent {
  status: SyncStatusType;
  message?: string;
  lastSyncedAt?: number;
}

// Internal sync state
let currentSyncState: SyncStateEvent = {
  status: 'idle',
};

const listeners = new Set<(event: SyncStateEvent) => void>();
let autoPushTimeout: ReturnType<typeof setTimeout> | null = null;
let isSyncInProgress = false;

/**
 * Subscribes to reactive sync status updates.
 */
export function subscribeSyncStatus(listener: (event: SyncStateEvent) => void): () => void {
  listeners.add(listener);
  listener(getSyncStatus());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns the current sync status.
 */
export function getSyncStatus(): SyncStateEvent {
  const storeLastSynced = store.getState().gistSyncSettings?.lastSyncedAt;
  return {
    ...currentSyncState,
    lastSyncedAt: currentSyncState.lastSyncedAt ?? storeLastSynced,
  };
}

function setSyncStatus(status: SyncStatusType, message?: string, lastSyncedAt?: number) {
  currentSyncState = {
    status,
    message,
    lastSyncedAt: lastSyncedAt ?? currentSyncState.lastSyncedAt ?? store.getState().gistSyncSettings?.lastSyncedAt,
  };
  listeners.forEach((l) => l(currentSyncState));
}

/**
 * Builds a sanitized JSON backup payload suitable for Gist syncing.
 * Strictly strips LLM API keys and GitHub PATs.
 */
export function buildSyncPayload(state: AppState): string {
  const sanitizedChatSettings: ChatSettings = {
    ...state.chatSettings,
    apiKey: '', // Always stripped for cloud sync
    endpoints: (state.chatSettings.endpoints || []).map((ep) => ({
      ...ep,
      apiKey: '',
    })),
  };

  const payload = {
    version: 1,
    siteTitle: SITE_TITLE,
    exportedAt: new Date().toISOString(),
    updatedAt: Date.now(),
    data: {
      currentExerciseId: state.currentExerciseId,
      currentLanguageId: state.currentLanguageId,
      completedIds: state.completedIds,
      userCode: state.userCode,
      vimMode: state.vimMode,
      chatSettings: sanitizedChatSettings,
      chatConversations: state.chatConversations,
      activeConversationId: state.activeConversationId,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and extracts data from a raw sync/backup payload.
 */
export function parseSyncData(rawJson: string): { data: Partial<AppState>; siteTitle?: string; updatedAt?: number } | null {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
      return null;
    }

    return {
      data: parsed.data,
      siteTitle: parsed.siteTitle,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Smartly merges remote Gist state with local state to prevent data loss.
 */
export function mergeSyncState(local: AppState, remoteData: Partial<AppState>): Partial<AppState> {
  // 1. Merge completed exercise IDs (union)
  const localCompleted = Array.isArray(local.completedIds) ? local.completedIds : [];
  const remoteCompleted = Array.isArray(remoteData.completedIds) ? remoteData.completedIds : [];
  const mergedCompleted = Array.from(new Set([...localCompleted, ...remoteCompleted]));

  // 2. Merge user code (keep local non-empty code, supplement missing keys from remote)
  const mergedUserCode: Record<string, string> = {
    ...(remoteData.userCode || {}),
    ...(local.userCode || {}),
  };

  // 3. Merge chat conversations (combine conversations per exercise without duplicating)
  const mergedConversations: Record<string, ChatConversation[]> = {
    ...(remoteData.chatConversations || {}),
  };

  if (local.chatConversations) {
    for (const [exId, convs] of Object.entries(local.chatConversations)) {
      if (!mergedConversations[exId]) {
        mergedConversations[exId] = convs;
      } else {
        const existingIds = new Set(mergedConversations[exId].map((c) => c.id));
        const nonDuplicateLocal = convs.filter((c) => !existingIds.has(c.id));
        mergedConversations[exId] = [...mergedConversations[exId], ...nonDuplicateLocal];
      }
    }
  }

  // 4. Merge active conversation pointers
  const mergedActiveConv: Record<string, string> = {
    ...(remoteData.activeConversationId || {}),
    ...(local.activeConversationId || {}),
  };

  return {
    completedIds: mergedCompleted,
    userCode: mergedUserCode,
    chatConversations: mergedConversations,
    activeConversationId: mergedActiveConv,
    vimMode: typeof remoteData.vimMode === 'boolean' ? remoteData.vimMode : local.vimMode,
    currentExerciseId: local.currentExerciseId || remoteData.currentExerciseId,
    currentLanguageId: local.currentLanguageId || remoteData.currentLanguageId,
  };
}

/**
 * Pushes the current application state to the configured GitHub Gist.
 */
export async function pushToGist(): Promise<GistActionResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus('offline', 'Cannot sync while offline.');
    return { success: false, error: 'Offline' };
  }

  const { gistSyncSettings } = store.getState();
  if (!gistSyncSettings?.enabled || !gistSyncSettings?.token || !gistSyncSettings?.gistId) {
    return { success: false, error: 'Gist sync is not configured or enabled.' };
  }

  if (isSyncInProgress) {
    return { success: false, error: 'A sync operation is already in progress.' };
  }

  isSyncInProgress = true;
  setSyncStatus('syncing');

  try {
    const payload = buildSyncPayload(store.getState());
    const res = await updateGist(gistSyncSettings.gistId, gistSyncSettings.token, payload);

    if (res.success) {
      const now = Date.now();
      store.getState().setGistSyncSettings({ lastSyncedAt: now });
      setSyncStatus('synced', 'Synced successfully.', now);
      return res;
    } else {
      setSyncStatus('error', res.error || 'Failed to update Gist.');
      return res;
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Network error during Gist push.';
    setSyncStatus('error', errorMsg);
    return { success: false, error: errorMsg };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Pulls backup data from the configured GitHub Gist and updates local state.
 */
export async function pullFromGist(options?: { smartMerge?: boolean }): Promise<GistActionResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus('offline', 'Cannot sync while offline.');
    return { success: false, error: 'Offline' };
  }

  const { gistSyncSettings } = store.getState();
  if (!gistSyncSettings?.gistId) {
    return { success: false, error: 'No Gist ID configured.' };
  }

  if (isSyncInProgress) {
    return { success: false, error: 'A sync operation is already in progress.' };
  }

  isSyncInProgress = true;
  setSyncStatus('syncing');

  try {
    const res = await fetchGist(gistSyncSettings.gistId, gistSyncSettings.token);
    if (!res.success || !res.content) {
      setSyncStatus('error', res.error || 'Failed to fetch Gist content.');
      return res;
    }

    const parsed = parseSyncData(res.content);
    if (!parsed || !parsed.data) {
      const errorMsg = 'Gist content is not a valid Codebook backup format.';
      setSyncStatus('error', errorMsg);
      return { success: false, error: errorMsg };
    }

    const currentSite = SITE_TITLE;
    if (parsed.siteTitle && parsed.siteTitle !== currentSite) {
      console.warn(`[sync] Gist siteTitle "${parsed.siteTitle}" differs from current "${currentSite}".`);
    }

    const smartMerge = options?.smartMerge !== false;
    const currentState = store.getState();

    if (smartMerge) {
      const merged = mergeSyncState(currentState, parsed.data);
      store.getState().restoreBackup(merged);
    } else {
      store.getState().restoreBackup(parsed.data);
    }

    const now = Date.now();
    store.getState().setGistSyncSettings({ lastSyncedAt: now, enabled: true });
    setSyncStatus('synced', 'Synced successfully.', now);
    return { success: true, updatedAt: res.updatedAt };
  } catch (err: any) {
    const errorMsg = err?.message || 'Error pulling from Gist.';
    setSyncStatus('error', errorMsg);
    return { success: false, error: errorMsg };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Creates a new secret Gist with current state and links it to settings.
 */
export async function createAndLinkGist(token: string): Promise<GistActionResult> {
  if (!token || !token.trim()) {
    return { success: false, error: 'GitHub Personal Access Token is required.' };
  }

  setSyncStatus('syncing');

  try {
    const payload = buildSyncPayload(store.getState());
    const res = await createGist(token, payload);

    if (res.success && res.gistId) {
      const now = Date.now();
      store.getState().setGistSyncSettings({
        enabled: true,
        token: token.trim(),
        gistId: res.gistId,
        autoSync: true,
        lastSyncedAt: now,
      });
      setSyncStatus('synced', 'Gist created and linked.', now);
      return res;
    } else {
      setSyncStatus('error', res.error || 'Failed to create Gist.');
      return res;
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Error creating Gist.';
    setSyncStatus('error', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Schedules a debounced auto-push if auto-sync is enabled.
 */
export function scheduleAutoPush(delayMs = 3000): void {
  const { gistSyncSettings } = store.getState();
  if (!gistSyncSettings?.enabled || !gistSyncSettings?.autoSync || !gistSyncSettings?.token || !gistSyncSettings?.gistId) {
    return;
  }

  if (autoPushTimeout) {
    clearTimeout(autoPushTimeout);
  }

  autoPushTimeout = setTimeout(() => {
    autoPushTimeout = null;
    pushToGist().catch(() => {});
  }, delayMs);
}

/**
 * Immediately triggers a push without waiting for debouncing.
 */
export function triggerImmediatePush(): void {
  if (autoPushTimeout) {
    clearTimeout(autoPushTimeout);
    autoPushTimeout = null;
  }
  const { gistSyncSettings } = store.getState();
  if (gistSyncSettings?.enabled && gistSyncSettings?.token && gistSyncSettings?.gistId) {
    pushToGist().catch(() => {});
  }
}

/**
 * Initiates the GitHub OAuth authorization flow by redirecting to GitHub.
 * Packages the current page URL into the state parameter so the worker gateway
 * can redirect back to localhost, GitHub Pages, or any custom domain.
 */
export function initiateOAuthLogin(): void {
  if (typeof window === 'undefined') return;

  const csrf = crypto.randomUUID();
  sessionStorage.setItem('codebook_gh_oauth_state', csrf);

  // Package CSRF token and return URL into state
  const statePayload = btoa(
    JSON.stringify({
      csrf,
      returnUrl: window.location.origin + window.location.pathname,
    })
  );

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
    GITHUB_OAUTH_CLIENT_ID
  )}&scope=gist&state=${encodeURIComponent(statePayload)}`;

  window.location.href = authUrl;
}

/**
 * Handles incoming GitHub OAuth redirect callback (?code=...&state=...) on application startup.
 */
export async function handleOAuthCallback(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.location.search) {
    return false;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const rawState = urlParams.get('state');

  if (!code) return false;

  // Extract CSRF from state payload
  let incomingCsrf = rawState;
  if (rawState) {
    try {
      const parsed = JSON.parse(atob(rawState));
      if (parsed.csrf) incomingCsrf = parsed.csrf;
    } catch {}
  }

  // CSRF validation
  const savedState = sessionStorage.getItem('codebook_gh_oauth_state');
  sessionStorage.removeItem('codebook_gh_oauth_state');

  if (savedState && incomingCsrf && incomingCsrf !== savedState) {
    console.error('[sync] OAuth state mismatch (possible CSRF attack).');
    setSyncStatus('error', 'OAuth security verification failed.');
    return false;
  }

  // Remove OAuth query parameters from URL bar without reloading
  urlParams.delete('code');
  urlParams.delete('state');
  const remainingQuery = urlParams.toString();
  const cleanUrl =
    window.location.pathname +
    (remainingQuery ? `?${remainingQuery}` : '') +
    window.location.hash;
  window.history.replaceState({}, document.title, cleanUrl);

  setSyncStatus('syncing', 'Signing in with GitHub...');

  try {
    const exchangeRes = await exchangeOAuthCode(GITHUB_OAUTH_WORKER_URL, code);
    if (!exchangeRes.success || !exchangeRes.token) {
      setSyncStatus('error', exchangeRes.error || 'Failed to exchange authorization code.');
      return false;
    }

    const token = exchangeRes.token;

    setSyncStatus('syncing', 'Locating your Codebook backup...');
    const discoveryRes = await findSiteGist(token);

    if (discoveryRes.success && discoveryRes.gist?.gistId) {
      // Existing backup found for this site instance
      const now = Date.now();
      store.getState().setGistSyncSettings({
        enabled: true,
        token,
        gistId: discoveryRes.gist.gistId,
        autoSync: true,
        lastSyncedAt: now,
      });

      await pullFromGist({ smartMerge: true });
      setSyncStatus('synced', 'Connected to GitHub and synced successfully!', now);
      return true;
    } else {
      // No existing backup found; create a new one
      const createRes = await createAndLinkGist(token);
      if (createRes.success) {
        setSyncStatus('synced', 'Created new Codebook backup on GitHub Gist.');
        return true;
      } else {
        setSyncStatus('error', createRes.error || 'Failed to initialize Gist backup.');
        return false;
      }
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Error during GitHub sign in.';
    setSyncStatus('error', errorMsg);
    return false;
  }
}

/**
 * Checks for OAuth callbacks and remote Gist updates on startup.
 */
export async function initStartupSync(): Promise<void> {
  // Handle any OAuth redirect callback first
  const handledAuth = await handleOAuthCallback();

  const { gistSyncSettings } = store.getState();
  if (!gistSyncSettings?.enabled || !gistSyncSettings?.gistId) {
    return;
  }

  // Setup network status listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      setSyncStatus('idle');
      scheduleAutoPush(1000);
    });
    window.addEventListener('offline', () => {
      setSyncStatus('offline', 'Offline');
    });
  }

  // If we didn't just perform an OAuth pull, perform startup sync
  if (!handledAuth) {
    try {
      await pullFromGist({ smartMerge: true });
    } catch (err) {
      console.warn('[sync] Startup sync failed:', err);
    }
  }
}
