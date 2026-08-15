// src/ui/aiChatSidebar.ts
import { elements } from '../core/elements';
import { store, ChatMessage } from '../core/store';
import { ICONS } from './icons';
import { marked } from 'marked';
import { streamCompletion } from '../core/chat/client';

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

let isSidebarOpen = false;
let isStreaming = false;
let currentAbortController: AbortController | null = null;
let lastRenderedExerciseId: string | null = null;
let lastChatEnabledState: boolean | null = null;
let lastChatModel: string | null = null;

export function initChatSidebar() {
  // Populate static icons
  if (elements.chat.btn) {
    elements.chat.btn.innerHTML = ICONS.SPARKLES;
  }
  if (elements.chat.icon) {
    elements.chat.icon.innerHTML = ICONS.SPARKLES;
  }
  if (elements.chat.clearBtn) {
    elements.chat.clearBtn.innerHTML = ICONS.TRASH;
  }
  if (elements.chat.closeBtn) {
    elements.chat.closeBtn.innerHTML = ICONS.CLOSE;
  }
  if (elements.chat.sendBtn) {
    elements.chat.sendBtn.innerHTML = ICONS.SEND;
  }

  // Bind static listeners
  bindSidebarEvents();

  // Initial UI sync
  syncSidebarVisibility();
  renderModelBadge();
  renderQuickChips();
  renderChatMessages();

  // Subscribe to store updates for exercise switch and chat settings changes
  store.subscribe(() => {
    const state = store.getState();
    const currentExId = state.currentExerciseId;
    const cs = state.chatSettings;
    const chatEnabled = !!cs?.enabled;
    const chatModel = cs?.model;

    // Toggle button visibility if chat enabled state changed
    if (chatEnabled !== lastChatEnabledState) {
      lastChatEnabledState = chatEnabled;
      syncSidebarVisibility();
      if (!chatEnabled && isSidebarOpen) {
        closeChatSidebar();
      }
    }

    // Update model badge if model changed
    if (chatModel !== lastChatModel) {
      lastChatModel = chatModel;
      renderModelBadge();
    }

    // Re-render messages if exercise changed
    if (currentExId !== lastRenderedExerciseId) {
      // Abort any ongoing stream for the previous exercise
      if (isStreaming && currentAbortController) {
        currentAbortController.abort();
      }
      lastRenderedExerciseId = currentExId;
      renderChatMessages();
    }
  });
}

export function toggleChatSidebar(forceState?: boolean) {
  const targetState = forceState !== undefined ? forceState : !isSidebarOpen;
  if (targetState) {
    openChatSidebar();
  } else {
    closeChatSidebar();
  }
}

export function openChatSidebar() {
  isSidebarOpen = true;
  updateSidebarDOM();
  renderChatMessages();
  elements.chat.input?.focus();
}

export function closeChatSidebar() {
  isSidebarOpen = false;
  updateSidebarDOM();
}

export function isChatOpen(): boolean {
  return isSidebarOpen;
}

// Aliases for compatibility
export {
  initChatSidebar as initAIChatSidebar,
  toggleChatSidebar as toggleAIChatSidebar,
  openChatSidebar as openAIChatSidebar,
  closeChatSidebar as closeAIChatSidebar,
  isChatOpen as isAIChatOpen,
};

function syncSidebarVisibility() {
  const cs = store.getState().chatSettings;
  const isEnabled = !!cs?.enabled;
  if (elements.chat.btn) {
    if (isEnabled) {
      elements.chat.btn.classList.remove('hidden');
      elements.chat.btn.classList.add('hidden', 'md:block');
    } else {
      elements.chat.btn.classList.remove('md:block');
      elements.chat.btn.classList.add('hidden');
    }
  }
}

function updateSidebarDOM() {
  const sidebar = elements.chat.sidebar;
  const btn = elements.chat.btn;

  if (isSidebarOpen) {
    sidebar?.classList.remove('hidden');
    sidebar?.classList.add('hidden', 'md:flex');

    btn?.classList.add('text-brand', 'bg-brand/10');
    btn?.classList.remove('text-fg-muted');
  } else {
    sidebar?.classList.remove('md:flex');
    sidebar?.classList.add('hidden');

    btn?.classList.remove('text-brand', 'bg-brand/10');
    btn?.classList.add('text-fg-muted');
  }
}

