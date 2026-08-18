import { elements } from '../core/elements';
import { store, ChatMessage, ChatConversation } from '../core/store';
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
  conversationId: string;
  abortController: AbortController;
  status: StreamStatus;
  accumulatedText: string;
}

const activeStreams = new Map<string, ActiveStreamSession>();


export function abortAllStreams() {
  for (const session of activeStreams.values()) {
    session.abortController.abort();
  }
  activeStreams.clear();
}

let lastRenderedExerciseId: string | null = null;
let lastRenderedLanguageId: string | null = null;
let lastChatEnabledState: boolean | null = null;
let lastRenderedConversationId: string | null = null;
let lastRenderedChatMessages: ChatMessage[] | null = null;
let lastRenderedConvs: ChatConversation[] | null = null;

export function initChatPanel() {
  // Populate static icons
  if (elements.chat.clearBtn) {
    elements.chat.clearBtn.innerHTML = ICONS.TRASH;
  }
  if (elements.chat.sendBtn) {
    elements.chat.sendBtn.innerHTML = ICONS.SEND;
  }
  if (elements.chat.newTabBtn) {
    elements.chat.newTabBtn.innerHTML = ICONS.PLUS;
  }

  // Ensure an active conversation exists for current exercise
  ensureActiveConversation();

  // Bind static listeners
  bindPanelEvents();

  // Initial UI sync
  syncPanelVisibility();
  renderQuickChips();
  renderConversationTabs();
  renderChatMessages();

  let isSyncingStore = false;

  // Subscribe to store updates for exercise switch, language switch, chat settings & conversation changes
  store.subscribe(() => {
    if (isSyncingStore) return;
    isSyncingStore = true;
    try {
      const state = store.getState();
      const currentExId = state.currentExerciseId;
      const currentLangId = state.currentLanguageId;
      const cs = state.chatSettings;
      const chatEnabled = !!cs?.enabled;

      // Toggle panel visibility if chat enabled state changed
      if (chatEnabled !== lastChatEnabledState) {
        lastChatEnabledState = chatEnabled;
        syncPanelVisibility();
      }

      // Auto-switch conversation if language changed
      if (lastRenderedLanguageId !== null && currentLangId !== lastRenderedLanguageId) {
        lastRenderedLanguageId = currentLangId;
        handleLanguageSwitch(currentExId, currentLangId);
      } else {
        lastRenderedLanguageId = currentLangId;
      }

      ensureActiveConversation();

      const currentConvs = state.chatConversations[currentExId] || [];
      const activeConv = state.getActiveConversation(currentExId);
      const activeConvId = activeConv?.id || null;
      const currentMessages = activeConv?.messages || [];

      const isExerciseChanged = currentExId !== lastRenderedExerciseId;
      const isConvChanged = activeConvId !== lastRenderedConversationId;
      const isMessagesChanged = currentMessages !== lastRenderedChatMessages;
      const isConvsChanged = currentConvs !== lastRenderedConvs;

      // Re-render tabs & messages if exercise, conversation, tabs list, or messages changed
      if (isExerciseChanged || isConvChanged || isMessagesChanged || isConvsChanged) {
        if (isExerciseChanged) {
          // Reset scroll position to top of problem description
          if (elements.chat.scrollContainer) {
            elements.chat.scrollContainer.scrollTop = 0;
          }
        }
        lastRenderedExerciseId = currentExId;
        lastRenderedConversationId = activeConvId;
        lastRenderedChatMessages = currentMessages;
        lastRenderedConvs = currentConvs;
        renderConversationTabs();
        renderChatMessages();
        updateSendButtonState();

        // If switching to an exercise that currently has an active stream running, re-attach streaming UI
        if (activeConvId) {
          const activeSession = activeStreams.get(activeConvId);
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
      }
    } finally {
      isSyncingStore = false;
    }
  });
}

function ensureActiveConversation() {
  const state = store.getState();
  const currentExId = state.currentExerciseId;
  const convs = state.chatConversations[currentExId] || [];

  if (convs.length > 0) {
    const activeId = state.activeConversationId[currentExId];
    if (!activeId || !convs.some(c => c.id === activeId)) {
      store.getState().setActiveConversation(currentExId, convs[0].id);
    }
  }
}

/**
 * Automatically branches / routes to a new conversation when user switches languages
 */
function handleLanguageSwitch(exerciseId: string, newLanguageId: string) {
  const state = store.getState();
  const convs = state.chatConversations[exerciseId] || [];
  const activeConv = state.getActiveConversation(exerciseId);

  if (!activeConv) return;

  // If current conversation is completely empty, simply update its language tag
  if (activeConv.messages.length === 0) {
    if (activeConv.languageId !== newLanguageId) {
      store.getState().updateConversationLanguage(exerciseId, activeConv.id, newLanguageId);
    }
    return;
  }

  // If current conversation belongs to a different language and has messages:
  if (activeConv.languageId !== newLanguageId) {
    // Check if there is already an existing conversation for this new language
    const existingLangConv = convs.slice().reverse().find(c => c.languageId === newLanguageId);
    if (existingLangConv) {
      store.getState().setActiveConversation(exerciseId, existingLangConv.id);
    } else {
      // Create a new clean conversation tagged with the new language
      store.getState().createConversation(exerciseId, newLanguageId, 'Chat');
    }
  }
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


export function focusChatInput() {
  const cs = store.getState().chatSettings;
  if (cs?.enabled && elements.chat.input) {
    elements.chat.input.focus();
  }
}


export function renderConversationTabs() {
  const container = elements.chat.tabsContainer;
  const newTabBtn = elements.chat.newTabBtn;
  if (!container) return;

  const state = store.getState();
  const currentExId = state.currentExerciseId;
  const convs: ChatConversation[] = state.chatConversations[currentExId] || [];
  lastRenderedConvs = convs;
  const activeId = state.activeConversationId[currentExId] || (convs[0]?.id ?? '');

  // Toggle plus button visibility: only visible if a conversation has started (has messages) or multiple tabs exist
  const canAddNewTab = convs.some(c => c.messages.length > 0) || convs.length > 1;
  if (newTabBtn) {
    newTabBtn.classList.toggle('hidden', !canAddNewTab);
  }

  if (convs.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = convs.map((conv) => {
    const isActive = conv.id === activeId;
    const title = conv.title || 'Chat';
    const isStreaming = activeStreams.has(conv.id);
    const hasUnread = !isActive && !!conv.unread;
    const showDot = !isActive && (hasUnread || isStreaming);

    const baseClasses = "group relative flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition-all cursor-pointer select-none shrink-0 border";
    const activeClasses = isActive
      ? "bg-bg-app border-border-default text-fg-primary font-semibold shadow-xs"
      : "bg-transparent border-border-default/50 hover:border-border-default hover:bg-bg-app/60 text-fg-muted hover:text-fg-primary";

    return `
      <div data-conv-id="${conv.id}"
        class="chat-tab-item ${baseClasses} ${activeClasses}"
        title="${escapeHtml(title)} (${conv.languageId})">
        ${showDot ? `<span class="w-1.5 h-1.5 rounded-full bg-brand shrink-0 ${isStreaming ? 'animate-pulse' : ''}" title="${isStreaming ? 'Generating response...' : 'Unread message'}"></span>` : ''}
        <span class="truncate max-w-[80px] sm:max-w-[110px]">${escapeHtml(title)}</span>
        <button type="button"
          data-close-conv-id="${conv.id}"
          class="chat-tab-close-btn opacity-60 hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-all ml-0.5 cursor-pointer"
          title="Delete conversation">
          ${ICONS.CLOSE_SM}
        </button>
      </div>
    `;
  }).join('');

  // Bind tab selection & close events
  container.querySelectorAll<HTMLElement>('.chat-tab-item').forEach(tabEl => {
    const convId = tabEl.getAttribute('data-conv-id');
    if (!convId) return;

    tabEl.addEventListener('click', (e) => {
      // Don't switch if clicking the close button
      if ((e.target as HTMLElement).closest('.chat-tab-close-btn')) return;
      store.getState().setActiveConversation(currentExId, convId);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('.chat-tab-close-btn').forEach(btn => {
    const convId = btn.getAttribute('data-close-conv-id');
    if (!convId) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abortCurrentGeneration(convId);
      store.getState().deleteConversation(currentExId, convId);
      ensureActiveConversation();
    });
  });
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
  const currentLangId = store.getState().currentLanguageId;
  const activeConv = store.getState().getActiveConversation(currentExId);
  if (activeConv && activeStreams.has(activeConv.id)) return;

  if (!activeConv) {
    store.getState().createConversation(currentExId, currentLangId, chip.label);
  } else if ((!activeConv.title || activeConv.title === 'Chat') && activeConv.messages.length === 0) {
    store.getState().updateConversationTitle(currentExId, activeConv.id, chip.label);
  }

  if (elements.chat.input) {
    elements.chat.input.value = chip.prompt;
    handleInputResize();
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
  const activeConv = store.getState().getActiveConversation(currentExId);
  const messages: ChatMessage[] = activeConv?.messages || [];
  lastRenderedExerciseId = currentExId;
  lastRenderedConversationId = activeConv?.id || null;
  lastRenderedChatMessages = messages;

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

export function extractAndStripTitle(text: string): { title: string | null; content: string } {
  // Check for complete <title>...</title> tag near the beginning
  const titleMatch = text.match(/^\s*<title>([^<]*)<\/title>\s*/i);
  if (titleMatch) {
    const title = titleMatch[1].trim().replace(/[#*_`]/g, '').slice(0, 24);
    const content = text.slice(titleMatch[0].length);
    return { title: title || null, content };
  }

  // If text starts with an incomplete <title...> tag while streaming, hold back until closing </title>
  const partialTagMatch = text.match(/^\s*<title[^>]*>(.*)$/i);
  if (partialTagMatch) {
    return { title: null, content: '' };
  }

  // If text starts with partial opening '<tit...', hide until tag resolves
  if (/^\s*<t(i(t(l(e)?)?)?)?$/i.test(text)) {
    return { title: null, content: '' };
  }

  return { title: null, content: text };
}

export function appendStreamingToken(partialContent: string, statusText?: string) {
  const container = elements.chat.messages;
  if (!container) return;

  const { content } = extractAndStripTitle(partialContent);
  if (!content.trim()) {
    showStreamingPlaceholder(statusText || 'Thinking...');
    return;
  }

  let streamBubble = container.querySelector<HTMLElement>('#chat-streaming-bubble');
  if (!streamBubble) {
    showStreamingPlaceholder(statusText || 'Thinking...');
    streamBubble = container.querySelector<HTMLElement>('#chat-streaming-bubble');
  }

  if (statusText) {
    updateStreamingStatus(statusText);
  }

  if (streamBubble) {
    const html = parseChatMarkdown(content);
    streamBubble.innerHTML = html;
    renderMathInChat(streamBubble);
    scrollToBottom(false);
  }
}

function bindPanelEvents() {
  // New conversation tab button
  elements.chat.newTabBtn?.addEventListener('click', () => {
    const state = store.getState();
    const currentExId = state.currentExerciseId;
    const currentLangId = state.currentLanguageId;
    store.getState().createConversation(currentExId, currentLangId, 'Chat');
  });

  // Clear chat messages button
  elements.chat.clearBtn?.addEventListener('click', () => {
    const currentExId = store.getState().currentExerciseId;
    const activeConv = store.getState().getActiveConversation(currentExId);
    if (activeConv) {
      abortCurrentGeneration(activeConv.id);
      store.getState().clearChatHistory(currentExId, activeConv.id);
    }
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
    const activeConv = store.getState().getActiveConversation(currentExId);
    if (activeConv && activeStreams.has(activeConv.id)) {
      abortCurrentGeneration(activeConv.id);
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
  const activeConv = store.getState().getActiveConversation(currentExId);
  const isStreaming = activeConv ? activeStreams.has(activeConv.id) : false;

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

function abortCurrentGeneration(conversationId?: string) {
  const currentExId = store.getState().currentExerciseId;
  const targetConvId = conversationId || store.getState().getActiveConversation(currentExId)?.id;
  if (!targetConvId) return;

  const session = activeStreams.get(targetConvId);
  if (session) {
    session.abortController.abort();
    activeStreams.delete(targetConvId);
    updateSendButtonState();
  }
}

async function submitUserMessage() {
  const state = store.getState();
  const currentExId = store.getState().currentExerciseId;
  const currentLangId = state.currentLanguageId;

  ensureActiveConversation();
  let activeConv = store.getState().getActiveConversation(currentExId);
  if (!activeConv) return;

  // Language auto-switch check before sending:
  // If active conversation has messages and belongs to a different language, automatically branch to new language
  if (activeConv.messages.length > 0 && activeConv.languageId !== currentLangId) {
    const convs = store.getState().chatConversations[currentExId] || [];
    const existingLangConv = convs.slice().reverse().find(c => c.languageId === currentLangId);
    if (existingLangConv) {
      store.getState().setActiveConversation(currentExId, existingLangConv.id);
      activeConv = existingLangConv;
    } else {
      const newConvId = store.getState().createConversation(currentExId, currentLangId, 'Chat');
      activeConv = store.getState().getActiveConversation(currentExId) || {
        id: newConvId,
        exerciseId: currentExId,
        languageId: currentLangId,
        title: 'Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
    }
  } else if (activeConv.messages.length === 0 && activeConv.languageId !== currentLangId) {
    store.getState().updateConversationLanguage(currentExId, activeConv.id, currentLangId);
    activeConv.languageId = currentLangId;
  }

  const convId = activeConv.id;

  if (activeStreams.has(convId)) {
    abortCurrentGeneration(convId);
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

  store.getState().addChatMessage(currentExId, userMsg, convId);

  // Clear input & reset height
  input.value = '';
  handleInputResize();
  renderChatMessages();
  scrollToBottom(true);

  // Create stream session for this conversation
  const abortController = new AbortController();
  const session: ActiveStreamSession = {
    exerciseId: currentExId,
    conversationId: convId,
    abortController,
    status: 'connecting',
    accumulatedText: '',
  };
  activeStreams.set(convId, session);

  updateSendButtonState();
  showStreamingPlaceholder('Connecting...');

  // Detached background stream execution
  streamCompletion({
    userPrompt: content,
    conversationId: convId,
    onStatus: (status: StreamStatus) => {
      session.status = status;
      const currentActiveConv = store.getState().getActiveConversation(store.getState().currentExerciseId);
      if (currentActiveConv?.id === convId) {
        updateStreamingStatus(status === 'connecting' ? 'Connecting...' : 'Thinking...');
      }
    },
    onChunk: (text) => {
      session.accumulatedText = text;
      const { title } = extractAndStripTitle(text);
      if (title) {
        const conv = store.getState().chatConversations[currentExId]?.find(c => c.id === convId);
        if (conv && (!conv.title || conv.title === 'Chat')) {
          store.getState().updateConversationTitle(currentExId, convId, title);
        }
      }
      const currentActiveConv = store.getState().getActiveConversation(store.getState().currentExerciseId);
      if (currentActiveConv?.id === convId) {
        appendStreamingToken(text);
      }
    },
    signal: abortController.signal,
  })
    .then((accumulatedResponse) => {
      const { title, content } = extractAndStripTitle(accumulatedResponse);
      if (title) {
        const conv = store.getState().chatConversations[currentExId]?.find(c => c.id === convId);
        if (conv && (!conv.title || conv.title === 'Chat')) {
          store.getState().updateConversationTitle(currentExId, convId, title);
        }
      }
      if (content.trim()) {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content,
          timestamp: Date.now(),
        };
        store.getState().addChatMessage(currentExId, assistantMsg, convId);
      }
    })
    .catch((err: any) => {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        const { content } = extractAndStripTitle(session.accumulatedText);
        if (content.trim()) {
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role: 'assistant',
            content,
            timestamp: Date.now(),
          };
          store.getState().addChatMessage(currentExId, assistantMsg, convId);
        }
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: `⚠️ **Unable to get response**\n\n${err?.message || 'Unknown network error. Please check your API settings.'}`,
          timestamp: Date.now(),
        };
        store.getState().addChatMessage(currentExId, errorMsg, convId);
      }
    })
    .finally(() => {
      activeStreams.delete(convId);
      const currentActiveConv = store.getState().getActiveConversation(store.getState().currentExerciseId);
      if (currentActiveConv?.id === convId) {
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


