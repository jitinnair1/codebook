import { Chapter } from '../core/types';
import { ICONS } from './icons';

export function renderSidebar(
    sidebarEl: HTMLElement | null,
    curriculum: Chapter[],
    currentExerciseId: string,
    completedIds: string[]
) {
    if (!sidebarEl) return;

    sidebarEl.innerHTML = curriculum.map(chapter => {
        const chapterHeader = `<div class="px-8 py-1 pb-0 text-[10px] font-bold text-fg-muted uppercase">${chapter.title}</div>`;

        const chapterExercises = chapter.exercises.map(e => {
            const isCompleted = completedIds.includes(e.id);
            const active = e.id === currentExerciseId ? 'bg-bg-surface text-fg-primary border-l-2 border-brand' : 'text-fg-muted hover:text-fg-primary';
            const completed = isCompleted ? 'opacity-40' : '';

            return `<div class="nav-item cursor-pointer py-2 pl-8 pr-4 text-sm flex justify-between items-center transition-colors ${active} ${completed}"
                        onclick="location.hash='#${e.id}'">
                      <span>${e.id} ${e.title}</span>
                      ${isCompleted ? ICONS.CHECK : ''}
                    </div>`;
        }).join('');

        return chapterHeader + chapterExercises;
    }).join('');
}

export function initSidebarToggle(
    sidebarToggle: HTMLElement | null,
    sidebarNav: HTMLElement | null
) {
    if (!sidebarToggle || !sidebarNav) return;

    sidebarToggle.innerHTML = ICONS.MENU;

    // Toggle button click
    sidebarToggle.addEventListener('click', () => {
        sidebarNav.classList.toggle('hidden');
        sidebarNav.classList.toggle('flex');
        sidebarNav.classList.toggle('lg:hidden');
        sidebarNav.classList.toggle('lg:flex');
    });

    // Close logic when clicking outside on mobile
    document.addEventListener('click', (e) => {
        const isMobileOpen = !sidebarNav.classList.contains('hidden');
        const isMobile = window.innerWidth < 1024;

        if (isMobile && isMobileOpen) {
            const target = e.target as HTMLElement;
            const clickedInside = sidebarNav.contains(target);
            const clickedToggle = sidebarToggle.contains(target);

            if (!clickedInside && !clickedToggle) {
                sidebarNav.classList.toggle('hidden');
                sidebarNav.classList.toggle('flex');
                sidebarNav.classList.toggle('lg:hidden');
                sidebarNav.classList.toggle('lg:flex');
            }
        }
    });
}
