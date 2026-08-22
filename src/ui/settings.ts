//TODO: Are there portions here that can be pushed off to index.html?
import { elements } from '../core/elements';
import { store, ensureSettingsDecrypted, ChatSettings, ChatEndpoint, GistSyncSettings } from '../core/store';
import { updateEditorVimMode } from '../core/editor';
import { decryptSecret } from '../core/crypto';
import { ICONS } from './icons';
import { abortAllStreams } from './chatPanel';
import { showConfirmDialog } from './resetProgress';
import { showPopup } from './popup';
import { pullFromGist, pushToGist, initiateOAuthLogin, subscribeSyncStatus, getSyncStatus, SyncStateEvent, createAndLinkGist } from '../core/sync/syncManager';
import { validateToken, extractGistId } from '../core/sync/gistClient';
import { SITE_SLUG } from '../core/siteConfig';
import { buildManualExportPayload, parseManualImport } from '../core/backup';

let cachedModels: string[] = [];
let isFetchingModels = false;
let modelFetchError: string | null = null;
let isDetailsExpanded = false;
let isManualGistExpanded = false;

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
    if (elements.settings.clearStorageIcon) {
        elements.settings.clearStorageIcon.innerHTML = ICONS.TRASH;
    }
    if (elements.settings.gistManualChevron) {
        elements.settings.gistManualChevron.innerHTML = ICONS.CHEVRON_RIGHT;
    }

    // Subscribe to reactive sync status updates
    subscribeSyncStatus((event) => {
        updateSyncStatusUI(event);
    });

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
        if (enabled) {
            isDetailsExpanded = true;
        }
        store.getState().setChatSettings({ enabled });
        if (enabled) {
            elements.settings.chatFields?.classList.remove('hidden');
            if (cachedModels.length === 0 && store.getState().chatSettings.baseUrl) {
                triggerModelFetch();
            }
        } else {
            elements.settings.chatFields?.classList.add('hidden');
        }
        syncSettingsUI();
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

    // Clear / Nuke Local Storage button
    elements.settings.clearStorageBtn?.addEventListener('click', () => {
        handleClearLocalStorage();
    });

    // Gist Sync listeners
    elements.settings.gistOAuthLoginBtn?.addEventListener('click', () => {
        initiateOAuthLogin();
    });

    // Collapsible Manual PAT toggle
    updateManualGistToggleUI();
    elements.settings.gistManualToggleBtn?.addEventListener('click', () => {
        isManualGistExpanded = !isManualGistExpanded;
        updateManualGistToggleUI();
    });

    elements.settings.gistManualConnectBtn?.addEventListener('click', () => {
        handleManualGistConnect();
    });

    elements.settings.gistSyncNowBtn?.addEventListener('click', () => {
        handleSyncNow();
    });

    elements.settings.gistPullBtn?.addEventListener('click', () => {
        handlePullGist();
    });

    elements.settings.gistUnlinkBtn?.addEventListener('click', () => {
        handleUnlinkGist();
    });

    elements.settings.gistAutosyncToggle?.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        store.getState().setGistSyncSettings({ autoSync: checked });
    });
}

