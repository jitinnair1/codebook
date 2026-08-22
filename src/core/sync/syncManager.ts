// src/core/sync/syncManager.ts
import { GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_WORKER_URL } from './oauthConfig';
import { store, ensureSettingsDecrypted } from '../store';
import { createGist, fetchGist, updateGist, exchangeOAuthCode, findSiteGist, GistActionResult } from './gistClient';
import { buildGistFiles, parseAndMergeGistFiles, BACKUP_FILENAMES } from '../backup';
import { SITE_SLUG, SITE_TITLE } from '../siteConfig';
import { showPopup } from '../../ui/popup';

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
let lastFocusCheckAt = 0;
const FOCUS_CHECK_COOLDOWN_MS = 15_000;
let lastPushedPayloadString: string | null = null;

/**
 * Validates that remote Gist files belong to the current site instance and not a different template site.
 */
export function validateGistSiteMatch(files: Record<string, any>): { valid: boolean; error?: string } {
  const expectedMeta = `_${SITE_SLUG}.json`;
  const foreignMeta = Object.keys(files).find(
    (fn) => fn.startsWith('_') && fn.endsWith('.json') && fn !== expectedMeta
  );
  if (foreignMeta) {
    const foreignSlug = foreignMeta.slice(1, -5);
    return {
      valid: false,
      error: `Gist belongs to a different site instance ('${foreignSlug}'). Current site is '${SITE_SLUG}'.`,
    };
  }
  return { valid: true };
}

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
 * Pushes the current application state as multi-file backup to GitHub Gist.
 * Includes CAS (Compare-And-Swap) conflict check: if remote was updated by another device, merges first.
 */