function renderModelBadge() {
  if (!elements.chat.modelBadge) return;
  const cs = store.getState().chatSettings;
  const model = cs?.model || '(No model selected)';
  elements.chat.modelBadge.textContent = model;
  elements.chat.modelBadge.title = `Active Model: ${model}`;
}

export function renderQuickChips(chips: QuickStart[] = DEFAULT_QUICK_CHIPS) {
  const container = elements.chat.quickChips;
  if (!container) return;

  container.innerHTML = chips.map(chip => `
    <button type="button"
      data-chip-id="${chip.id}"
      class="ai-quick-chip px-2.5 py-1 text-[11px] font-medium rounded-full bg-bg-app border border-border-default hover:border-brand hover:text-brand text-fg-secondary transition-all whitespace-nowrap cursor-pointer shrink-0 shadow-2xs">
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
  if (isStreaming) return;

  if (elements.chat.input) {
    elements.chat.input.value = chip.prompt;
    handleInputResize();
    submitUserMessage();
  }
}

export function renderChatMessages() {
  const container = elements.chat.messages;
  if (!container) return;

  const currentExId = store.getState().currentExerciseId;
  const messages: ChatMessage[] = store.getState().chatHistory[currentExId] || [];

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-4 text-fg-muted space-y-3 my-auto select-none">
        <div class="p-3 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
          ${ICONS.SPARKLES}
        </div>
        <div class="space-y-1">
          <h3 class="text-sm font-semibold text-fg-primary">Rubber Duck</h3>
          <p class="text-[11px] text-fg-muted max-w-60 leading-relaxed">
            I'll guide your thinking, diagnose errors, and give hints without giving away the solution.
          </p>
        </div>
        <div class="pt-2 text-[10px] text-fg-muted border-t border-border-default/60 w-full max-w-50">
          Click a suggestion below or type a question to get started.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isUser = msg.role === 'user';
    const timeStr = formatMessageTime(msg.timestamp);

    if (isUser) {
      return `
        <div class="flex flex-col items-end space-y-1 ml-6">
          <div class="flex items-center gap-1.5 text-[10px] text-fg-muted px-1">
            <span class="font-medium text-fg-secondary">You</span>
            <span>•</span>
            <span>${timeStr}</span>
          </div>
          <div class="bg-brand/10 border border-brand/25 text-fg-primary rounded-2xl rounded-tr-xs px-3.5 py-2.5 text-xs leading-relaxed wrap-break-word max-w-full">
            ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    } else {
      const parsedHtml = marked.parse(msg.content) as string;
      return `
        <div class="flex flex-col items-start space-y-1 mr-4">
          <div class="flex items-center gap-1.5 text-[10px] text-fg-muted px-1">
            <span class="text-brand flex items-center">${ICONS.SPARKLES}</span>
            <span class="font-semibold text-fg-primary">Rubber Duck</span>
            <span>•</span>
            <span>${timeStr}</span>
          </div>
          <div class="bg-bg-app border border-border-default text-fg-primary rounded-2xl rounded-tl-xs px-3.5 py-3 text-xs leading-relaxed prose prose-invert prose-sm max-w-none wrap-break-word w-full">
            ${parsedHtml}
          </div>
        </div>
      `;
    }
  }).join('');

  // Render KaTeX if auto-render is available in global scope
  renderMathInChat(container);

  // Scroll to bottom
  scrollToBottom();
}

