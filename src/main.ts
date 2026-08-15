//src/main.ts
import './input.css';
import { store } from './core/store';
import { exercises, curriculum } from './exercises/exercise-registry';
import { getExerciseVariant } from './core/types';
import { loadExerciseCode, setEditorCode, updateEditorTheme } from './core/editor';
import { configureMarkdown, parseMarkdown, highlightStaticBlocks, escapeHtml } from './core/markdown';

//module imports
import { elements } from './core/elements';
import { runner } from './core/runner';

//ui
import { ICONS } from './ui/icons';
import { showPopup } from './ui/popup';
import { initBranding } from './ui/branding';
import { renderSidebar, initSidebarToggle } from './ui/sidebar';
import { renderProgressBar } from './ui/progressBar';
import { setupResize } from './ui/resize';
import { initTabs } from './ui/tabs';
import { initNavigation } from './ui/navigation';
import { resetEditorText } from './ui/resetEditorText';
import { renderFooter } from './ui/footer';
import { initShortcuts } from './ui/shortcuts';
import { initResetProgress } from './ui/resetProgress';
import { initSettings } from './ui/settings';
import { initChatPanel } from './ui/chatPanel';
import { renderLanguageSelector } from './ui/languageSelector';
import { getLanguageSyntax, prewarmBackgroundLanguages, loadLanguageRunner } from './languages/language-registry';

// Freeze fetch to prevent monkey-patching by injected scripts (API key exfiltration defense)
Object.defineProperty(window, 'fetch', { value: window.fetch, writable: false, configurable: false });

//initialisation
initBranding();
initShortcuts();
initSettings();
initChatPanel();
initResetProgress();
renderFooter();
configureMarkdown();

//load speedrun modal only in dev environments
if (import.meta.env.DEV) {
    import('./ui/speedrunModal').then(m => m.initSpeedrunButton());
}

const switchTab = initTabs(
    elements.tabs.problem,
    elements.tabs.code,
    elements.problemAndChatPanel,
    elements.editorConsolePanel
);

const navActions = initNavigation(
    elements.nav.prev,
    elements.nav.next,
    store,
    switchTab
);

initSidebarToggle(elements.sidebar.toggle, elements.sidebar.nav);

//theme
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    updateEditorTheme(e.matches);
    render();
});

//render
let lastRenderedExerciseId: string | null = null;
let lastRenderedLanguageId: string | null = null;
let lastRenderedCompletedIds: string[] = [];

function render() {
    const { currentExerciseId, currentLanguageId, completedIds } = store.getState();

    const prevExerciseId = lastRenderedExerciseId;
    const prevLanguageId = lastRenderedLanguageId;

    const isInitial = prevExerciseId === null || prevLanguageId === null;
    const isExerciseChanged = prevExerciseId !== null && currentExerciseId !== prevExerciseId;
    const isLanguageChanged = prevLanguageId !== null && currentLanguageId !== prevLanguageId;
    const isCompletedChanged = completedIds.length !== lastRenderedCompletedIds.length ||
        completedIds.some((id, idx) => id !== lastRenderedCompletedIds[idx]);

    // If nothing relevant to the main view changed (e.g. chat messages or settings), avoid re-rendering or touching editor
    if (!isInitial && !isExerciseChanged && !isLanguageChanged && !isCompletedChanged) {
        return;
    }

    lastRenderedExerciseId = currentExerciseId;
    lastRenderedLanguageId = currentLanguageId;
    lastRenderedCompletedIds = [...completedIds];

    const currentEx = exercises.find(e => e.id === currentExerciseId);

    if (!currentEx) return;

    const exerciseVariant = getExerciseVariant(currentEx, currentLanguageId);

    // If exercise or language changed (or initial load), update problem statement, language selector and editor
    if (isInitial || isExerciseChanged || isLanguageChanged) {
        //render description
        const descHtml = parseMarkdown(currentEx.description);
        const titleHtml = `<h1 class="text-3xl font-bold mb-6 text-fg-primary">${escapeHtml(currentEx.id)} ${escapeHtml(currentEx.title)}</h1>`;
        const fullContent = titleHtml + descHtml;

        if (elements.description.desktop) elements.description.desktop.innerHTML = fullContent;
        if (elements.description.mobile) elements.description.mobile.innerHTML = fullContent;

        //update nav
        if (navActions) navActions.updateNavState(currentExerciseId);

        //highlight static blocks
        highlightStaticBlocks();

        //language selector
        renderLanguageSelector(elements.languageSelectorContainer, currentEx);

        const syntaxExtension = getLanguageSyntax(currentLanguageId);

        //initialize editor with user code (loadExerciseCode automatically saves prior context)
        const editorText = store.getState().getUserCode(currentExerciseId, currentLanguageId) || exerciseVariant.initialCode;
        loadExerciseCode(currentExerciseId, currentLanguageId, editorText, syntaxExtension, () => {
            showPopup('Saved!');
        });

        //reset console on exercise or language switch
        if (isExerciseChanged || isLanguageChanged) {
            elements.console.textContent = "// Ready...";
        }
    }

    //sidebar & progress (updates on exercise switch or completion changes)
    renderSidebar(elements.sidebar.list, curriculum, currentExerciseId, completedIds);
    renderProgressBar(elements.progressContainer, curriculum, currentExerciseId, completedIds);
}


