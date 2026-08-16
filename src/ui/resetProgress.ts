import { elements } from '../core/elements';
import { ICONS } from './icons';
import { store } from '../core/store';
import { abortAllStreams } from './chatPanel';

export interface ConfirmDialogOptions {
    title?: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void | Promise<void>;
}

let pendingConfirmCallback: (() => void | Promise<void>) | null = null;

export function initResetProgress() {
    if (elements.resetProgressBtn) {
        elements.resetProgressBtn.innerHTML = ICONS.TRASH;
    }
    if (elements.resetProgress.closeBtn) {
        elements.resetProgress.closeBtn.innerHTML = ICONS.CLOSE;
    }

    elements.resetProgressBtn?.addEventListener('click', () => {
        showConfirmDialog({
            title: 'Reset Progress',
            message: 'Are you sure you want to reset all progress? This will delete your saved code and completion status for all exercises. This action cannot be undone.',
            confirmText: 'Reset All',
            onConfirm: () => {
                abortAllStreams();
                store.getState().resetProgress();
                window.location.reload();
            },
        });
    });

    elements.resetProgress.closeBtn?.addEventListener('click', closeConfirmDialog);
    elements.resetProgress.cancelBtn?.addEventListener('click', closeConfirmDialog);

    elements.resetProgress.confirmBtn?.addEventListener('click', async () => {
        const callback = pendingConfirmCallback;
        closeConfirmDialog();
        if (callback) {
            await callback();
        }
    });

    //close on click outside (only if both mousedown and click originated directly on the backdrop)
    let isMouseDownOnBackdrop = false;

    elements.resetProgress.modal?.addEventListener('mousedown', (e) => {
        isMouseDownOnBackdrop = (e.target === elements.resetProgress.modal);
    });

    elements.resetProgress.modal?.addEventListener('click', (e) => {
        if (isMouseDownOnBackdrop && e.target === elements.resetProgress.modal) {
            closeConfirmDialog();
        }
        isMouseDownOnBackdrop = false;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.resetProgress.modal && !elements.resetProgress.modal.classList.contains('hidden')) {
            closeConfirmDialog();
        }
    });
}

export function showConfirmDialog(options: ConfirmDialogOptions) {
    if (elements.resetProgress.title) {
        elements.resetProgress.title.textContent = options.title || 'Confirm Action';
    }
    if (elements.resetProgress.desc) {
        elements.resetProgress.desc.textContent = options.message;
    }
    if (elements.resetProgress.confirmBtn) {
        elements.resetProgress.confirmBtn.textContent = options.confirmText || 'Confirm';
    }

    pendingConfirmCallback = options.onConfirm;

    elements.resetProgress.modal?.classList.remove('hidden');
    elements.resetProgress.modal?.classList.add('flex');
}

export function closeConfirmDialog() {
    pendingConfirmCallback = null;
    elements.resetProgress.modal?.classList.add('hidden');
    elements.resetProgress.modal?.classList.remove('flex');
}

