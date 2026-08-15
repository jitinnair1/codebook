import { elements } from '../core/elements';
import { store, ChatMessage } from '../core/store';
import { ICONS } from './icons';
import { parseChatMarkdown } from '../core/markdown';
import { copyToClipboardSafe } from '../core/clipboard';
import { streamCompletion, StreamStatus } from '../core/chat/client';
import { flushAutoSave } from '../core/editor';

export interface QuickStart {
  id: string;
  label: string;
  prompt: string;
}

export const DEFAULT_QUICK_CHIPS: QuickStart[] = [
  { id: 'hint', label: 'Hint', prompt: 'Can you give me a subtle hint on how to approach this problem?' },
  { id: 'explain-error', label: 'Explain error', prompt: 'Can you explain the error in the console and what might be causing it?' },
  { id: 'guide-approach', label: 'Guide approach', prompt: 'How should I structure my logic for this exercise?' },
  { id: 'review-code', label: 'Review code', prompt: 'Can you review my current code and point out potential issues?' },
];

export interface ActiveStreamSession {
  exerciseId: string;
  abortController: AbortController;
  status: StreamStatus;
  accumulatedText: string;
}

const activeStreams = new Map<string, ActiveStreamSession>();

export function isStreamingActive(exerciseId?: string): boolean {
  const exId = exerciseId ?? store.getState().currentExerciseId;
  return activeStreams.has(exId);
}

export function abortAllStreams() {
  for (const session of activeStreams.values()) {
    session.abortController.abort();
  }
  activeStreams.clear();
}

let lastRenderedExerciseId: string | null = null;
let lastChatEnabledState: boolean | null = null;
let lastRenderedChatHistory: ChatMessage[] | null = null;

export function initChatPanel() {
  // Populate static icons
  if (elements.chat.clearBtn) {
    elements.chat.clearBtn.innerHTML = ICONS.TRASH;
  }
  if (elements.chat.sendBtn) {
    elements.chat.sendBtn.innerHTML = ICONS.SEND;
  }

  // Bind static listeners
  bindPanelEvents();

  // Initial UI sync
  syncPanelVisibility();
  renderQuickChips();
  renderChatMessages();

  // Handle post-hydration sync if store finishes hydrating asynchronously
  if ((store as any).persist?.onFinishHydration) {
    (store as any).persist.onFinishHydration(() => {
      syncPanelVisibility();
      renderChatMessages();
    });
  }

  // Subscribe to store updates for exercise switch and chat settings/history changes
  store.subscribe(() => {
    const state = store.getState();
    const currentExId = state.currentExerciseId;
    const cs = state.chatSettings;
    const chatEnabled = !!cs?.enabled;
    const currentMessages = state.chatHistory[currentExId] || [];

    // Toggle panel visibility if chat enabled state changed
    if (chatEnabled !== lastChatEnabledState) {
      lastChatEnabledState = chatEnabled;
      syncPanelVisibility();
    }

    const isExerciseChanged = currentExId !== lastRenderedExerciseId;
    const isHistoryChanged = currentMessages !== lastRenderedChatHistory;

    // Re-render messages & reset scroll if exercise changed or history changed
    if (isExerciseChanged || isHistoryChanged) {
      if (isExerciseChanged) {
        // Reset scroll position to top of problem description
        if (elements.chat.scrollContainer) {
          elements.chat.scrollContainer.scrollTop = 0;
        }
      }
      lastRenderedExerciseId = currentExId;
      lastRenderedChatHistory = currentMessages;
      renderChatMessages();
      updateSendButtonState();

      // If switching to an exercise that currently has an active stream running, re-attach streaming UI
      const activeSession = activeStreams.get(currentExId);
      if (activeSession) {
        if (activeSession.accumulatedText) {
          appendStreamingToken(
            activeSession.accumulatedText,
            activeSession.status === 'connecting' ? 'Connecting...' : 'Thinking...'
          );
        } else {
          showStreamingPlaceholder(
            activeSession.status === 'connecting' ? 'Connecting...' : 'Thinking...'
          );
        }
      }
    }
  });
}

