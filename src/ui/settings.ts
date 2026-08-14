import { elements } from '../core/elements';
import { store } from '../core/store';
import { updateEditorVimMode } from '../core/editor';
import { ICONS } from './icons';

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

    // close on click outside
    elements.settings.modal?.addEventListener('click', (e) => {
        if (e.target === elements.settings.modal) {
            closeModal();
        }
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

    elements.settings.content.innerHTML = `
        <div class="flex flex-col">
            <div class="flex items-center justify-between py-3 border-b border-border-default last:border-0">
                <div class="flex flex-col pr-4">
                    <span class="text-base text-fg-primary font-medium">Enable Vim Mode</span>
                    <span class="text-xs text-fg-muted">Use Vim keybindings in the code editor</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer select-none">
                    <input type="checkbox" id="vim-mode-toggle" class="sr-only peer" ${isVimEnabled ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-border-default peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                </label>
            </div>
        </div>
    `;

    const vimToggle = document.getElementById('vim-mode-toggle') as HTMLInputElement | null;
    vimToggle?.addEventListener('change', (e) => {
        const enabled = (e.target as HTMLInputElement).checked;
        store.getState().setVimMode(enabled);
        updateEditorVimMode(enabled);
    });
}

function openModal() {
    renderSettings();
    elements.settings.modal?.classList.remove('hidden');
    elements.settings.modal?.classList.add('flex');
}

function closeModal() {
    elements.settings.modal?.classList.add('hidden');
    elements.settings.modal?.classList.remove('flex');
}