export function appendStreamingToken(partialContent: string) {
  const container = elements.chat.messages;
  if (!container) return;

  let streamBubble = container.querySelector<HTMLElement>('#chat-streaming-bubble');
  if (!streamBubble) {
    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = 'flex flex-col items-start space-y-1 mr-4';
    bubbleWrapper.innerHTML = `
      <div class="flex items-center gap-1.5 text-[10px] text-fg-muted px-1">
        <span class="text-brand flex items-center">${ICONS.SPARKLES}</span>
        <span class="font-semibold text-fg-primary">Rubber Duck</span>
        <span>•</span>
        <span class="text-brand animate-pulse">Thinking...</span>
      </div>
      <div id="chat-streaming-bubble" class="bg-bg-app border border-border-default text-fg-primary rounded-2xl rounded-tl-xs px-3.5 py-3 text-xs leading-relaxed prose prose-invert prose-sm max-w-none wrap-break-word w-full">
      </div>
    `;
    container.appendChild(bubbleWrapper);
    streamBubble = bubbleWrapper.querySelector<HTMLElement>('#chat-streaming-bubble');
  }

  if (streamBubble) {
    streamBubble.innerHTML = marked.parse(partialContent) as string;
    renderMathInChat(streamBubble);
    scrollToBottom();
  }
}

function bindSidebarEvents() {
  // Toggle button on navbar
  elements.chat.btn?.addEventListener('click', () => {
    toggleChatSidebar();
  });

  // Close button inside sidebar
  elements.chat.closeBtn?.addEventListener('click', () => {
    closeChatSidebar();
  });

  // Clear chat button
  elements.chat.clearBtn?.addEventListener('click', () => {
    if (isStreaming && currentAbortController) {
      currentAbortController.abort();
    }
    const currentExId = store.getState().currentExerciseId;
    store.getState().clearChatHistory(currentExId);
    renderChatMessages();
  });

  // Escape key closes sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSidebarOpen) {
      closeChatSidebar();
    }
  });

  // Chat input resize & submit listeners
  const input = elements.chat.input;
  const sendBtn = elements.chat.sendBtn;

  if (input) {
    input.addEventListener('input', handleInputResize);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitUserMessage();
      }
    });
  }

  sendBtn?.addEventListener('click', () => {
    if (isStreaming) {
      abortCurrentGeneration();
    } else {
      submitUserMessage();
    }
  });
}

function handleInputResize() {
  const input = elements.chat.input;
  if (!input) return;

  input.style.height = 'auto';
  const newHeight = Math.min(input.scrollHeight, 120);
  input.style.height = `${Math.max(20, newHeight)}px`;

  updateSendButtonState();
}

function updateSendButtonState() {
  const sendBtn = elements.chat.sendBtn;
  const input = elements.chat.input;
  if (!sendBtn) return;

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

function abortCurrentGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

async function submitUserMessage() {
  if (isStreaming) {
    abortCurrentGeneration();
    return;
  }

  const input = elements.chat.input;
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  const currentExId = store.getState().currentExerciseId;

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

  // Start streaming generation
  isStreaming = true;
  updateSendButtonState();
  currentAbortController = new AbortController();

  let accumulatedResponse = '';

  try {
    accumulatedResponse = await streamCompletion({
      userPrompt: content,
      onChunk: (text) => {
        accumulatedResponse = text;
        appendStreamingToken(text);
      },
      signal: currentAbortController.signal,
    });

    if (accumulatedResponse.trim()) {
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: accumulatedResponse,
        timestamp: Date.now(),
      };
      store.getState().addChatMessage(currentExId, assistantMsg);
    }
  } catch (err: any) {
    // If user cancelled, save whatever partial content was produced
    if (err.name === 'AbortError' || currentAbortController?.signal.aborted) {
      if (accumulatedResponse.trim()) {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: accumulatedResponse,
          timestamp: Date.now(),
        };
        store.getState().addChatMessage(currentExId, assistantMsg);
      }
    } else {
      // API error occurred
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: `⚠️ **Unable to get response**\n\n${err?.message || 'Unknown network error. Please check your API settings.'}`,
        timestamp: Date.now(),
      };
      store.getState().addChatMessage(currentExId, errorMsg);
    }
  } finally {
    isStreaming = false;
    currentAbortController = null;
    updateSendButtonState();
    renderChatMessages();
  }
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

function scrollToBottom() {
  const container = elements.chat.messages;
  if (container) {
    container.scrollTop = container.scrollHeight;
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
