import { elements } from '../core/elements';
import { store, ChatSettings, ChatEndpoint } from '../core/store';
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

    // Bind static event listeners once
    bindStaticListeners();

    // Initial sync of settings UI
    syncSettingsUI();

    // Re-sync whenever store hydrates or updates in background
    store.subscribe(() => {
        const modal = elements.settings.modal;
        if (modal && !modal.classList.contains('hidden')) {
            syncSettingsUI();
        }
    });

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

function bindStaticListeners() {
    // Vim toggle listener
    elements.settings.vimToggle?.addEventListener('change', (e) => {
        const enabled = (e.target as HTMLInputElement).checked;
        store.getState().setVimMode(enabled);
        updateEditorVimMode(enabled);
    });

    // Chat toggle listener
    elements.settings.chatToggle?.addEventListener('change', (e) => {
        const enabled = (e.target as HTMLInputElement).checked;
        store.getState().setChatSettings({ enabled });
        if (enabled) {
            elements.settings.chatFields?.classList.remove('hidden');
            if (cachedModels.length === 0) {
                triggerModelFetch();
            }
        } else {
            elements.settings.chatFields?.classList.add('hidden');
        }
    });

    // Refresh Models button
    elements.settings.refreshModelsBtn?.addEventListener('click', () => {
        triggerModelFetch();
    });
}

function syncSettingsUI() {
    const isVimEnabled = store.getState().vimMode;
    const chatSettings = store.getState().chatSettings || {
        enabled: false,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: '',
        selectedEndpointId: 'default-endpoint',
        endpoints: [
            {
                id: 'default-endpoint',
                name: 'OpenAI API',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: '',
                model: '',
            }
        ]
    };

    if (elements.settings.vimToggle) {
        elements.settings.vimToggle.checked = isVimEnabled;
    }

    if (elements.settings.chatToggle) {
        elements.settings.chatToggle.checked = !!chatSettings.enabled;
    }

    if (elements.settings.chatFields) {
        elements.settings.chatFields.classList.toggle('hidden', !chatSettings.enabled);
    }

    renderEndpointSelector(chatSettings);
    renderKeyContainer(chatSettings);
    renderModelSelector(chatSettings);
}

function renderEndpointSelector(chatSettings: ChatSettings) {
    if (!elements.settings.endpointSection) return;

    const endpoints = chatSettings.endpoints || [];
    const selectedId = chatSettings.selectedEndpointId;
    const canDelete = endpoints.length > 1;

    elements.settings.endpointSection.innerHTML = `
        <div class="flex flex-col space-y-1.5">
            <div class="flex items-center justify-between">
                <label for="chat-base-url" class="text-xs font-semibold text-fg-primary">
                    API Endpoint &amp; Base URL
                </label>
                ${canDelete ? `
                    <button type="button" id="chat-delete-endpoint-btn" class="text-[11px] text-red-400 hover:text-red-500 font-medium cursor-pointer transition-colors" title="Delete current endpoint">
                        Delete
                    </button>
                ` : ''}
            </div>

            <div class="flex flex-col sm:flex-row gap-1.5">
                <div class="relative sm:w-2/5 shrink-0">
                    <select id="chat-endpoint-select"
                        class="w-full px-2.5 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary focus:outline-none focus:border-brand appearance-none cursor-pointer pr-7 truncate"
                        title="Saved Endpoint / Provider">
                        ${endpoints.map(ep => `
                            <option value="${escapeHtml(ep.id)}" ${ep.id === selectedId ? 'selected' : ''}>
                                ${escapeHtml(ep.name || ep.baseUrl || 'Custom Endpoint')}
                            </option>
                        `).join('')}
                        <option value="__add_new__">+ Add endpoint...</option>
                    </select>
                    <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-fg-muted text-[9px]">
                        ▼
                    </div>
                </div>

                <div class="flex-1 min-w-0">
                    <input type="text" id="chat-base-url"
                        class="w-full px-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-brand font-mono"
                        placeholder="https://api.openai.com/v1"
                        value="${escapeHtml(chatSettings.baseUrl || '')}" />
                </div>
            </div>

            <span class="text-[10px] text-fg-muted">
                OpenAI-compatible URL (e.g. https://api.openai.com/v1, http://localhost:11434/v1 for Ollama)
            </span>
        </div>
    `;

    attachEndpointListeners();
}