//event listeners
store.subscribe(render);

if ((store as any).persist?.onFinishHydration) {
    (store as any).persist.onFinishHydration(() => {
        lastRenderedExerciseId = null;
        lastRenderedLanguageId = null;
        render();
    });
}

//run button
elements.runBtn.addEventListener('click', () => runner.run());

//reset button
if (elements.resetBtn) {
    resetEditorText(elements.resetBtn, ICONS.TRASH, () => {
        const { currentExerciseId, currentLanguageId } = store.getState();
        const currentEx = exercises.find(e => e.id === currentExerciseId);
        if (!currentEx) return;
        const exerciseVariant = getExerciseVariant(currentEx, currentLanguageId);
        setEditorCode(exerciseVariant.initialCode);
        store.getState().saveUserCode(currentExerciseId, currentLanguageId, exerciseVariant.initialCode);
        showPopup('Reset to starter code');
    });
}

//clear console
if (elements.clearConsoleBtn) {
    elements.clearConsoleBtn.innerHTML = ICONS.TRASH;
    elements.clearConsoleBtn.addEventListener('click', () => {
        if (elements.console) elements.console.textContent = "";
    });
}

//routing
if (elements.branding.brandLink) {
    elements.branding.brandLink.addEventListener('click', (e) => {
        e.preventDefault();
        const firstExId = exercises[0]?.id;
        if (firstExId) {
            window.location.hash = `#${firstExId}`;
            store.getState().setCurrent(firstExId);
        }
    });
}

window.addEventListener('hashchange', () => {
    const id = window.location.hash.slice(1);
    if (exercises.find(e => e.id === id)) {
        store.getState().setCurrent(id);
    } else if (!id && exercises.length > 0) {
        store.getState().setCurrent(exercises[0].id);
    }
});

//resize logic
setupResize(elements.resize.dragHDesktop, elements.resize.paneProblem, 'horizontal');
setupResize(elements.resize.dragVConsole, elements.resize.paneConsole, 'vertical', true);


//startup
runner.init(); // Subscribes to runtime status updates

const initialId = window.location.hash.slice(1) || exercises[0].id;
store.getState().setCurrent(initialId);

//initial render
render();

//immediately boot the active language runner
const activeLangId = store.getState().currentLanguageId;
if (activeLangId) {
    loadLanguageRunner(activeLangId).catch((err) => {
        console.error(`[main] Failed to load active language runner '${activeLangId}':`, err);
    });
}

//pre-warm remaining enabled languages in browser idle time
const scheduleBackgroundPrewarm = () => {
    const currentLang = store.getState().currentLanguageId;
    prewarmBackgroundLanguages(currentLang).catch(() => { });
};

if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(scheduleBackgroundPrewarm, { timeout: 4000 });
} else {
    //for broswers that dont support requestIdleCallback
    setTimeout(scheduleBackgroundPrewarm, 1200);
}

