import { SITE_TITLE, SITE_SLUG } from '../siteConfig';

export const GIST_DEFAULT_FILENAME = `${SITE_SLUG}-sync.json`;
export const GIST_DEFAULT_DESCRIPTION = `${SITE_TITLE} Progress & Settings Backup`;

export interface TokenValidationResult {
  valid: boolean;
  username?: string;
  scopes?: string[];
  error?: string;
}

export interface GistActionResult {
  success: boolean;
  gistId?: string;
  htmlUrl?: string;
  content?: string;
  filename?: string;
  updatedAt?: string;
  error?: string;
}

/**
 * Extracts a bare Gist ID from a raw ID or full GitHub Gist URL.
 * Handles inputs like:
 * - "https://gist.github.com/username/6a7b8c9d0e1f2a3b"
 * - "gist.github.com/6a7b8c9d0e1f2a3b#file-codebook-sync-json"
 * - "6a7b8c9d0e1f2a3b"
 */
export function extractGistId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Remove fragment (#...) and query parameters (?...)
  const withoutParams = trimmed.split(/[?#]/)[0];

  // If it's a URL, grab the last path segment
  const match = withoutParams.match(/(?:gists?\.github\.com\/[^\/]+\/|^)([a-f0-9]+)\/?$/i) ||
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
function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
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
      if (res.status === 403) return data.message.includes('rate limit')
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
  if (!token || !token.trim()) {
    return { valid: false, error: 'Token cannot be empty.' };
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
 * Creates a new secret Gist with the provided JSON backup content.
 */
export async function createGist(
  token: string,
  content: string,
  description = GIST_DEFAULT_DESCRIPTION,
  filename = GIST_DEFAULT_FILENAME
): Promise<GistActionResult> {
  if (!token || !token.trim()) {
    return { success: false, error: 'GitHub token is required to create a Gist.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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
        files: {
          [filename]: {
            content,
          },
        },
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
 * Fetches and extracts backup JSON content from an existing Gist.
 */
export async function fetchGist(gistId: string, token?: string): Promise<GistActionResult> {
  const cleanId = extractGistId(gistId);
  if (!cleanId) {
    return { success: false, error: 'Invalid Gist ID provided.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`https://api.github.com/gists/${cleanId}`, {
      method: 'GET',
      headers: getHeaders(token),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorMsg = await parseErrorMessage(res);
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    const files = data.files || {};

    // Look for sync file in gist (primary filename, legacy codebook-sync.json, or first json file)
    const targetFile = files[GIST_DEFAULT_FILENAME] || files['codebook-sync.json'] || Object.values(files).find((f: any) => f?.filename?.endsWith?.('.json'));
    const resolvedFilename = targetFile?.filename || GIST_DEFAULT_FILENAME;

    if (!targetFile) {
      return { success: false, error: `Gist does not contain ${GIST_DEFAULT_FILENAME}.` };
    }

    let fileContent = targetFile.content;

    // Handle large / truncated gist files by fetching raw_url
    if (targetFile.truncated && targetFile.raw_url) {
      const rawRes = await fetch(targetFile.raw_url, {
        headers: token ? { 'Authorization': `Bearer ${token.trim()}` } : {},
      });
      if (rawRes.ok) {
        fileContent = await rawRes.text();
      }
    }

    if (typeof fileContent !== 'string') {
      return { success: false, error: 'Could not read content from Gist file.' };
    }

    return {
      success: true,
      gistId: data.id,
      htmlUrl: data.html_url,
      content: fileContent,
      filename: resolvedFilename,
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
 * Updates an existing Gist with new backup JSON content.
 */
export async function updateGist(
  gistId: string,
  token: string,
  content: string,
  filename = GIST_DEFAULT_FILENAME,
  description = GIST_DEFAULT_DESCRIPTION
): Promise<GistActionResult> {
  const cleanId = extractGistId(gistId);
  if (!cleanId) {
    return { success: false, error: 'Invalid Gist ID provided.' };
  }
  if (!token || !token.trim()) {
    return { success: false, error: 'GitHub token is required to update a Gist.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`https://api.github.com/gists/${cleanId}`, {
      method: 'PATCH',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        files: {
          [filename]: {
            content,
          },
        },
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
