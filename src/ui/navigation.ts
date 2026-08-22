import { StoreApi } from 'zustand/vanilla';
import { AppState } from '../core/store';
import { ICONS } from './icons';
import { exercises } from '../exercises/exercise-registry';

export function initNavigation(
    navPrev: HTMLButtonElement | null,
    navNext: HTMLButtonElement | null,
    store: StoreApi<AppState>,
    switchTabCallback: (tab: 'problem' | 'code') => void
) {
    if (!navPrev || !navNext) return;

    navPrev.innerHTML = ICONS.LEFT_ARROW;
    navNext.innerHTML = ICONS.RIGHT_ARROW;

    function goToNext() {
        const { activeLessonSlug } = store.getState();
        const idx = exercises.findIndex(e => e.id === activeLessonSlug);
        if (idx < exercises.length - 1) {
            window.location.hash = '#' + exercises[idx + 1].id;
            switchTabCallback('problem');
        }
    }

    function goToPrev() {
        const { activeLessonSlug } = store.getState();
        const idx = exercises.findIndex(e => e.id === activeLessonSlug);
        if (idx > 0) {
            window.location.hash = '#' + exercises[idx - 1].id;
            switchTabCallback('problem');
        }
    }

    navPrev.addEventListener('click', goToPrev);
    navNext.addEventListener('click', goToNext);

    return {
        updateNavState: (activeLessonSlug: string) => {
            const idx = exercises.findIndex(e => e.id === activeLessonSlug);
            const hasPrev = idx > 0;
            const hasNext = idx < exercises.length - 1;

            navPrev.disabled = !hasPrev;
            navNext.disabled = !hasNext;
        }
    };
}
