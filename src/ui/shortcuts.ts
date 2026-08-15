import { runner } from '../core/runner';
import { elements } from '../core/elements';
import { store } from '../core/store';
import { focusChatInput } from './chatPanel';
import { ICONS } from './icons';

interface Shortcut {
    action: string;
    keys: string[];
}

const EDITOR_SHORTCUTS: Shortcut[] = [
    { action: "Save Code", keys: ["Cmd/Ctrl", "S"] },
    { action: "Indent", keys: ["Tab"] },
    { action: "Unindent", keys: ["Shift", "Tab"] },
    { action: "Focus Out", keys: ["Esc", "Tab"] },
];

const NAVIGATION_SHORTCUTS: Shortcut[] = [
    { action: "Run Code", keys: ["Cmd/Ctrl", "Enter"] },
    { action: "Focus Rubber Duck", keys: ["Cmd/Ctrl", "Shift", "A"] },
    { action: "Previous Lesson", keys: ["Cmd/Ctrl", "["] },
    { action: "Next Lesson", keys: ["Cmd/Ctrl", "]"] },
    { action: "Show Shortcuts", keys: ["?", "or", "F1"] },
];

export function initShortcuts() {
    if (elements.shortcutsBtn) {
        elements.shortcutsBtn.innerHTML = ICONS.KEYBOARD;
    }
    if (elements.shortcuts.closeBtn) {
        elements.shortcuts.closeBtn.innerHTML = ICONS.CLOSE;
    }

    renderShortcuts();

    elements.shortcutsBtn?.addEventListener('click', openModal);
    elements.shortcuts.closeBtn?.addEventListener('click', closeModal);

    //close on click outside (only if both mousedown and click originated directly on the backdrop)
    let isMouseDownOnBackdrop = false;

    elements.shortcuts.modal?.addEventListener('mousedown', (e) => {
        isMouseDownOnBackdrop = (e.target === elements.shortcuts.modal);
    });

    elements.shortcuts.modal?.addEventListener('click', (e) => {
        if (isMouseDownOnBackdrop && e.target === elements.shortcuts.modal) {
            closeModal();
        }
        isMouseDownOnBackdrop = false;
    });

    //close on esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.shortcuts.modal && !elements.shortcuts.modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    //shortcut logic
    document.addEventListener('keydown', (e) => {

        // run: Cmd/Ctrl+Enter
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (!elements.runBtn.disabled) {
                runner.run();
            }
            return;
        }

        // focus Rubber Duck input: Cmd/Ctrl + Shift + A
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            e.stopPropagation();
            const cs = store.getState().chatSettings;
            if (cs?.enabled) {
                focusChatInput();
            }
            return;
        }

        // navigation: Cmd/Ctrl + [ or ]
        if ((e.metaKey || e.ctrlKey) && e.key === '[') {
            e.preventDefault();
            e.stopPropagation();
            if (elements.nav.prev && !elements.nav.prev.disabled) {
                elements.nav.prev.click();
            }
            return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key === ']') {
            e.preventDefault();
            e.stopPropagation();
            if (elements.nav.next && !elements.nav.next.disabled) {
                elements.nav.next.click();
            }
            return;
        }

        // show shortcuts: F1 (global)
        if (e.key === 'F1') {
            e.preventDefault();
            e.stopPropagation();
            if (elements.shortcuts.modal?.classList.contains('hidden')) {
                openModal();
            } else {
                closeModal();
            }
            return;
        }

        const active = document.activeElement;
        const isInput = active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            (active as HTMLElement).isContentEditable
        );

        //apply shortcuts when not in code editor
        if (!isInput) {
            // show shortcuts: ?
            if (e.key === '?') {
                e.preventDefault();
                e.stopPropagation();
                if (elements.shortcuts.modal?.classList.contains('hidden')) {
                    openModal();
                } else {
                    closeModal();
                }
                return;
            }
        }
    }, { capture: true });
}

function renderShortcuts() {
    if (!elements.shortcuts.list) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const renderGroup = (title: string, shortcuts: Shortcut[]) => {
        const items = shortcuts.map(s => {
            const keysHtml = s.keys.map(k => {
                let label = k;
                if (k === "Cmd/Ctrl") label = isMac ? "⌘" : "Ctrl";
                if (k === "Enter") label = "↵";

                if (k === "or") return `<span class="text-fg-muted text-xs mx-1">or</span>`;

                return `<kbd class="bg-bg-app border border-border-default rounded px-1.5 py-0.5 text-xs font-mono text-fg-muted
                min-w-5 text-center inline-block">${label}</kbd>`;
            }).reduce((acc, curr, i) => {
                if (i === 0) return curr;
                const prevKey = s.keys[i - 1];
                const currKey = s.keys[i];
                if (prevKey === "or" || currKey === "or") return acc + curr;
                return acc + '<span class="text-fg-muted text-xs mx-1">+</span>' + curr;
            }, "");

            return `
                <div class="flex items-center justify-between py-3 border-b border-border-default last:border-0">
                    <span class="text-base text-fg-primary">${s.action}</span>
                    <div class="flex items-center">
                        ${keysHtml}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="flex flex-col gap-3">
                <h3 class="text-xs font-bold text-fg-muted uppercase tracking-wider pb-2 border-b border-border-default">${title}</h3>
                <div class="flex flex-col">
                    ${items}
                </div>
            </div>
        `;
    };

    elements.shortcuts.list.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-16">
            ${renderGroup("Editor", EDITOR_SHORTCUTS)}
            ${renderGroup("Navigation", NAVIGATION_SHORTCUTS)}
        </div>
    `;
}

function openModal() {
    elements.shortcuts.modal?.classList.remove('hidden');
    elements.shortcuts.modal?.classList.add('flex');
}

function closeModal() {
    elements.shortcuts.modal?.classList.add('hidden');
    elements.shortcuts.modal?.classList.remove('flex');
}