export async function pushToGist(): Promise<GistActionResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus('offline', 'Cannot sync while offline.');
    return { success: false, error: 'Offline' };
  }

  if (store.getState().gistSyncSettings?.token?.startsWith('enc:v1:')) {
    await ensureSettingsDecrypted();
  }

  const { gistSyncSettings } = store.getState();
  if (!gistSyncSettings?.enabled || !gistSyncSettings?.token || !gistSyncSettings?.gistId) {
    return { success: false, error: 'Gist sync is not configured or enabled.' };
  }

  if (gistSyncSettings.token.startsWith('enc:v1:')) {
    return { success: false, error: 'GitHub credentials are not yet decrypted.' };
  }

  if (isSyncInProgress) {
    return { success: false, error: 'A sync operation is already in progress.' };
  }

  isSyncInProgress = true;
  setSyncStatus('syncing');

  try {
    const pullRes = await pullAndMergeIfNeeded(
      gistSyncSettings.gistId,
      gistSyncSettings.token,
      gistSyncSettings.lastSyncedAt
    );
    
    if (pullRes.error) {
      setSyncStatus('error', pullRes.error);
      return { success: false, error: pullRes.error };
    }

    const newFiles = await buildGistFiles(store.getState());
    
    const currentPayloadString = JSON.stringify(newFiles);
    if (!pullRes.merged && currentPayloadString === lastPushedPayloadString) {
      const now = Date.now();
      setSyncStatus('synced', 'Synced successfully.', now);
      return { success: true };
    }

    const validFileSet = new Set(Object.values(BACKUP_FILENAMES));

    const filesToUpdate: Record<string, string | null> = { ...newFiles };

    // Mark any obsolete files currently on the Gist for permanent deletion
    if (pullRes.files) {
      for (const existingFilename of Object.keys(pullRes.files)) {
        if (!validFileSet.has(existingFilename as any)) {
          filesToUpdate[existingFilename] = null;
        }
      }
    }

    const res = await updateGist(gistSyncSettings.gistId, gistSyncSettings.token, filesToUpdate);

    if (res.success) {
      lastPushedPayloadString = currentPayloadString;
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
 * Pulls multi-file backup data from GitHub Gist and updates local state.
 */
export async function pullFromGist(options?: { smartMerge?: boolean }): Promise<GistActionResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus('offline', 'Cannot sync while offline.');
    return { success: false, error: 'Offline' };
  }

  if (store.getState().gistSyncSettings?.token?.startsWith('enc:v1:')) {
    await ensureSettingsDecrypted();
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
    if (!res.success || !res.files) {
      setSyncStatus('error', res.error || 'Failed to fetch Gist content.');
      return res;
    }

    // Pre-flight check: ensure remote Gist belongs to this site
    const siteMatch = validateGistSiteMatch(res.files);
    if (!siteMatch.valid) {
      setSyncStatus('error', siteMatch.error);
      return { success: false, error: siteMatch.error };
    }

    const smartMerge = options?.smartMerge !== false;
    const currentState = store.getState();
    const parsed = parseAndMergeGistFiles(res.files, currentState, smartMerge);

    if (!parsed || !parsed.data) {
      const errorMsg = 'Gist content does not contain valid backup files.';
      setSyncStatus('error', errorMsg);
      return { success: false, error: errorMsg };
    }

    store.setState(parsed.data);

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
 * Creates a new secret Gist with multi-file state and links it to settings.
 */
export async function createAndLinkGist(token: string): Promise<GistActionResult> {
  if (!token || !token.trim()) {
    return { success: false, error: 'GitHub Personal Access Token is required.' };
  }

  setSyncStatus('syncing');

  try {
    const files = await buildGistFiles(store.getState());
    const res = await createGist(token, files);

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
export function scheduleAutoPush(delayMs = 5000): void {
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
  showPopup('Syncing from GitHub...');

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
      showPopup('Connected to GitHub!');
      return true;
    } else {
      // No existing backup found; create a new one
      const createRes = await createAndLinkGist(token);
      if (createRes.success) {
        setSyncStatus('synced', 'Created new Codebook backup on GitHub Gist.');
        showPopup('Connected to GitHub!');
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
 * Checks if remote Gist has newer changes when app regains focus or visibility.
 * Throttled to at most once per FOCUS_CHECK_COOLDOWN_MS (15s) and uses conditional If-Modified-Since.
 */
export async function checkAndPullOnFocus(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  if (store.getState().gistSyncSettings?.token?.startsWith('enc:v1:')) {
    await ensureSettingsDecrypted();
  }

  const { gistSyncSettings } = store.getState();
  if (!gistSyncSettings?.enabled || !gistSyncSettings?.token || !gistSyncSettings?.gistId || gistSyncSettings.token.startsWith('enc:v1:')) return;

  // Guard: Do not pull if a sync is already in progress or user is actively typing
  if (isSyncInProgress || autoPushTimeout !== null) return;

  const now = Date.now();
  if (now - lastFocusCheckAt < FOCUS_CHECK_COOLDOWN_MS) return;
  lastFocusCheckAt = now;

  try {
    await pullAndMergeIfNeeded(
      gistSyncSettings.gistId,
      gistSyncSettings.token,
      gistSyncSettings.lastSyncedAt
    );
  } catch (err) {
    console.warn('[sync] Focus check failed:', err);
  }
}

/**
 * Checks for OAuth callbacks and remote Gist updates on startup.
 */
export async function initStartupSync(): Promise<void> {
  // Setup network and visibility status listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      setSyncStatus('idle');
      scheduleAutoPush(1000);
    });
    window.addEventListener('offline', () => {
      setSyncStatus('offline', 'Offline');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAndPullOnFocus().catch(() => {});
      }
    });
  }

  // Handle any OAuth redirect callback first
  const handledAuth = await handleOAuthCallback();

  if (store.getState().gistSyncSettings?.token?.startsWith('enc:v1:')) {
    await ensureSettingsDecrypted();
  }

  const { gistSyncSettings } = store.getState();
  if (!gistSyncSettings?.enabled || !gistSyncSettings?.gistId) {
    return;
  }

  // If we didn't just perform an OAuth pull, perform startup sync
  if (!handledAuth) {
    try {
      if (gistSyncSettings.token && gistSyncSettings.lastSyncedAt) {
        await pullAndMergeIfNeeded(
          gistSyncSettings.gistId,
          gistSyncSettings.token,
          gistSyncSettings.lastSyncedAt
        );
      } else {
        await pullFromGist({ smartMerge: true });
      }
    } catch (err) {
      console.warn('[sync] Startup sync failed:', err);
    }
  }
}

/**
 * Fetches remote state and merges into local if newer.
 * Returns whether a merge occurred.
 */
export async function pullAndMergeIfNeeded(
  gistId: string,
  token: string,
  lastSyncedAt?: number
): Promise<{ merged: boolean; error?: string; files?: Record<string, any> }> {
  const lastSyncedIso = lastSyncedAt
    ? new Date(lastSyncedAt).toUTCString()
    : undefined;

  const res = await fetchGist(gistId, token, { ifModifiedSince: lastSyncedIso });

  if (res.notModified) return { merged: false };
  if (!res.success || !res.files) return { merged: false, error: res.error };

  const siteMatch = validateGistSiteMatch(res.files);
  if (!siteMatch.valid) return { merged: false, error: siteMatch.error };

  const remoteUpdatedAt = res.updatedAt ? new Date(res.updatedAt).getTime() : 0;
  if (remoteUpdatedAt > (lastSyncedAt || 0)) {
    const currentState = store.getState();
    const parsed = parseAndMergeGistFiles(res.files, currentState, true);
    if (parsed && parsed.data) {
      store.setState(parsed.data);
      const syncNow = Date.now();
      store.getState().setGistSyncSettings({ lastSyncedAt: syncNow });
      setSyncStatus('synced', 'Synced with cloud.', syncNow);
      return { merged: true, files: res.files };
    }
  }

  return { merged: false, files: res.files };
}
