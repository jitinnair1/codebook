import { store } from '../core/store';
import { getEnabledLanguages } from '../languages/language-registry';
import { Exercise } from '../core/types';

export function renderLanguageSelector(container: HTMLElement, currentExercise: Exercise | undefined) {
    if (!container) return;

    const enabledLanguages = getEnabledLanguages();

    // If only 1 or 0 languages enabled site-wide, hide selector to keep UI clean
    if (enabledLanguages.length <= 1) {
        container.innerHTML = '';
        return;
    }

    const { currentLanguageId } = store.getState();

    // Check which languages are available for the current exercise
    const availableLanguages = enabledLanguages.map(lang => {
        let isAvailable = true;
        if (currentExercise?.variants) {
            isAvailable = lang.id in currentExercise.variants;
        }
        return {
            ...lang,
            isAvailable
        };
    });

    // Fallback logic: if current selected language is not available in current exercise, switch to first available
    const activeIsAvailable = availableLanguages.find(l => l.id === currentLanguageId && l.isAvailable);
    if (!activeIsAvailable) {
        const fallback = availableLanguages.find(l => l.isAvailable) || availableLanguages[0];
        if (fallback && fallback.id !== currentLanguageId) {
            setTimeout(() => {
                store.getState().setLanguage(fallback.id);
            }, 0);
        }
    }

    // Build styled dropdown HTML
    const optionsHtml = availableLanguages.map(lang => {
        const selected = lang.id === currentLanguageId ? 'selected' : '';
        const disabled = !lang.isAvailable ? 'disabled' : '';
        const label = lang.isAvailable ? lang.name : `${lang.name} (N/A)`;
        return `<option value="${lang.id}" ${selected} ${disabled} class="bg-bg-surface text-fg-primary">${label}</option>`;
    }).join('');

    container.innerHTML = `
        <select id="language-select-dropdown" aria-label="Select Language" class="bg-bg-app border border-border-default text-fg-primary text-xs font-semibold px-2 py-0.5 rounded focus:outline-none focus:border-brand cursor-pointer transition-colors">
            ${optionsHtml}
        </select>
    `;

    const selectEl = container.querySelector('#language-select-dropdown') as HTMLSelectElement;
    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            const newLang = (e.target as HTMLSelectElement).value;
            store.getState().setLanguage(newLang);
        });
    }
}
