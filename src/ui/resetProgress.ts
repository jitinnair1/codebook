import { elements } from '../core/elements';
import { ICONS } from './icons';

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
        localStorage.removeItem('storage');
        window.location.reload();
    });

    //close on click outside or Esc
    elements.resetProgress.modal?.addEventListener('click', (e) => {
        if (e.target === elements.resetProgress.modal) {
            closeModal();
        }
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
