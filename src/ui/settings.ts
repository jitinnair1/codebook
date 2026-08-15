import { elements } from '../core/elements';
import { store } from '../core/store';
import { updateEditorVimMode } from '../core/editor';
import { ICONS } from './icons';

let cachedModels: string[] = [];
let isFetchingModels = false;
let modelFetchError: string | null = null;

export function initSettings() {
    if (elements.settingsBtn) {
        elements.settingsBtn.innerHTML = ICONS.SETTINGS;
    }
    if (elements.settings.closeBtn) {
        elements.settings.closeBtn.innerHTML = ICONS.CLOSE;
    }

    renderSettings();

    elements.settingsBtn?.addEventListener('click', openModal);
    elements.settings.closeBtn?.addEventListener('click', closeModal);

    // close on click outside (only if both mousedown and click originated directly on the backdrop)
    let isMouseDownOnBackdrop = false;

    elements.settings.modal?.addEventListener('mousedown', (e) => {
        isMouseDownOnBackdrop = (e.target === elements.settings.modal);
    });

    elements.settings.modal?.addEventListener('click', (e) => {
        if (isMouseDownOnBackdrop && e.target === elements.settings.modal) {
            closeModal();
        }
        isMouseDownOnBackdrop = false;
    });

    // close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.settings.modal && !elements.settings.modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

function renderSettings() {
    if (!elements.settings.content) return;

    const isVimEnabled = store.getState().vimMode;
    const aiSettings = store.getState().aiSettings || {
        enabled: false,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
    };

    elements.settings.content.innerHTML = `
        <div class="flex flex-col space-y-4">
            <!-- Vim Mode -->
            <div class="flex items-center justify-between py-3 border-b border-border-default">
                <div class="flex flex-col pr-4">
                    <span class="text-sm text-fg-primary font-medium">Enable Vim Mode</span>
                    <span class="text-xs text-fg-muted">Use Vim keybindings in the code editor</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer select-none">
                    <input type="checkbox" id="vim-mode-toggle" class="sr-only peer" ${isVimEnabled ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-border-default peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full
                    peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5fter:bg-white 
                    after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                </label>
            </div>

            <!-- AI Assistant Section -->
            <div class="flex flex-col pt-1">
                <div class="flex items-center justify-between py-2">
                    <div class="flex flex-col pr-4">
                        <span class="text-sm text-fg-primary font-medium">AI Pair Programmer</span>
                        <span class="text-xs text-fg-muted">Context-aware Socratic mentor & reviewer</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" id="ai-mode-toggle" class="sr-only peer" ${aiSettings.enabled ? 'checked' : ''}>
                        <div class="w-11 h-6 bg-border-default peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full 
                        peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white 
                        after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                    </label>
                </div>

                <!-- Collapsible AI Settings -->
                <div id="ai-settings-fields" class="space-y-3.5 pt-2 pb-1 ${aiSettings.enabled ? '' : 'hidden'}">
                    <!-- Security Notice -->
                    <div class="p-2.5 rounded-lg bg-bg-app border border-border-default text-[11px] text-fg-muted leading-relaxed">
                        <span class="font-semibold text-fg-primary">🔒 Encrypted Storage:</span>
                        API credentials are encrypted with Web Crypto (AES-GCM 256-bit) and sent directly to your configured endpoint.
                    </div>

                    <!-- Base URL -->
                    <div class="flex flex-col space-y-1">
                        <label for="ai-base-url" class="text-xs font-semibold text-fg-primary">
                            API Base URL
                        </label>
                        <input type="text" id="ai-base-url"
                            class="w-full px-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary
                            placeholder:text-fg-muted focus:outline-none focus:border-brand font-mono"
                            placeholder="https://api.openai.com/v1"
                            value="${aiSettings.baseUrl || ''}" />
                        <span class="text-[10px] text-fg-muted">
                            Works with any OpenAI-compatible API endpoints (including locally hosted models)
                        </span>
                    </div>

                    <!-- API Key -->
                    <div class="flex flex-col space-y-1">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-semibold text-fg-primary">
                                API Key
                            </label>
                            <span class="text-[10px] text-fg-muted font-normal">Optional for local servers (Ollama, LM Studio)</span>
                        </div>
                        ${aiSettings.apiKey ? `
                            <div class="flex items-center justify-between px-3 py-1.5 bg-bg-app border border-border-default rounded-md">
                                <div class="flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
                                    <span class="text-xs font-mono text-fg-primary select-none">${formatMaskedKey(aiSettings.apiKey)}</span>
                                    <span class="text-[10px] text-fg-muted font-sans">(Saved)</span>
                                </div>
                                <button type="button" id="clear-ai-key" class="text-xs text-red-400 hover:text-red-500 font-medium px-2 py-0.5 rounded 
                                hover:bg-bg-surface transition-colors cursor-pointer" title="Delete API Key">
                                    Delete
                                </button>
                            </div>
                        ` : `
                            <div class="relative flex items-center">
                                <input type="password" id="ai-api-key"
                                    autocomplete="off"
                                    data-1p-ignore="true"
                                    data-lpignore="true"
                                    spellcheck="false"
                                    class="w-full px-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary 
                                    placeholder:text-fg-muted focus:outline-none focus:border-brand font-mono"
                                    placeholder="Paste API key (sk-...) or leave blank for local server"
                                    value="" />
                            </div>
                            <span class="text-[10px] text-fg-muted">For local instances without authentication, you can leave this empty.</span>
                        `}
                    </div>

                    <!-- Model Selection / Dropdown -->
                    <div class="flex flex-col space-y-1.5 pt-1">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-semibold text-fg-primary">
                                Model Selection
                            </label>
                            <button type="button" id="refresh-models-btn" class="text-[10px] text-fg-muted hover:text-fg-primary hover:underline
                            cursor-pointer flex items-center gap-1">
                                ↻ Refresh Models
                            </button>
                        </div>

                        <div id="ai-model-container">
                            ${renderModelSelectorContent(aiSettings)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Vim toggle listener
    const vimToggle = document.getElementById('vim-mode-toggle') as HTMLInputElement | null;
    vimToggle?.addEventListener('change', (e) => {
        const enabled = (e.target as HTMLInputElement).checked;
        store.getState().setVimMode(enabled);
        updateEditorVimMode(enabled);
    });

    // AI toggle listener
    const aiToggle = document.getElementById('ai-mode-toggle') as HTMLInputElement | null;
    const aiFields = document.getElementById('ai-settings-fields');
    aiToggle?.addEventListener('change', (e) => {
        const enabled = (e.target as HTMLInputElement).checked;
        store.getState().setAISettings({ enabled });
        if (enabled) {
            aiFields?.classList.remove('hidden');
            if (cachedModels.length === 0) {
                triggerModelFetch();
            }
        } else {
            aiFields?.classList.add('hidden');
        }
    });

    // AI Base URL listener
    const baseUrlInput = document.getElementById('ai-base-url') as HTMLInputElement | null;
    baseUrlInput?.addEventListener('input', (e) => {
        const newUrl = (e.target as HTMLInputElement).value.trim();
        store.getState().setAISettings({ baseUrl: newUrl });
    });
    baseUrlInput?.addEventListener('change', () => {
        triggerModelFetch();
    });

    // AI API Key listener (save, switch to masked view, and fetch models for validation)
    const apiKeyInput = document.getElementById('ai-api-key') as HTMLInputElement | null;
    if (apiKeyInput) {
        const saveKey = () => {
            const val = apiKeyInput.value.trim();
            if (val) {
                store.getState().setAISettings({ apiKey: val });
                renderSettings();
                triggerModelFetch();
            }
        };

        apiKeyInput.addEventListener('blur', saveKey);
        apiKeyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveKey();
            }
        });
    }

    // Delete Key Button
    const clearKeyBtn = document.getElementById('clear-ai-key') as HTMLButtonElement | null;
    clearKeyBtn?.addEventListener('click', () => {
        cachedModels = [];
        modelFetchError = null;
        store.getState().setAISettings({ apiKey: '' });
        renderSettings();
    });

    // Refresh Models button
    const refreshBtn = document.getElementById('refresh-models-btn') as HTMLButtonElement | null;
    refreshBtn?.addEventListener('click', () => {
        triggerModelFetch();
    });

    // Attach listeners for model select or fallback input
    attachModelInputListeners();
}

function renderModelSelectorContent(aiSettings: { apiKey: string; model: string; baseUrl: string }) {
    if (!aiSettings.baseUrl) {
        return `<div class="text-[11px] text-fg-muted italic py-1">Enter your API Base URL above to load models.</div>`;
    }

    if (isFetchingModels) {
        return `
            <div class="flex items-center gap-2 py-2 text-xs text-fg-muted">
                <span class="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
                <span>Connecting to endpoint and loading models...</span>
            </div>
        `;
    }

    if (modelFetchError) {
        return `
            <div class="space-y-2">
                <div class="p-2 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
                    <span class="font-semibold">Validation failed:</span> ${escapeHtml(modelFetchError)}
                </div>
                <div class="flex flex-col space-y-1">
                    <span class="text-[10px] text-fg-muted">Manual model name fallback:</span>
                    <input type="text" id="ai-model-manual"
                        class="w-full px-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary font-mono focus:outline-none focus:border-brand"
                        value="${escapeHtml(aiSettings.model || 'gpt-4o-mini')}" />
                </div>
            </div>
        `;
    }

    if (cachedModels.length > 0) {
        const currentModel = aiSettings.model || cachedModels[0];
        const isCustom = !cachedModels.includes(currentModel);

        return `
            <div class="space-y-1.5">
                <div class="relative">
                    <select id="ai-model-select"
                        class="w-full px-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary focus:outline-none
                        focus:border-brand font-mono appearance-none cursor-pointer pr-8">
                        ${cachedModels.map(m => `
                            <option value="${escapeHtml(m)}" ${m === currentModel ? 'selected' : ''}>
                                ${escapeHtml(m)}
                            </option>
                        `).join('')}
                        <option value="__custom__" ${isCustom ? 'selected' : ''}>+ Custom model name...</option>
                    </select>
                    <div class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-fg-muted text-[10px]">
                        ▼
                    </div>
                </div>

                <div id="custom-model-wrapper" class="${isCustom ? '' : 'hidden'} pt-1">
                    <input type="text" id="ai-model-custom-input"
                        class="w-full px-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary placeholder:text-fg-muted
                        focus:outline-none focus:border-brand font-mono"
                        placeholder="Enter custom model identifier"
                        value="${escapeHtml(isCustom ? currentModel : '')}" />
                </div>

                <div class="flex items-center justify-between text-[10px] text-green-500 font-medium pt-0.5">
                    <span>✓ Validated (${cachedModels.length} models available)</span>
                </div>
            </div>
        `;
    }

    // Default before first fetch
    return `
        <div class="flex items-center justify-between py-1">
            <span class="text-xs font-mono text-fg-primary">${escapeHtml(aiSettings.model || 'gpt-4o-mini')}</span>
            <button type="button" id="fetch-now-btn" class="px-2.5 py-1 text-xs bg-bg-app border border-border-default hover:bg-border-default
            rounded text-fg-primary cursor-pointer">
                Validate & Fetch Models
            </button>
        </div>
    `;
}

function attachModelInputListeners() {
    const select = document.getElementById('ai-model-select') as HTMLSelectElement | null;
    const customWrapper = document.getElementById('custom-model-wrapper');
    const customInput = document.getElementById('ai-model-custom-input') as HTMLInputElement | null;
    const manualInput = document.getElementById('ai-model-manual') as HTMLInputElement | null;
    const fetchNowBtn = document.getElementById('fetch-now-btn') as HTMLButtonElement | null;

    select?.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === '__custom__') {
            customWrapper?.classList.remove('hidden');
            customInput?.focus();
        } else {
            customWrapper?.classList.add('hidden');
            store.getState().setAISettings({ model: val });
        }
    });

    customInput?.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value.trim();
        if (val) {
            store.getState().setAISettings({ model: val });
        }
    });

    manualInput?.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value.trim();
        if (val) {
            store.getState().setAISettings({ model: val });
        }
    });

    fetchNowBtn?.addEventListener('click', () => {
        triggerModelFetch();
    });
}

async function triggerModelFetch() {
    const { baseUrl, apiKey } = store.getState().aiSettings;
    if (!baseUrl) return;

    isFetchingModels = true;
    modelFetchError = null;
    renderSettings();

    const result = await fetchAvailableModels(baseUrl, apiKey);
    isFetchingModels = false;

    if (result.success) {
        cachedModels = result.models;
        modelFetchError = null;
        // If current model is not set or not in list, pick a smart default
        const currentModel = store.getState().aiSettings.model;
        if (!currentModel || (!cachedModels.includes(currentModel) && cachedModels.length > 0)) {
            // Find popular defaults or pick first
            const preferred = cachedModels.find(m => m.includes('gpt-4o-mini') || m.includes('claude-3-5-sonnet') || m.includes('gemini-2.5-flash') || m.includes('llama3'));
            store.getState().setAISettings({ model: preferred || cachedModels[0] });
        }
    } else {
        cachedModels = [];
        modelFetchError = result.error || 'Failed to fetch models';
    }

    renderSettings();
}

async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<{ success: boolean; models: string[]; error?: string }> {
    if (!baseUrl) return { success: false, models: [], error: 'Base URL is required' };

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    let endpoint: string;
    if (cleanBaseUrl.endsWith('/chat/completions')) {
        endpoint = cleanBaseUrl.replace(/\/chat\/completions$/, '/models');
    } else if (cleanBaseUrl.endsWith('/v1')) {
        endpoint = `${cleanBaseUrl}/models`;
    } else {
        endpoint = `${cleanBaseUrl}/models`;
    }

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        if (cleanBaseUrl.includes('anthropic.com')) {
            headers['anthropic-dangerous-direct-browser-access'] = 'true';
        }

        const res = await fetch(endpoint, {
            method: 'GET',
            headers,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            let msg = `HTTP ${res.status} (${res.statusText})`;
            try {
                const parsed = JSON.parse(errText);
                if (parsed.error?.message) msg = parsed.error.message;
            } catch {
                if (errText) msg = errText.slice(0, 80);
            }
            return { success: false, models: [], error: msg };
        }

        const data = await res.json();
        let list: string[] = [];

        if (Array.isArray(data?.data)) {
            list = data.data.map((m: any) => m.id || m.name).filter(Boolean);
        } else if (Array.isArray(data?.models)) {
            list = data.models.map((m: any) => m.id || m.name).filter(Boolean);
        } else if (Array.isArray(data)) {
            list = data.map((m: any) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
        }

        // Filter out non-chat / embedding / audio / tts / whisper models if standard OpenAI
        if (cleanBaseUrl.includes('api.openai.com')) {
            const excluded = ['embedding', 'whisper', 'tts', 'dall-e', 'davinci', 'babbage', 'moderation', 'realtime', 'audio'];
            list = list.filter(id => !excluded.some(ex => id.toLowerCase().includes(ex)));
        }

        if (list.length === 0) {
            return { success: false, models: [], error: 'Endpoint returned an empty list of models' };
        }

        // Sort alphabetically
        list.sort((a, b) => a.localeCompare(b));

        return { success: true, models: list };
    } catch (err: any) {
        return { success: false, models: [], error: err?.message || 'Network request failed (Check CORS or Base URL)' };
    }
}

function openModal() {
    renderSettings();
    elements.settings.modal?.classList.remove('hidden');
    elements.settings.modal?.classList.add('flex');

    if (store.getState().aiSettings.apiKey && cachedModels.length === 0 && !isFetchingModels) {
        triggerModelFetch();
    }
}

function closeModal() {
    elements.settings.modal?.classList.add('hidden');
    elements.settings.modal?.classList.remove('flex');
}

function formatMaskedKey(key: string): string {
    if (!key) return '';
    const visibleLength = Math.min(10, Math.max(4, Math.floor(key.length / 3)));
    const prefix = key.slice(0, visibleLength);
    return `${prefix}••••••••`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


