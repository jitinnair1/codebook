import { elements } from '../core/elements';
import { ICONS } from './icons';
import { store } from '../core/store';
import { abortAllStreams } from './chatPanel';

export function initResetProgress() {
    if (elements.resetProgressBtn) {
        elements.resetProgressBtn.innerHTML = ICONS.TRASH;
    }
    if (elements.resetProgress.closeBtn) {
        elements.resetProgress.closeBtn.innerHTML = ICONS.CLOSE;
    }

    elements.resetProgressBtn?.addEventListener('click', openModal);
    elements.resetProgress.closeBtn?.addEventListener('click', closeModal);
    elements.resetProgress.cancelBtn?.addEventListener('click', closeModal);

    elements.resetProgress.confirmBtn?.addEventListener('click', () => {
        abortAllStreams();
        store.getState().resetProgress();
        window.location.reload();
    });

    //close on click outside (only if both mousedown and click originated directly on the backdrop)
    let isMouseDownOnBackdrop = false;

    elements.resetProgress.modal?.addEventListener('mousedown', (e) => {
        isMouseDownOnBackdrop = (e.target === elements.resetProgress.modal);
    });

    elements.resetProgress.modal?.addEventListener('click', (e) => {
        if (isMouseDownOnBackdrop && e.target === elements.resetProgress.modal) {
            closeModal();
        }
        isMouseDownOnBackdrop = false;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.resetProgress.modal && !elements.resetProgress.modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

function openModal() {
    elements.resetProgress.modal?.classList.remove('hidden');
    elements.resetProgress.modal?.classList.add('flex');
}

function closeModal() {
    elements.resetProgress.modal?.classList.add('hidden');
    elements.resetProgress.modal?.classList.remove('flex');
}
