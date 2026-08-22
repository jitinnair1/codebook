// src/core/ai/client.ts
import { store, ChatMessage } from '../store';
import { buildSystemPrompt } from './context';
import { decryptSecret } from '../crypto';

export type StreamStatus = 'connecting' | 'thinking';

export interface StreamOptions {
  userPrompt: string;
  conversationId?: string;
  onChunk: (accumulatedContent: string) => void;
  onStatus?: (status: StreamStatus) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Sends a streaming chat completion request to the configured OpenAI-compatible endpoint.
 * Ingests rich context from the active exercise and streams response tokens back in real-time.
 * Enforces maximum token ceilings and activity timeout to prevent token runaway and hangs.
 */
export async function streamCompletion(options: StreamOptions): Promise<string> {
  const { userPrompt, conversationId, onChunk, onStatus, signal } = options;
  const timeoutMs = options.timeoutMs ?? 120000;
  const state = store.getState();
  const settings = state.chatSettings;
  const { activeLessonSlug } = state;

  if (!settings?.enabled) {
    throw new Error('Rubber Duck is currently disabled. Please enable it in Settings.');
  }

  if (!settings.baseUrl) {
    throw new Error('API Base URL is not configured. Please set it in Settings.');
  }

  const model = settings.model;
  if (!model) {
    throw new Error('No model selected. Please select a model in Settings.');
  }

  const endpoint = resolveEndpoint(settings.baseUrl);
  const { systemPrompt } = buildSystemPrompt();

  // Retrieve past messages for the active conversation of this exercise
  const convId = conversationId || state.activeConversationId[activeLessonSlug];
  const convs = state.chatConversations[activeLessonSlug] || [];
  const activeConv = convs.find(c => c.id === convId) || convs[0];
  const history = (activeConv?.messages || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  // Check if the current user prompt is already recorded in history
  const lastMsg = history[history.length - 1];
  const isAlreadyInHistory = lastMsg && lastMsg.role === 'user' && lastMsg.content === userPrompt;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    ...(isAlreadyInHistory ? [] : [{ role: 'user', content: userPrompt }]),
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const rawKey = settings.apiKey || '';
  const resolvedKey = (await decryptSecret(rawKey)).trim();

  if (resolvedKey) {
    headers['Authorization'] = `Bearer ${resolvedKey}`;
  }

  if (settings.baseUrl.includes('anthropic.com')) {
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  // Setup streaming inactivity timeout & linked AbortController
  const abortController = new AbortController();
  let timeoutId: any = null;
  let isTimedOut = false;

  const resetTimeout = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      isTimedOut = true;
      abortController.abort();
    }, timeoutMs);
  };

  const handleCallerAbort = () => {
    abortController.abort();
  };

  if (signal) {
    if (signal.aborted) {
      abortController.abort();
    } else {
      signal.addEventListener('abort', handleCallerAbort, { once: true });
    }
  }

  resetTimeout();
  onStatus?.('connecting');

  let accumulated = '';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 10000,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMessage = `HTTP ${response.status} (${response.statusText})`;

      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) {
          errorMessage = parsed.error.message;
        }
      } catch {
        if (errorText) {
          errorMessage = errorText.slice(0, 120);
        }
      }

      if (response.status === 401) {
        throw new Error(`Authentication failed (401): ${errorMessage}. Please check your API key in Settings.`);
      } else if (response.status === 404) {
        throw new Error(`Endpoint or model not found (404): ${errorMessage}. Please verify your Base URL and Model name.`);
      } else if (response.status === 429) {
        throw new Error(`Rate limit exceeded (429): ${errorMessage}. Please try again shortly.`);
      }

      throw new Error(`API Error: ${errorMessage}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty (streaming not supported by provider)');
    }

    onStatus?.('thinking');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Reset activity timeout on receipt of streaming token chunks
      resetTimeout();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep trailing uncompleted line

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) continue; // SSE comment or ping

        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text ?? '';
            if (delta) {
              accumulated += delta;
              onChunk(accumulated);
            }
          } catch {
            // ignore malformed JSON chunk in stream
          }
        }
      }
    }
  } catch (err: any) {
    if (isTimedOut) {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. The AI endpoint stopped responding.`);
    }
    if (err.name === 'AbortError' || signal?.aborted) {
      return accumulated; // Return whatever was generated up to cancellation
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', handleCallerAbort);
  }

  return accumulated;
}

function resolveEndpoint(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  if (clean.endsWith('/chat/completions')) {
    return clean;
  }
  if (clean.endsWith('/v1')) {
    return `${clean}/chat/completions`;
  }
  return `${clean}/chat/completions`;
}
