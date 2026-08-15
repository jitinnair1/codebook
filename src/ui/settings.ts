//TODO: Are there portions here that can be pushed off to index.html?
import { elements } from '../core/elements';
import { store, ChatSettings, ChatEndpoint } from '../core/store';
import { updateEditorVimMode } from '../core/editor';
import { ICONS } from './icons';
import siteConfig from '../../site.toml';

let cachedModels: string[] = [];
let isFetchingModels = false;
let modelFetchError: string | null = null;
let isDetailsExpanded = false;

export function initSettings() {
    if (elements.settingsBtn) {
        elements.settingsBtn.innerHTML = ICONS.SETTINGS;
    }
    if (elements.settings.closeBtn) {
        elements.settings.closeBtn.innerHTML = ICONS.CLOSE;
    }
    if (elements.settings.exportBackupIcon) {
        elements.settings.exportBackupIcon.innerHTML = ICONS.DOWNLOAD;
    }
    if (elements.settings.importBackupIcon) {
        elements.settings.importBackupIcon.innerHTML = ICONS.UPLOAD;
    }

    // Bind static event listeners once
    bindStaticListeners();

    // Initial sync of settings UI
    syncSettingsUI();

    // Re-sync whenever store hydrates or updates in background
    store.subscribe(() => {
        const modal = elements.settings.modal;
        if (modal && !modal.classList.contains('hidden')) {
            const activeEl = document.activeElement;
            const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
            if (!isEditing) {
                syncSettingsUI();
            }
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

    // Export Backup button
    elements.settings.exportBackupBtn?.addEventListener('click', () => {
        handleExportBackup();
    });

    // Import Backup button & file input
    elements.settings.importBackupBtn?.addEventListener('click', () => {
        elements.settings.importBackupInput?.click();
    });

    elements.settings.importBackupInput?.addEventListener('change', (e) => {
        handleImportBackup(e);
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
    const currentEndpoint = endpoints.find(ep => ep.id === selectedId) || endpoints[0];
    const canDelete = endpoints.length > 1;

    elements.settings.endpointSection.innerHTML = `
        <div class="flex flex-col space-y-1.5">
            <!-- Saved Endpoint Selection Header -->
            <div class="flex items-center justify-between">
                <label for="chat-endpoint-combobox-input" class="text-xs font-semibold text-fg-primary">
                    Saved Endpoint
                </label>
                <div class="flex items-center gap-2">
                    <button type="button" id="chat-add-endpoint-btn" class="text-[11px] text-brand hover:underline font-medium cursor-pointer transition-colors" title="Add a new endpoint">
                        + Add Endpoint
                    </button>
                    ${canDelete ? `
                        <span class="text-border-default text-xs select-none">|</span>
                        <button type="button" id="chat-delete-endpoint-btn" class="text-[11px] text-red-400 hover:text-red-500 font-medium cursor-pointer transition-colors" title="Delete current endpoint">
                            Delete
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Combobox: Editable Name Input + Saved Endpoint Dropdown -->
            <div class="relative" id="chat-endpoint-combobox-wrapper">
                <div class="relative flex items-center">
                    <button type="button" id="chat-endpoint-combobox-toggle"
                        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-primary rounded cursor-pointer transition-colors z-10 flex items-center justify-center p-0"
                        title="Show saved endpoints">
                        <span id="combobox-arrow" class="inline-flex items-center justify-center transition-transform duration-150">${ICONS.CHEVRON_DOWN}</span>
                    </button>
                    <input type="text" id="chat-endpoint-combobox-input"
                        class="w-full pl-7 pr-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-brand font-mono"
                        placeholder="Endpoint name (e.g. OpenAI API, Local Ollama)"
                        value="${escapeHtml(currentEndpoint?.name || '')}"
                        autocomplete="off"
                        title="Type to rename, click arrow to switch" />
                </div>

                <!-- Combobox Dropdown Menu -->
                <div id="chat-endpoint-combobox-menu"
                    class="hidden absolute left-0 right-0 top-full mt-1 bg-bg-surface border border-border-default rounded-md shadow-xl z-50 max-h-48 overflow-y-auto py-1 text-xs">
                    ${endpoints.map(ep => `
                        <div class="combobox-endpoint-item px-3 py-1.5 hover:bg-bg-app cursor-pointer flex items-center justify-between text-fg-primary ${ep.id === selectedId ? 'bg-brand/10 font-medium text-brand' : ''}"
                            data-endpoint-id="${escapeHtml(ep.id)}">
                            <span class="truncate endpoint-item-label">${escapeHtml(ep.name || ep.baseUrl || 'Unnamed Endpoint')}</span>
                            ${ep.id === selectedId ? '<span class="text-[10px] text-brand ml-2 shrink-0">✓</span>' : ''}
                        </div>
                    `).join('')}
                    <div class="border-t border-border-default my-1"></div>
                    <div id="combobox-add-new-option" class="px-3 py-1.5 hover:bg-bg-app cursor-pointer text-brand font-medium flex items-center gap-1.5">
                        <span class="text-xs">+</span>
                        <span>Add new endpoint...</span>
                    </div>
                </div>
            </div>

            <!-- Toggle Details Button (Minimal) -->
            <div>
                <button type="button" id="toggle-endpoint-details-btn"
                    class="text-[10px] text-fg-muted hover:text-fg-primary inline-flex items-center gap-1 transition-colors cursor-pointer select-none py-0.5">
                    <span id="toggle-details-chevron" class="inline-flex items-center justify-center transition-transform duration-150 ${isDetailsExpanded ? 'rotate-90' : ''}">
                        ${ICONS.CHEVRON_RIGHT}
                    </span>
                    <span id="toggle-endpoint-details-label">${isDetailsExpanded ? 'Hide URL & API key' : 'Edit URL & API key'}</span>
                </button>
            </div>

            <!-- Collapsible Configuration Card (Base URL & API Key) -->
            <div id="endpoint-details-panel" class="${isDetailsExpanded ? 'flex' : 'hidden'} flex-col space-y-2.5 p-2.5 rounded-lg bg-bg-app/40 border border-border-default/60">
                <!-- Base URL -->
                <div class="flex flex-col space-y-1">
                    <div class="flex items-center justify-between">
                        <label for="chat-base-url" class="text-[10px] font-medium text-fg-secondary">
                            Base URL
                        </label>
                        <span class="text-[9px] text-fg-muted font-normal">OpenAI-compatible</span>
                    </div>
                    <input type="text" id="chat-base-url"
                        class="w-full px-2.5 py-1 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-brand font-mono"
                        placeholder="https://api.openai.com/v1"
                        value="${escapeHtml(chatSettings.baseUrl || '')}" />
                    <span class="text-[9px] text-fg-muted leading-tight">
                        e.g. https://api.openai.com/v1, http://localhost:11434/v1 (Ollama)
                    </span>
                </div>

                <!-- API Key -->
                <div class="flex flex-col space-y-1">
                    <div class="flex items-center justify-between">
                        <label class="text-[10px] font-medium text-fg-secondary">
                            API Key
                        </label>
                        <span class="text-[9px] text-fg-muted font-normal">Optional for local servers</span>
                    </div>
                    <div id="chat-key-container">
                        <!-- rendered by renderKeyContainer -->
                    </div>
                </div>
            </div>
        </div>
    `;

    attachEndpointListeners();
}

function addNewEndpoint() {
    isDetailsExpanded = true;
    const cs = store.getState().chatSettings;
    const endpoints = cs.endpoints || [];
    const newEp: ChatEndpoint = {
        id: 'ep-' + Date.now(),
        name: `Endpoint ${endpoints.length + 1}`,
        baseUrl: '',
        apiKey: '',
        model: '',
    };
    const updatedEndpoints = [...endpoints, newEp];
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
        const comboboxInput = document.getElementById('chat-endpoint-combobox-input') as HTMLInputElement | null;
        if (comboboxInput) {
            comboboxInput.focus();
            comboboxInput.select();
        }
    }, 50);
}

function attachEndpointListeners() {
    const wrapper = document.getElementById('chat-endpoint-combobox-wrapper');
    const input = document.getElementById('chat-endpoint-combobox-input') as HTMLInputElement | null;
    const toggleBtn = document.getElementById('chat-endpoint-combobox-toggle') as HTMLButtonElement | null;
    const menu = document.getElementById('chat-endpoint-combobox-menu') as HTMLElement | null;
    const arrow = document.getElementById('combobox-arrow') as HTMLElement | null;
    const addBtn = document.getElementById('chat-add-endpoint-btn') as HTMLButtonElement | null;
    const addNewOption = document.getElementById('combobox-add-new-option') as HTMLElement | null;
    const deleteBtn = document.getElementById('chat-delete-endpoint-btn') as HTMLButtonElement | null;
    const toggleDetailsBtn = document.getElementById('toggle-endpoint-details-btn') as HTMLButtonElement | null;
    const urlInput = document.getElementById('chat-base-url') as HTMLInputElement | null;

    const openMenu = () => {
        menu?.classList.remove('hidden');
        arrow?.classList.add('rotate-180');
    };

    const closeMenu = () => {
        menu?.classList.add('hidden');
        arrow?.classList.remove('rotate-180');
    };

    const toggleMenu = () => {
        if (menu?.classList.contains('hidden')) {
            openMenu();
        } else {
            closeMenu();
        }
    };

    toggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    // Selecting an endpoint from the combobox menu
    menu?.querySelectorAll('.combobox-endpoint-item').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const epId = item.getAttribute('data-endpoint-id');
            closeMenu();
            if (epId) {
                cachedModels = [];
                modelFetchError = null;
                store.getState().setChatSettings({
                    selectedEndpointId: epId,
                });
                syncSettingsUI();
                const cs = store.getState().chatSettings;
                if (cs.baseUrl) {
                    triggerModelFetch();
                }
            }
        });
    });

    // "+ Add new endpoint..." in the combobox menu
    addNewOption?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        addNewEndpoint();
    });

    // Close combobox menu when clicking outside
    const handleOutsideClick = (e: MouseEvent) => {
        if (wrapper && !wrapper.contains(e.target as Node)) {
            closeMenu();
        }
    };
    document.addEventListener('click', handleOutsideClick);

    // Live typing in the combobox input renames the active endpoint
    input?.addEventListener('input', () => {
        const newName = input.value;
        const cs = store.getState().chatSettings;
        const updatedEndpoints = (cs.endpoints || []).map(ep =>
            ep.id === cs.selectedEndpointId ? { ...ep, name: newName } : ep
        );
        store.getState().setChatSettings({ endpoints: updatedEndpoints });

        // Update active item label live in the menu
        const activeItem = menu?.querySelector(`.combobox-endpoint-item[data-endpoint-id="${cs.selectedEndpointId}"] .endpoint-item-label`);
        if (activeItem) {
            activeItem.textContent = newName.trim() || cs.baseUrl || 'Unnamed Endpoint';
        }
    });

    // Top "+ Add Endpoint" button
    addBtn?.addEventListener('click', () => {
        closeMenu();
        addNewEndpoint();
    });

    // Toggle configuration details button
    toggleDetailsBtn?.addEventListener('click', () => {
        isDetailsExpanded = !isDetailsExpanded;
        const panel = document.getElementById('endpoint-details-panel');
        const chevronEl = document.getElementById('toggle-details-chevron');
        const labelEl = document.getElementById('toggle-endpoint-details-label');
        if (panel) {
            panel.classList.toggle('hidden', !isDetailsExpanded);
            panel.classList.toggle('flex', isDetailsExpanded);
        }
        if (chevronEl) {
            chevronEl.classList.toggle('rotate-90', isDetailsExpanded);
        }
        if (labelEl) {
            labelEl.textContent = isDetailsExpanded ? 'Hide URL & API key' : 'Edit URL & API key';
        }
    });

    // Delete endpoint button
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

    // Base URL input listeners
    urlInput?.addEventListener('input', (e) => {
        const newUrl = (e.target as HTMLInputElement).value.trim();
        store.getState().setChatSettings({ baseUrl: newUrl });
    });

    urlInput?.addEventListener('change', () => {
        triggerModelFetch();
    });
}

function renderKeyContainer(chatSettings: { apiKey: string }) {
    const container = document.getElementById('chat-key-container');
    if (!container) return;

    if (chatSettings.apiKey) {
        container.innerHTML = `
            <div class="flex items-center justify-between px-2.5 py-1.5 bg-bg-app border border-border-default rounded-md">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
                    <span class="text-xs font-mono text-fg-primary truncate select-none">${formatMaskedKey(chatSettings.apiKey)}</span>
                    <span class="text-[10px] text-fg-muted font-sans shrink-0">(Saved)</span>
                </div>
                <button type="button" id="clear-chat-key" class="text-[11px] text-red-400 hover:text-red-500 font-medium px-1.5 py-0.5 rounded 
                hover:bg-bg-surface transition-colors cursor-pointer shrink-0" title="Delete API Key">
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
                    class="w-full px-2.5 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary 
                    placeholder:text-fg-muted focus:outline-none focus:border-brand font-mono"
                    placeholder="Paste API key (sk-...) or leave blank"
                    value="" />
            </div>
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
                <div class="relative flex items-center">
                    <div class="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-fg-muted z-10 flex items-center justify-center">
                        ${ICONS.CHEVRON_DOWN}
                    </div>
                    <select id="chat-model-select"
                        class="w-full pl-7 pr-3 py-1.5 text-xs bg-bg-app border border-border-default rounded-md text-fg-primary focus:outline-none
                        focus:border-brand font-mono appearance-none cursor-pointer">
                        ${cachedModels.map(m => `
                            <option value="${escapeHtml(m)}" ${m === currentModel ? 'selected' : ''}>
                                ${escapeHtml(m)}
                            </option>
                        `).join('')}
                        <option value="__custom__" ${isCustom ? 'selected' : ''}>+ Custom model name...</option>
                    </select>
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

function showBackupStatus(message: string, isError: boolean = false) {
    const el = elements.settings.backupStatusMsg;
    if (!el) return;
    el.textContent = message;
    el.className = `text-xs rounded-md p-2 transition-all ${isError
            ? 'bg-red-500/10 border border-red-500/20 text-red-400 block'
            : 'bg-green-500/10 border border-green-500/20 text-green-400 block'
        }`;
    setTimeout(() => {
        if (el.textContent === message) {
            el.className = 'hidden text-xs rounded-md p-2';
            el.textContent = '';
        }
    }, 5000);
}

function handleExportBackup() {
    try {
        const state = store.getState();
        const includeKeys = !!elements.settings.includeKeysCheckbox?.checked;

        // Copy and sanitize chat settings based on checkbox
        let exportChatSettings: ChatSettings = {
            ...state.chatSettings,
            endpoints: (state.chatSettings.endpoints || []).map(ep => ({ ...ep })),
        };

        if (!includeKeys) {
            exportChatSettings.apiKey = '';
            exportChatSettings.endpoints = exportChatSettings.endpoints.map(ep => ({
                ...ep,
                apiKey: '',
            }));
        }

        const siteTitle = siteConfig.title || 'codebook';
        const siteSlug = siteTitle.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'codebook';

        const backupPayload = {
            version: 1,
            siteTitle,
            exportedAt: new Date().toISOString(),
            data: {
                currentExerciseId: state.currentExerciseId,
                currentLanguageId: state.currentLanguageId,
                completedIds: state.completedIds,
                userCode: state.userCode,
                vimMode: state.vimMode,
                chatSettings: exportChatSettings,
                chatHistory: state.chatHistory,
            },
        };

        const dataStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

        a.href = url;
        a.download = `${siteSlug}-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showBackupStatus('Backup exported successfully.');
    } catch (err: any) {
        showBackupStatus(`Export failed: ${err?.message || 'Unknown error'}`, true);
    }
}

async function handleImportBackup(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
        const text = await file.text();
        let parsed: any;
        try {
            parsed = JSON.parse(text);
        } catch {
            showBackupStatus('Import failed: The selected file is not valid JSON.', true);
            input.value = '';
            return;
        }

        const currentSiteTitle = siteConfig.title || 'codebook';

        // Check if file has metadata wrapper or raw state dump
        let backupData: any = null;
        let fileSiteTitle: string | null = null;

        if (parsed && typeof parsed === 'object') {
            if (parsed.data && typeof parsed.data === 'object') {
                backupData = parsed.data;
                fileSiteTitle = parsed.siteTitle || null;
            } else if (parsed.state && typeof parsed.state === 'object') {
                backupData = parsed.state;
                fileSiteTitle = parsed.siteTitle || null;
            } else {
                backupData = parsed;
                fileSiteTitle = parsed.siteTitle || null;
            }
        }

        if (!backupData || typeof backupData !== 'object') {
            showBackupStatus('Import failed: Backup file does not contain valid application state.', true);
            input.value = '';
            return;
        }

        // Strict siteTitle validation
        if (fileSiteTitle && fileSiteTitle !== currentSiteTitle) {
            showBackupStatus(
                `Import rejected: Backup is for "${fileSiteTitle}", but current site is "${currentSiteTitle}".`,
                true
            );
            input.value = '';
            return;
        }

        // Apply backup to store
        store.getState().restoreBackup(backupData);

        // Sync editor vim mode and UI
        if (typeof backupData.vimMode === 'boolean') {
            updateEditorVimMode(backupData.vimMode);
        }
        cachedModels = [];
        modelFetchError = null;
        syncSettingsUI();

        showBackupStatus('Backup restored successfully.');
    } catch (err: any) {
        showBackupStatus(`Import failed: ${err?.message || 'Unknown error'}`, true);
    } finally {
        input.value = '';
    }
}