function syncSettingsUI() {
    const isVimEnabled = store.getState().vimMode;
    const chatSettings = store.getState().chatSettings || {
        enabled: false,
        baseUrl: '',
        apiKey: '',
        model: '',
        selectedEndpointId: 'default-endpoint',
        endpoints: [
            {
                id: 'default-endpoint',
                name: 'Endpoint 1',
                baseUrl: '',
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

    const gistSyncSettings = store.getState().gistSyncSettings || {
        enabled: false,
        token: '',
        gistId: '',
        autoSync: true,
    };
    renderGistSection(gistSyncSettings);

    updateStorageUsageDisplay();
}

function renderEndpointSelector(chatSettings: ChatSettings) {
    if (!elements.settings.endpointSection) return;

    const endpoints = chatSettings.endpoints || [];
    const selectedId = chatSettings.selectedEndpointId;
    const currentEndpoint = endpoints.find(ep => ep.id === selectedId) || endpoints[0];
    const hasData = !!(currentEndpoint?.name?.trim() || currentEndpoint?.baseUrl?.trim() || currentEndpoint?.apiKey?.trim());
    const canDelete = endpoints.length > 1 || hasData;

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
        const endpoints = cs.endpoints || [];
        cachedModels = [];
        modelFetchError = null;

        if (endpoints.length > 1) {
            const updated = endpoints.filter(ep => ep.id !== cs.selectedEndpointId);
            const nextSelected = updated[0];
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
        } else {
            const resetEp: ChatEndpoint = {
                id: 'default-endpoint',
                name: '',
                baseUrl: '',
                apiKey: '',
                model: '',
            };
            store.getState().setChatSettings({
                endpoints: [resetEp],
                selectedEndpointId: resetEp.id,
                baseUrl: '',
                apiKey: '',
                model: '',
            });
            isDetailsExpanded = true;
            syncSettingsUI();
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

    const resolvedApiKey = (await decryptSecret(apiKey || '')).trim();
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
        if (resolvedApiKey) {
            headers['Authorization'] = `Bearer ${resolvedApiKey}`;
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
    const cs = store.getState().chatSettings;
    if (cs.enabled && !cs.baseUrl) {
        isDetailsExpanded = true;
    }
    syncSettingsUI();
    elements.settings.modal?.classList.remove('hidden');
    elements.settings.modal?.classList.add('flex');

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
    if (key.startsWith('enc:v1:')) return '••••••••';
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

async function handleExportBackup() {
    try {
        const state = store.getState();
        const includeKeys = !!elements.settings.includeKeysCheckbox?.checked;

        const dataStr = await buildManualExportPayload(state, { includeKeys });
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

        a.href = url;
        a.download = `${SITE_SLUG}-backup-${timestamp}.json`;
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
        const result = parseManualImport(text, store.getState());

        if (!result.success || !result.data) {
            showBackupStatus(result.error || 'Import failed: The selected file is not valid JSON.', true);
            input.value = '';
            return;
        }

        // Apply backup to store
        store.getState().restoreBackup(result.data);

        // Sync editor vim mode and UI
        if (typeof result.data.vimMode === 'boolean') {
            updateEditorVimMode(result.data.vimMode);
        }
        cachedModels = [];
        modelFetchError = null;
        syncSettingsUI();
        updateStorageUsageDisplay();

        showBackupStatus('Backup restored successfully.');
    } catch (err: any) {
        showBackupStatus(`Import failed: ${err?.message || 'Unknown error'}`, true);
    } finally {
        input.value = '';
    }
}

function formatBytes(bytes: number, decimals = 1): string {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return `${formatted} ${sizes[i] || 'B'}`;
}

export function calculateLocalStorageUsage(): { bytes: number; formatted: string } {
    let totalBytes = 0;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const val = localStorage.getItem(key) || '';
                // UTF-16 strings take ~2 bytes per character
                totalBytes += (key.length + val.length) * 2;
            }
        }
    } catch {
        // Handle potential sandbox/quota restrictions
    }
    return {
        bytes: totalBytes,
        formatted: formatBytes(totalBytes),
    };
}

function updateStorageUsageDisplay() {
    if (elements.settings.storageUsageDisplay) {
        const usage = calculateLocalStorageUsage();
        elements.settings.storageUsageDisplay.textContent = `${usage.formatted} used`;
    }
}

function handleClearLocalStorage() {
    showConfirmDialog({
        title: 'Nuke Local Storage',
        message: 'Are you sure you want to delete all local storage? This will permanently wipe all your exercise progress, saved code, chat history, credentials, and settings. This action cannot be undone.',
        confirmText: 'Nuke All Storage',
        onConfirm: () => {
            abortAllStreams();
            try {
                store.getState().unlinkGist();
            } catch { }
            localStorage.clear();
            window.location.reload();
        },
    });
}

// ==========================================
// Gist Sync UI Renderers and Handlers
// ==========================================

function updateSyncStatusUI(event: SyncStateEvent) {
    const badge = elements.settings.gistSyncBadge;
    const dot = elements.settings.gistSyncDot;
    const badgeText = elements.settings.gistSyncBadgeText;
    const syncNowBtn = elements.settings.gistSyncNowBtn;
    const syncNowText = elements.settings.gistSyncNowText;

    if (!badge || !dot || !badgeText) return;

    const gistSettings = store.getState().gistSyncSettings;
    const isLinked = !!gistSettings?.gistId;

    if (!isLinked) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
        dot.className = 'w-1.5 h-1.5 rounded-full bg-fg-muted';
        badgeText.textContent = 'Not connected';
        badgeText.className = 'text-fg-muted';
        return;
    }

    badge.classList.remove('hidden');
    badge.classList.add('flex');

    if (event.status === 'syncing') {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse';
        badgeText.textContent = 'Syncing...';
        badgeText.className = 'text-yellow-400 font-medium';
        if (syncNowBtn) syncNowBtn.disabled = true;
        if (syncNowText) syncNowText.textContent = 'Syncing...';
    } else if (event.status === 'error') {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-red-500';
        badgeText.textContent = 'Sync Error';
        badgeText.className = 'text-red-400 font-medium';
        if (syncNowBtn) syncNowBtn.disabled = false;
        if (syncNowText) syncNowText.textContent = 'Sync Now';
    } else if (event.status === 'offline') {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-fg-muted';
        badgeText.textContent = 'Offline';
        badgeText.className = 'text-fg-muted';
        if (syncNowBtn) syncNowBtn.disabled = true;
        if (syncNowText) syncNowText.textContent = 'Sync Now';
    } else {
        // Synced / Idle with linked gist
        dot.className = 'w-1.5 h-1.5 rounded-full bg-green-500';
        if (event.lastSyncedAt) {
            const timeAgo = formatTimeAgo(event.lastSyncedAt);
            badgeText.textContent = `Synced ${timeAgo}`;
        } else {
            badgeText.textContent = 'Connected';
        }
        badgeText.className = 'text-green-500 font-medium';
        if (syncNowBtn) syncNowBtn.disabled = false;
        if (syncNowText) syncNowText.textContent = 'Sync Now';
    }
}

function formatTimeAgo(timestamp: number): string {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (elapsedSeconds < 10) return 'just now';
    if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${elapsedDays}d ago`;
}

let cachedGitHubUsername: string | null = null;

function renderGistSection(settings: GistSyncSettings) {
    const isConnected = !!settings.enabled && !!settings.token && !!settings.gistId;
    const loggedOutView = elements.settings.gistLoggedOutView;
    const loggedInView = elements.settings.gistLoggedInView;
    const usernameEl = elements.settings.gistAccountUsername;
    const openLink = elements.settings.gistOpenLink;
    const autosyncToggle = elements.settings.gistAutosyncToggle;

    if (isConnected) {
        loggedOutView?.classList.add('hidden');
        loggedInView?.classList.remove('hidden');
        loggedInView?.classList.add('flex');

        if (openLink) {
            openLink.href = `https://gist.github.com/${extractGistId(settings.gistId)}`;
        }

        if (autosyncToggle) {
            autosyncToggle.checked = settings.autoSync !== false;
        }

        if (usernameEl) {
            if (cachedGitHubUsername) {
                usernameEl.textContent = `Connected as @${cachedGitHubUsername}`;
            } else {
                usernameEl.textContent = 'Connected to GitHub';
                ensureSettingsDecrypted().then(() => {
                    const activeToken = store.getState().gistSyncSettings?.token;
                    if (activeToken && !activeToken.startsWith('enc:v1:')) {
                        validateToken(activeToken).then((res) => {
                            if (res.valid && res.username) {
                                cachedGitHubUsername = res.username;
                                if (usernameEl) {
                                    usernameEl.textContent = `Connected as @${res.username}`;
                                }
                            }
                        }).catch(() => { });
                    }
                }).catch(() => { });
            }
        }
    } else {
        cachedGitHubUsername = null;
        loggedOutView?.classList.remove('hidden');
        loggedInView?.classList.add('hidden');
        loggedInView?.classList.remove('flex');
    }

    updateSyncStatusUI(getSyncStatus());
}