export function syncPanelVisibility() {
  const cs = store.getState().chatSettings;
  const isEnabled = !!cs?.enabled;

  if (elements.chat.section) {
    if (isEnabled) {
      elements.chat.section.classList.remove('hidden');
    } else {
      elements.chat.section.classList.add('hidden');
    }
  }

  if (elements.chat.inputContainer) {
    if (isEnabled) {
      elements.chat.inputContainer.classList.remove('hidden');
      elements.chat.inputContainer.classList.add('flex');
    } else {
      elements.chat.inputContainer.classList.remove('flex');
      elements.chat.inputContainer.classList.add('hidden');
    }
  }
}

export function scrollToChat(smooth: boolean = true) {
  const scrollContainer = elements.chat.scrollContainer;
  const chatSection = elements.chat.section;
  if (!scrollContainer || !chatSection) return;

  const targetOffset = chatSection.offsetTop - 16;
  scrollContainer.scrollTo({
    top: Math.max(0, targetOffset),
    behavior: smooth ? 'smooth' : 'auto',
  });
}

export function focusChatInput() {
  const cs = store.getState().chatSettings;
  if (cs?.enabled && elements.chat.input) {
    elements.chat.input.focus();
    scrollToChat(true);
  }
}

export function isChatEnabled(): boolean {
  return !!store.getState().chatSettings?.enabled;
}

export function renderQuickChips(chips: QuickStart[] = DEFAULT_QUICK_CHIPS) {
  const container = elements.chat.quickChips;
  if (!container) return;

  container.innerHTML = chips.map(chip => `
    <button type="button"
      data-chip-id="${chip.id}"
      class="ai-quick-chip px-2 py-0.5 text-[10px] font-medium rounded bg-bg-app hover:bg-border-default text-fg-secondary hover:text-fg-primary transition-colors whitespace-nowrap cursor-pointer shrink-0">
      ${escapeHtml(chip.label)}
    </button>
  `).join('');

  const chipButtons = container.querySelectorAll<HTMLButtonElement>('.ai-quick-chip');
  chipButtons.forEach(button => {
    button.addEventListener('click', () => {
      const chipId = button.getAttribute('data-chip-id');
      const targetChip = chips.find(c => c.id === chipId);
      if (targetChip) {
        handleQuickChipClick(targetChip);
      }
    });
  });
}

function handleQuickChipClick(chip: QuickStart) {
  const currentExId = store.getState().currentExerciseId;
  if (activeStreams.has(currentExId)) return;

  if (elements.chat.input) {
    elements.chat.input.value = chip.prompt;
    handleInputResize();
    scrollToChat(true);
    submitUserMessage();
  }
}

const DEFAULT_EMPTY_STATE_HTML = `
  <div class="text-xs text-fg-muted leading-relaxed space-y-1 select-none">
    <p class="text-fg-secondary">Ask for hints, error explanations, or architectural guidance without spoiling the solution.</p>
    <p class="text-[11px] text-fg-muted">Click a suggestion below or type a question to get started.</p>
  </div>
`;

