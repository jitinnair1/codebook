export function initTabs(
    tabProblem: HTMLElement | null,
    tabCode: HTMLElement | null,
    problemPanel: HTMLElement | null,
    editorConsolePanel: HTMLElement | null
) {
    if (!tabProblem || !tabCode || !problemPanel || !editorConsolePanel) return (t: 'problem' | 'code') => { };

    function switchTab(tab: 'problem' | 'code') {
        if (tab === 'problem') {
            problemPanel!.classList.remove('hidden');
            problemPanel!.classList.add('flex');
            editorConsolePanel!.classList.add('hidden');
            editorConsolePanel!.classList.remove('flex');

            tabProblem!.classList.add('text-fg-primary', 'border-brand');
            tabProblem!.classList.remove('text-fg-muted', 'border-transparent');
            tabCode!.classList.add('text-fg-muted', 'border-transparent');
            tabCode!.classList.remove('text-fg-primary', 'border-brand');
        } else {
            problemPanel!.classList.add('hidden');
            problemPanel!.classList.remove('flex');
            editorConsolePanel!.classList.remove('hidden');
            editorConsolePanel!.classList.add('flex');

            tabCode!.classList.add('text-fg-primary', 'border-brand');
            tabCode!.classList.remove('text-fg-muted', 'border-transparent');
            tabProblem!.classList.add('text-fg-muted', 'border-transparent');
            tabProblem!.classList.remove('text-fg-primary', 'border-brand');
        }
    }

    tabProblem.addEventListener('click', () => switchTab('problem'));
    tabCode.addEventListener('click', () => switchTab('code'));

    return switchTab;
}
