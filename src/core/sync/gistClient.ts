// src/core/sync/gistClient.ts
import { SITE_TITLE, SITE_SLUG } from '../siteConfig';

export const GIST_DEFAULT_DESCRIPTION = `${SITE_TITLE} Progress & Settings Backup`;

export interface TokenValidationResult {
  valid: boolean;
  username?: string;
  scopes?: string[];
  error?: string;
}

export interface GistFileEntry {
  filename: string;
  content?: string;
  truncated?: boolean;
  raw_url?: string;
  size?: number;
}

export interface GistActionResult {
  success: boolean;
  gistId?: string;
  htmlUrl?: string;
  files?: Record<string, GistFileEntry>;
  updatedAt?: string;
  notModified?: boolean;
  error?: string;
}

export interface DiscoveredGist {
  gistId: string;
  htmlUrl?: string;
  updatedAt?: string;
  description?: string;
  filenames: string[];
}

/**
 * Extracts a bare Gist ID from a raw ID or full GitHub Gist URL.
 * Handles inputs like:
 * - "https://gist.github.com/username/6a7b8c9d0e1f2a3b"
 * - "gist.github.com/6a7b8c9d0e1f2a3b#file-progress-json"
 * - "6a7b8c9d0e1f2a3b"
 */
export function extractGistId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Remove fragment (#...) and query parameters (?...)
  const withoutParams = trimmed.split(/[?#]/)[0];

  // If it's a URL, grab the last path segment
  const match =
    withoutParams.match(/(?:gists?\.github\.com\/[^\/]+\/|^)([a-f0-9]+)\/?$/i) ||
    withoutParams.match(/([a-f0-9]{20,32})/i);

  if (match && match[1]) {
    return match[1];
  }

  // Fallback: extract last alphanumeric token after slash
  const segments = withoutParams.split('/').filter(Boolean);
  return segments[segments.length - 1] || trimmed;
}

/**
 * Helper to build GitHub REST API request headers.
 */
function getHeaders(token?: string, ifModifiedSince?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token && token.trim() && !token.startsWith('enc:v1:')) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }
  if (ifModifiedSince) {
    headers['If-Modified-Since'] = ifModifiedSince;
  }
  return headers;
}

/**
 * Parses JSON response error text safely.
 */
async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.message) {
      if (res.status === 401) return 'Bad credentials or expired GitHub token.';
      if (res.status === 404) return 'Gist not found. Check the Gist ID.';
      if (res.status === 403)
        return data.message.includes('rate limit')
          ? 'GitHub API rate limit exceeded. Please try again later.'
          : `Access forbidden: ${data.message}`;
      return data.message;
    }
  } catch {
    // Non-JSON response fallback
  }
  return `GitHub API error (HTTP ${res.status}: ${res.statusText})`;
}

/**
 * Validates a GitHub Personal Access Token against the GitHub API.
 */
export async function validateToken(token: string): Promise<TokenValidationResult> {
  if (!token || !token.trim() || token.startsWith('enc:v1:')) {
    return { valid: false, error: 'Token cannot be empty or un-decrypted.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: getHeaders(token),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorMsg = await parseErrorMessage(res);
      return { valid: false, error: errorMsg };
    }

    const data = await res.json();
    const scopesHeader = res.headers.get('x-oauth-scopes');
    const scopes = scopesHeader ? scopesHeader.split(',').map((s) => s.trim()) : undefined;

    return {
      valid: true,
      username: data.login || 'GitHub User',
      scopes,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      valid: false,
      error: err.name === 'AbortError' ? 'Token validation timed out.' : (err.message || 'Network request failed.'),
    };
  }
}

/**
 * Creates a new secret Gist with the provided multi-file payload.
 */