function attachEndpointListeners() {
    const select = document.getElementById('chat-endpoint-select') as HTMLSelectElement | null;
    const deleteBtn = document.getElementById('chat-delete-endpoint-btn') as HTMLButtonElement | null;
    const urlInput = document.getElementById('chat-base-url') as HTMLInputElement | null;

    select?.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === '__add_new__') {
            const newEp: ChatEndpoint = {
                id: 'ep-' + Date.now(),
                name: 'Custom Endpoint',
                baseUrl: '',
                apiKey: '',
                model: '',
            };
            const cs = store.getState().chatSettings;
            const updatedEndpoints = [...(cs.endpoints || []), newEp];
            cachedModels = [];
            modelFetchError = null;
            store.getState().setChatSettings({
                endpoints: updatedEndpoints,
                selectedEndpointId: newEp.id,
                baseUrl: '',
                apiKey: '',
                model: '',
            });
            syncSettingsUI();
            setTimeout(() => {
                const input = document.getElementById('chat-base-url') as HTMLInputElement | null;
                input?.focus();
            }, 50);
        } else {
            cachedModels = [];
            modelFetchError = null;
            store.getState().setChatSettings({
                selectedEndpointId: val,
            });
            syncSettingsUI();
            const cs = store.getState().chatSettings;
            if (cs.baseUrl) {
                triggerModelFetch();
            }
        }
    });

    deleteBtn?.addEventListener('click', () => {
        const cs = store.getState().chatSettings;
        if (cs.endpoints && cs.endpoints.length > 1) {
            const updated = cs.endpoints.filter(ep => ep.id !== cs.selectedEndpointId);
            const nextSelected = updated[0];
            cachedModels = [];
            modelFetchError = null;
            store.getState().setChatSettings({
                endpoints: updated,
                selectedEndpointId: nextSelected.id,
                baseUrl: nextSelected.baseUrl,
                apiKey: nextSelected.apiKey,
                model: nextSelected.model,
            });
            syncSettingsUI();
            if (nextSelected.baseUrl) {
                triggerModelFetch();
            }
        }
    });

    urlInput?.addEventListener('input', (e) => {
        const newUrl = (e.target as HTMLInputElement).value.trim();
        store.getState().setChatSettings({ baseUrl: newUrl });
    });

    urlInput?.addEventListener('change', () => {
        triggerModelFetch();
    });
}

