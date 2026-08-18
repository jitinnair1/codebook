import { Chapter } from '../core/types';
import { ICONS } from './icons';

export function renderProgressBar(
    container: HTMLElement | null,
    curriculum: Chapter[],
    currentExerciseId: string,
    completedIds: string[]
) {
    if (!container) return;

    const currentChapter = curriculum.find(c => c.exercises.some(e => e.id === currentExerciseId));
    if (currentChapter) {
        const total = currentChapter.exercises.length;
        const nextUncompletedIndex = currentChapter.exercises.findIndex(e => !completedIds.includes(e.id));

        container.innerHTML = currentChapter.exercises.map((e, idx) => {
            const isCompleted = completedIds.includes(e.id);
            const isNext = idx === nextUncompletedIndex;
            const isLast = idx === total - 1;
            const isActive = e.id === currentExerciseId;

            //circle style
            let circleClass = 'border border-border-default bg-bg-surface';
            let content = '';

            if (isNext) {
                circleClass = 'border border-brand bg-bg-surface';
            }

            if (isCompleted) {
                circleClass = 'border border-brand bg-brand';
                content = ICONS.WHITE_CHECK;
            }

            if (isActive) {
                const baseBg = isCompleted ? 'bg-brand' : 'bg-bg-surface';
                circleClass = `border border-brand ${baseBg} shadow-[0_0_6px_3px_color-mix(in_srgb,var(--color-brand)_30%,transparent)]`;
            }

            //connection logic
            let line = '';
            if (!isLast) {
                const lineClass = isCompleted ? 'bg-brand' : 'bg-border-default opacity-50';
                line = `<div class="w-8 h-0.5 mx-0.5 rounded ${lineClass}"></div>`;
            }

            return `
                <div class="relative flex items-center group cursor-pointer" onclick="location.hash='#${e.id}'" title="${e.title}">
                    <div class="w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${circleClass}">
                        ${content}
                    </div>
                    ${line}
                    <!-- tooltip on hover -->
                    <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-bg-surface border border-border-default px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-20 pointer-events-none">
                        ${e.title}
                    </div>
                </div>
            `;
        }).join('');
    }
}