function updateManualGistToggleUI() {
    const view = elements.settings.gistManualView;
    const chevron = elements.settings.gistManualChevron;
    const label = elements.settings.gistManualToggleLabel;

    if (view) {
        view.classList.toggle('hidden', !isManualGistExpanded);
        view.classList.toggle('flex', isManualGistExpanded);
    }
    if (chevron) {
        chevron.classList.toggle('rotate-90', isManualGistExpanded);
    }
    if (label) {
        label.textContent = isManualGistExpanded
            ? 'Hide Personal Access Token (PAT) setup'
            : 'Or connect manually with Personal Access Token (PAT)';
    }
}

function showGistStatus(message: string, isError = false) {
    const el = elements.settings.gistStatusMsg;
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
    }, 6000);
}

async function handleSyncNow() {
    showGistStatus('Syncing progress to GitHub Gist...');
    const res = await pushToGist();
    if (res.success) {
        showGistStatus('Synced successfully with GitHub Gist.');
    } else {
        showGistStatus(`Sync failed: ${res.error || 'Network error'}`, true);
    }
}

async function handlePullGist() {
    showGistStatus('Pulling latest progress from GitHub Gist...');
    const res = await pullFromGist({ smartMerge: true });
    if (res.success) {
        showGistStatus('Progress pulled and merged successfully.');
        syncSettingsUI();
    } else {
        showGistStatus(`Pull failed: ${res.error || 'Network error'}`, true);
    }
}