function renderKeyContainer(chatSettings: { apiKey: string }) {
    const container = elements.settings.chatKeyContainer;
    if (!container) return;

    if (chatSettings.apiKey) {
        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-1.5 bg-bg-app border border-border-default rounded-md">
                <div class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
                    <span class="text-xs font-mono text-fg-primary select-none">${formatMaskedKey(chatSettings.apiKey)}</span>
                    <span class="text-[10px] text-fg-muted font-sans">(Saved)</span>
                </div>
                <button type="button" id="clear-chat-key" class="text-xs text-red-400 hover:text-red-500 font-medium px-2 py-0.5 rounded 
                hover:bg-bg-surface transition-colors cursor-pointer" title="Delete API Key">
                    Delete
                </button>
            </div>
        `;

        const clearKeyBtn = document.getElementById('clear-chat-key') as HTMLButtonElement | null;
        clearKeyBtn?.addEventListener('click', () => {
            cachedModels = [];
            modelFetchError = null;
            store.getState().setChatSettings({ apiKey: '' });
            syncSettingsUI();
        });
    } else {
        container.innerHTML = `
            <div class="relative flex items-center">
                <input type="text" id="chat-api-key"
                    name="api-key"
                    autocomplete="one-time-code"
                    autocapitalize="off"
                    autocorrect="off"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    spellcheck="false"
                    style="-webkit-text-security: disc; text-security: disc;"
                    class="w-full px-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary 
                    placeholder:text-fg-muted focus:outline-none focus:border-brand font-mono"
                    placeholder="Paste API key (sk-...) or leave blank for local server"
                    value="" />
            </div>
            <span class="text-[10px] text-fg-muted">For local instances without authentication, you can leave this empty.</span>
        `;

        const apiKeyInput = document.getElementById('chat-api-key') as HTMLInputElement | null;
        if (apiKeyInput) {
            const saveKey = () => {
                const val = apiKeyInput.value.trim();
                if (val) {
                    store.getState().setChatSettings({ apiKey: val });
                    syncSettingsUI();
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
    }
}

function renderModelSelector(chatSettings: { apiKey: string; model: string; baseUrl: string }) {
    const container = elements.settings.chatModelContainer;
    if (!container) return;
    container.innerHTML = getModelSelectorContent(chatSettings);
    attachModelInputListeners();
}

function getModelSelectorContent(chatSettings: { apiKey: string; model: string; baseUrl: string }) {
    if (!chatSettings.baseUrl) {
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
                    <input type="text" id="chat-model-manual"
                        class="w-full px-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary font-mono focus:outline-none focus:border-brand"
                        value="${escapeHtml(chatSettings.model || '')}" />
                </div>
            </div>
        `;
    }

    if (cachedModels.length > 0) {
        const currentModel = chatSettings.model || cachedModels[0];
        const isCustom = !cachedModels.includes(currentModel);

        return `
            <div class="space-y-1.5">
                <div class="relative">
                    <select id="chat-model-select"
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
                    <input type="text" id="chat-model-custom-input"
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
            <span class="text-xs font-mono text-fg-primary">${escapeHtml(chatSettings.model || '(No model selected)')}</span>
            <button type="button" id="fetch-now-btn" class="px-2.5 py-1 text-xs bg-bg-app border border-border-default hover:bg-border-default
            rounded text-fg-primary cursor-pointer">
                Validate & Fetch Models
            </button>
        </div>
    `;
}

function attachModelInputListeners() {
    const select = document.getElementById('chat-model-select') as HTMLSelectElement | null;
    const customWrapper = document.getElementById('custom-model-wrapper');
    const customInput = document.getElementById('chat-model-custom-input') as HTMLInputElement | null;
    const manualInput = document.getElementById('chat-model-manual') as HTMLInputElement | null;
    const fetchNowBtn = document.getElementById('fetch-now-btn') as HTMLButtonElement | null;

    select?.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === '__custom__') {
            customWrapper?.classList.remove('hidden');
            customInput?.focus();
        } else {
            customWrapper?.classList.add('hidden');
            store.getState().setChatSettings({ model: val });
        }
    });

    customInput?.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value.trim();
        if (val) {
            store.getState().setChatSettings({ model: val });
        }
    });

    manualInput?.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value.trim();
        if (val) {
            store.getState().setChatSettings({ model: val });
        }
    });

    fetchNowBtn?.addEventListener('click', () => {
        triggerModelFetch();
    });
}

async function triggerModelFetch() {
    const cs = store.getState().chatSettings;
    const { baseUrl, apiKey } = cs;
    if (!baseUrl) return;

    isFetchingModels = true;
    modelFetchError = null;
    syncSettingsUI();

    const result = await fetchAvailableModels(baseUrl, apiKey);
    isFetchingModels = false;

    if (result.success) {
        cachedModels = result.models;
        modelFetchError = null;
        // If current model is not set or not in list, pick the first model from the endpoint
        const currentModel = store.getState().chatSettings.model;
        if (!currentModel || (!cachedModels.includes(currentModel) && cachedModels.length > 0)) {
            store.getState().setChatSettings({ model: cachedModels[0] });
        }
    } else {
        cachedModels = [];
        modelFetchError = result.error || 'Failed to fetch models';
    }

    syncSettingsUI();
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

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 15000);

        const res = await fetch(endpoint, {
            method: 'GET',
            headers,
            signal: abortController.signal,
        });
        clearTimeout(timeoutId);

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
    syncSettingsUI();
    elements.settings.modal?.classList.remove('hidden');
    elements.settings.modal?.classList.add('flex');

    const cs = store.getState().chatSettings;
    if (cs.baseUrl && cachedModels.length === 0 && !isFetchingModels) {
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