export async function createGist(
  token: string,
  files: Record<string, string>,
  description = GIST_DEFAULT_DESCRIPTION
): Promise<GistActionResult> {
  if (!token || !token.trim() || token.startsWith('enc:v1:')) {
    return { success: false, error: 'GitHub token is required to create a Gist.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const filesPayload: Record<string, { content: string }> = {};
  for (const [filename, content] of Object.entries(files)) {
    filesPayload[filename] = { content };
  }

  try {
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        public: false, // Secret / unlisted gist
        files: filesPayload,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorMsg = await parseErrorMessage(res);
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    return {
      success: true,
      gistId: data.id,
      htmlUrl: data.html_url,
      updatedAt: data.updated_at,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Gist creation timed out.' : (err.message || 'Network request failed.'),
    };
  }
}

/**
 * Fetches all files and contents from an existing Gist.
 * Supports conditional fetching via options.ifModifiedSince (returns notModified: true on HTTP 304).
 */
export async function fetchGist(
  gistId: string,
  token?: string,
  options?: { ifModifiedSince?: string }
): Promise<GistActionResult> {
  const cleanId = extractGistId(gistId);
  if (!cleanId) {
    return { success: false, error: 'Invalid Gist ID provided.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`https://api.github.com/gists/${cleanId}`, {
      method: 'GET',
      headers: getHeaders(token, options?.ifModifiedSince),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 304) {
      return {
        success: true,
        notModified: true,
        gistId: cleanId,
      };
    }

    if (!res.ok) {
      const errorMsg = await parseErrorMessage(res);
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    const rawFiles = data.files || {};
    const parsedFiles: Record<string, GistFileEntry> = {};

    // Read and resolve all files (handling truncated files if any)
    for (const [filename, fileObj] of Object.entries<any>(rawFiles)) {
      let content = fileObj.content;
      if (fileObj.truncated && fileObj.raw_url) {
        try {
          const rawRes = await fetch(fileObj.raw_url, {
            headers: (token && !token.startsWith('enc:v1:')) ? { Authorization: `Bearer ${token.trim()}` } : {},
          });
          if (rawRes.ok) {
            content = await rawRes.text();
          }
        } catch (e) {
          console.warn(`[sync] Failed to fetch truncated raw file ${filename}:`, e);
        }
      }

      parsedFiles[filename] = {
        filename,
        content,
        truncated: fileObj.truncated,
        raw_url: fileObj.raw_url,
        size: fileObj.size,
      };
    }

    return {
      success: true,
      gistId: data.id,
      htmlUrl: data.html_url,
      files: parsedFiles,
      updatedAt: data.updated_at,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Gist fetch timed out.' : (err.message || 'Network request failed.'),
    };
  }
}

/**
 * Updates an existing Gist with new multi-file contents.
 * Passing null for a filename in `files` removes that file from the Gist.
 */
export async function updateGist(
  gistId: string,
  token: string,
  files: Record<string, string | null>,
  description = GIST_DEFAULT_DESCRIPTION
): Promise<GistActionResult> {
  const cleanId = extractGistId(gistId);
  if (!cleanId) {
    return { success: false, error: 'Invalid Gist ID provided.' };
  }
  if (!token || !token.trim() || token.startsWith('enc:v1:')) {
    return { success: false, error: 'GitHub token is required to update a Gist.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const filesPayload: Record<string, { content: string } | null> = {};
  for (const [filename, content] of Object.entries(files)) {
    filesPayload[filename] = content === null ? null : { content };
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${cleanId}`, {
      method: 'PATCH',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        files: filesPayload,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorMsg = await parseErrorMessage(res);
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    return {
      success: true,
      gistId: data.id,
      htmlUrl: data.html_url,
      updatedAt: data.updated_at,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Gist update timed out.' : (err.message || 'Network request failed.'),
    };
  }
}

/**
 * Exchanges a temporary OAuth authorization code with the Cloudflare Worker proxy for a GitHub access_token.
 */
export async function exchangeOAuthCode(
  workerUrl: string,
  code: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!workerUrl || !workerUrl.trim()) {
    return { success: false, error: 'OAuth worker URL is not configured.' };
  }
  if (!code || !code.trim()) {
    return { success: false, error: 'OAuth code is required.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(workerUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ code: code.trim() }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error_description || data.error || `HTTP ${res.status}: Failed to exchange code.`,
      };
    }

    if (data.access_token) {
      return { success: true, token: data.access_token };
    }

    return { success: false, error: 'No access token received from authorization server.' };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'OAuth exchange timed out.' : (err.message || 'Network request failed.'),
    };
  }
}

/**
 * Searches the authenticated user's Gists to automatically locate an existing backup for this site instance.
 */
export async function findSiteGist(
  token: string
): Promise<{ success: boolean; gist?: DiscoveredGist; error?: string }> {
  if (!token || !token.trim() || token.startsWith('enc:v1:')) {
    return { success: false, error: 'GitHub token is required.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://api.github.com/gists?per_page=100', {
      method: 'GET',
      headers: getHeaders(token),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorMsg = await parseErrorMessage(res);
      return { success: false, error: errorMsg };
    }

    const gists = await res.json();
    if (!Array.isArray(gists)) {
      return { success: true, gist: undefined };
    }

    const targetMetadataFilename = `_${SITE_SLUG}.json`;

    // 1. Primary check: Gist contains this site's exact metadata signature file (e.g. `_codebook.json` or `_learn-rust.json`)
    for (const g of gists) {
      const files = g.files || {};
      if (files[targetMetadataFilename]) {
        return {
          success: true,
          gist: {
            gistId: g.id,
            htmlUrl: g.html_url,
            updatedAt: g.updated_at,
            description: g.description,
            filenames: Object.keys(files),
          },
        };
      }
    }

    // 2. Secondary check: exact description match AND has no conflicting _foreign-slug.json metadata file
    for (const g of gists) {
      if (g.description === GIST_DEFAULT_DESCRIPTION) {
        const files = g.files || {};
        const foreignMetaFile = Object.keys(files).find(
          (fn) => fn.startsWith('_') && fn.endsWith('.json') && fn !== targetMetadataFilename
        );
        if (!foreignMetaFile) {
          return {
            success: true,
            gist: {
              gistId: g.id,
              htmlUrl: g.html_url,
              updatedAt: g.updated_at,
              description: g.description,
              filenames: Object.keys(files),
            },
          };
        }
      }
    }

    return { success: true, gist: undefined };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Gist discovery timed out.' : (err.message || 'Network request failed.'),
    };
  }
}