function handleUnlinkGist() {
    showConfirmDialog({
        title: 'Disconnect GitHub Sync',
        message: 'Are you sure you want to disconnect? Your local progress will be preserved, but cloud syncing will stop on this device.',
        confirmText: 'Disconnect',
        onConfirm: () => {
            cachedGitHubUsername = null;
            store.getState().unlinkGist();
            syncSettingsUI();
            showGistStatus('Disconnected from GitHub Gist.');
        },
    });
}

async function handleManualGistConnect() {
    const tokenInput = elements.settings.gistManualToken;
    const idInput = elements.settings.gistManualId;
    if (!tokenInput || !idInput) return;

    const token = tokenInput.value.trim();
    const gistId = idInput.value.trim();

    if (!token) {
        showGistStatus('Error: GitHub Personal Access Token is required.', true);
        return;
    }

    const { gistManualConnectBtn } = elements.settings;
    if (gistManualConnectBtn) {
        gistManualConnectBtn.disabled = true;
        gistManualConnectBtn.textContent = 'Connecting...';
    }

    try {
        if (gistId) {
            // Connect to existing Gist
            const now = Date.now();
            store.getState().setGistSyncSettings({
                enabled: true,
                token,
                gistId,
                autoSync: true,
                lastSyncedAt: now,
            });
            showPopup('Syncing from GitHub...');
            const res = await pullFromGist({ smartMerge: true });
            if (res.success) {
                showGistStatus('Connected and pulled from Gist successfully.');
                showPopup('Connected to GitHub!');
                tokenInput.value = '';
                idInput.value = '';
                syncSettingsUI();
            } else {
                store.getState().unlinkGist();
                showGistStatus(`Failed to pull from Gist: ${res.error}`, true);
            }
        } else {
            // Create new Gist
            const res = await createAndLinkGist(token);
            if (res.success) {
                showGistStatus('New Gist created and linked successfully.');
                showPopup('Connected to GitHub!');
                tokenInput.value = '';
                idInput.value = '';
                syncSettingsUI();
            } else {
                showGistStatus(`Failed to create Gist: ${res.error}`, true);
            }
        }
    } finally {
        if (gistManualConnectBtn) {
            gistManualConnectBtn.disabled = false;
            gistManualConnectBtn.textContent = 'Connect Manually';
        }
    }
}