export function renderChatMessages() {
  const container = elements.chat.messages;
  if (!container) return;

  const currentExId = store.getState().currentExerciseId;
  const messages: ChatMessage[] = store.getState().chatHistory[currentExId] || [];
  lastRenderedExerciseId = currentExId;
  lastRenderedChatHistory = messages;

  if (messages.length === 0) {
    container.innerHTML = DEFAULT_EMPTY_STATE_HTML;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isUser = msg.role === 'user';
    const timeStr = formatMessageTime(msg.timestamp);

    if (isUser) {
      return `
        <div class="space-y-1">
          <div class="flex items-center gap-2 text-[10px] text-fg-muted">
            <span class="font-bold text-brand uppercase tracking-wider">You</span>
            <span>•</span>
            <span>${timeStr}</span>
          </div>
          <div class="text-xs text-fg-primary leading-relaxed pl-2.5 border-l-2 border-brand/50">
            ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    } else {
      const parsedHtml = parseChatMarkdown(msg.content);
      return `
        <div class="space-y-1">
          <div class="flex items-center gap-2 text-[10px] text-fg-muted">
            <span class="font-bold text-fg-muted uppercase tracking-wider">Rubber Duck</span>
            <span>•</span>
            <span>${timeStr}</span>
          </div>
          <div class="text-xs text-fg-primary leading-relaxed prose prose-invert prose-sm max-w-none">
            ${parsedHtml}
          </div>
        </div>
      `;
    }
  }).join('');

  // Render KaTeX if auto-render is available in global scope
  renderMathInChat(container);
}

export function showStreamingPlaceholder(statusText: string = 'Connecting...') {
  const container = elements.chat.messages;
  if (!container) return;

  const existing = container.querySelector('#chat-streaming-wrapper');
  if (existing) existing.remove();

  const bubbleWrapper = document.createElement('div');
  bubbleWrapper.id = 'chat-streaming-wrapper';
  bubbleWrapper.className = 'space-y-1';
  bubbleWrapper.innerHTML = `
    <div class="flex items-center gap-2 text-[10px] text-fg-muted">
      <span class="font-bold text-fg-muted uppercase tracking-wider">Rubber Duck</span>
      <span>•</span>
      <span id="chat-streaming-status" class="text-brand animate-pulse">${escapeHtml(statusText)}</span>
    </div>
    <div id="chat-streaming-bubble" class="text-xs text-fg-primary leading-relaxed prose prose-invert prose-sm max-w-none">
    </div>
  `;
  container.appendChild(bubbleWrapper);
  scrollToBottom(false);
}

export function updateStreamingStatus(statusText: string) {
  const statusEl = document.getElementById('chat-streaming-status');
  if (statusEl) {
    statusEl.textContent = statusText;
  }
}

export function appendStreamingToken(partialContent: string, statusText?: string) {
  const container = elements.chat.messages;
  if (!container) return;

  let streamBubble = container.querySelector<HTMLElement>('#chat-streaming-bubble');
  if (!streamBubble) {
    showStreamingPlaceholder(statusText || 'Thinking...');
    streamBubble = container.querySelector<HTMLElement>('#chat-streaming-bubble');
  }

  if (statusText) {
    updateStreamingStatus(statusText);
  }

  if (streamBubble) {
    const html = parseChatMarkdown(partialContent);
    streamBubble.innerHTML = html;
    renderMathInChat(streamBubble);
    scrollToBottom(false);
  }
}

function bindPanelEvents() {
  // Clear chat button
  elements.chat.clearBtn?.addEventListener('click', () => {
    const currentExId = store.getState().currentExerciseId;
    abortCurrentGeneration(currentExId);
    store.getState().clearChatHistory(currentExId);
    renderChatMessages();
  });

  // Delegated safe copy handler for code blocks in chat
  elements.chat.messages?.addEventListener('click', async (e) => {
    const target = (e.target as HTMLElement).closest('.chat-copy-code-btn') as HTMLButtonElement | null;
    if (!target) return;

    const container = target.closest('.code-block-container');
    const codeEl = container?.querySelector('code');
    const textToCopy = codeEl?.textContent || '';
    if (!textToCopy) return;

    const success = await copyToClipboardSafe(textToCopy);
    if (success) {
      const originalHtml = target.innerHTML;
      target.innerHTML = `<span class="text-green-500 font-medium select-none">✓ Copied</span>`;
      setTimeout(() => {
        target.innerHTML = originalHtml;
      }, 2000);
    }
  });

  // Chat input focus, resize & submit listeners
  const input = elements.chat.input;
  const sendBtn = elements.chat.sendBtn;

  if (input) {
    input.addEventListener('focus', () => {
      scrollToChat(true);
    });

    input.addEventListener('input', handleInputResize);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitUserMessage();
      }
    });
  }

  sendBtn?.addEventListener('click', () => {
    const currentExId = store.getState().currentExerciseId;
    if (activeStreams.has(currentExId)) {
      abortCurrentGeneration(currentExId);
    } else {
      submitUserMessage();
    }
  });
}

function handleInputResize() {
  const input = elements.chat.input;
  if (!input) return;

  input.style.height = 'auto';
  const newHeight = Math.min(input.scrollHeight, 80);
  input.style.height = `${Math.max(20, newHeight)}px`;

  updateSendButtonState();
}

function updateSendButtonState() {
  const sendBtn = elements.chat.sendBtn;
  const input = elements.chat.input;
  if (!sendBtn) return;

  const currentExId = store.getState().currentExerciseId;
  const isStreaming = activeStreams.has(currentExId);

  if (isStreaming) {
    sendBtn.innerHTML = ICONS.STOP;
    sendBtn.title = 'Stop generating';
    sendBtn.disabled = false;
    sendBtn.classList.add('bg-red-500', 'text-white');
    sendBtn.classList.remove('bg-brand');
  } else {
    sendBtn.innerHTML = ICONS.SEND;
    sendBtn.title = 'Send Message';
    sendBtn.disabled = !input?.value.trim();
    sendBtn.classList.remove('bg-red-500');
    sendBtn.classList.add('bg-brand');
  }
}

function abortCurrentGeneration(exerciseId?: string) {
  const targetId = exerciseId ?? store.getState().currentExerciseId;
  const session = activeStreams.get(targetId);
  if (session) {
    session.abortController.abort();
    activeStreams.delete(targetId);
    updateSendButtonState();
  }
}

async function submitUserMessage() {
  const currentExId = store.getState().currentExerciseId;

  if (activeStreams.has(currentExId)) {
    abortCurrentGeneration(currentExId);
    return;
  }

  const input = elements.chat.input;
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  // Flush any pending auto-save from the active editor so store is 100% up to date
  flushAutoSave();

  // Add user message to store
  const userMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'user',
    content,
    timestamp: Date.now(),
  };

  store.getState().addChatMessage(currentExId, userMsg);

  // Clear input & reset height
  input.value = '';
  handleInputResize();
  renderChatMessages();
  scrollToBottom(true);

  // Create stream session for this exercise
  const abortController = new AbortController();
  const session: ActiveStreamSession = {
    exerciseId: currentExId,
    abortController,
    status: 'connecting',
    accumulatedText: '',
  };
  activeStreams.set(currentExId, session);

  updateSendButtonState();
  showStreamingPlaceholder('Connecting...');

  // Detached background stream execution
  streamCompletion({
    userPrompt: content,
    onStatus: (status: StreamStatus) => {
      session.status = status;
      if (store.getState().currentExerciseId === currentExId) {
        updateStreamingStatus(status === 'connecting' ? 'Connecting...' : 'Thinking...');
      }
    },
    onChunk: (text) => {
      session.accumulatedText = text;
      if (store.getState().currentExerciseId === currentExId) {
        appendStreamingToken(text);
      }
    },
    signal: abortController.signal,
  })
    .then((accumulatedResponse) => {
      if (accumulatedResponse.trim()) {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: accumulatedResponse,
          timestamp: Date.now(),
        };
        store.getState().addChatMessage(currentExId, assistantMsg);
      }
    })
    .catch((err: any) => {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        if (session.accumulatedText.trim()) {
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role: 'assistant',
            content: session.accumulatedText,
            timestamp: Date.now(),
          };
          store.getState().addChatMessage(currentExId, assistantMsg);
        }
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: `⚠️ **Unable to get response**\n\n${err?.message || 'Unknown network error. Please check your API settings.'}`,
          timestamp: Date.now(),
        };
        store.getState().addChatMessage(currentExId, errorMsg);
      }
    })
    .finally(() => {
      activeStreams.delete(currentExId);
      if (store.getState().currentExerciseId === currentExId) {
        updateSendButtonState();
        renderChatMessages();
        scrollToBottom(true);
      }
    });
}

function renderMathInChat(element: HTMLElement) {
  if (typeof (window as any).renderMathInElement === 'function') {
    try {
      (window as any).renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    } catch {
      // ignore KaTeX rendering errors on malformed math
    }
  }
}

function scrollToBottom(smooth: boolean = true) {
  const scrollContainer = elements.chat.scrollContainer;
  if (scrollContainer) {
    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }
}

function formatMessageTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


