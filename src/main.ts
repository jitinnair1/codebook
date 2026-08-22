import './input.css';
import { store, ensureSettingsDecrypted } from './core/store';
import { initStartupSync } from './core/sync/syncManager';
import { exercises, curriculum, getExerciseDisplayNumber } from './exercises/exercise-registry';
import { getExerciseVariant } from './core/types';
import { loadExerciseCode, setEditorCode, updateEditorTheme } from './core/editor';
import { parseMarkdown, highlightStaticBlocks, escapeHtml } from './core/markdown';

//module imports
import { elements } from './core/elements';
import { runner } from './core/runner';

//ui
import { ICONS } from './ui/icons';
import { status } from './ui/status';
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
import { getLanguageExtension, prewarmBackgroundLanguages, loadLanguageRunner } from './languages/language-registry';

//freeze fetch to prevent monkey-patching by injected scripts 
Object.defineProperty(window, 'fetch', { value: window.fetch, writable: false, configurable: false });

//initialisation
initBranding();
initShortcuts();
initSettings();
initChatPanel();
initResetProgress();
renderFooter();

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
let lastRenderedUserCode: string | null = null;

function render() {
    const { activeLessonSlug, currentLanguageId, completedSlugs } = store.getState();

    const prevExerciseId = lastRenderedExerciseId;
    const prevLanguageId = lastRenderedLanguageId;
    const prevUserCode = lastRenderedUserCode;

    const currentEx = exercises.find(e => e.id === activeLessonSlug);
    if (!currentEx) return;

    const exerciseVariant = getExerciseVariant(currentEx, currentLanguageId);
    const currentUserCode = store.getState().getUserCode(activeLessonSlug, currentLanguageId) || exerciseVariant.initialCode;

    const isInitial = prevExerciseId === null || prevLanguageId === null;
    const isExerciseChanged = prevExerciseId !== null && activeLessonSlug !== prevExerciseId;
    const isLanguageChanged = prevLanguageId !== null && currentLanguageId !== prevLanguageId;
    const isCompletedChanged = completedSlugs.length !== lastRenderedCompletedIds.length ||
        completedSlugs.some((id, idx) => id !== lastRenderedCompletedIds[idx]);
    const isUserCodeChanged = prevUserCode !== null && currentUserCode !== prevUserCode;

    //render only on key changes and not when say chat responses are streaming in
    if (!isInitial && !isExerciseChanged && !isLanguageChanged && !isCompletedChanged && !isUserCodeChanged) {
        return;
    }

    lastRenderedExerciseId = activeLessonSlug;
    lastRenderedLanguageId = currentLanguageId;
    lastRenderedCompletedIds = [...completedSlugs];
    lastRenderedUserCode = currentUserCode;

    // If exercise or language changed (or initial load), update problem statement, language selector and editor
    if (isInitial || isExerciseChanged || isLanguageChanged) {
        //render description
        const descHtml = parseMarkdown(currentEx.description);
        const displayNum = getExerciseDisplayNumber(currentEx.id);
        const headerTitle = displayNum ? `${displayNum} ${currentEx.title}` : currentEx.title;
        const titleHtml = `<h1 class="text-3xl font-bold mb-6 text-fg-primary">${escapeHtml(headerTitle)}</h1>`;
        const fullContent = titleHtml + descHtml;

        if (elements.description.desktop) elements.description.desktop.innerHTML = fullContent;

        //update nav
        if (navActions) navActions.updateNavState(activeLessonSlug);

        //highlight static blocks
        highlightStaticBlocks();

        //language selector
        renderLanguageSelector(elements.languageSelectorContainer, currentEx);
        const languageExtension = getLanguageExtension(currentLanguageId);

        //initialize editor with user code (loadExerciseCode automatically saves prior context)
        loadExerciseCode(activeLessonSlug, currentLanguageId, currentUserCode, languageExtension, () => {
            showPopup('Saved!');
        });

        //reset console and status on exercise or language switch
        if (isExerciseChanged || isLanguageChanged) {
            elements.console.textContent = "// Ready...";
            status.setReady();
        }
    } else if (isUserCodeChanged) {
        // In-place update of editor code when store changes externally (e.g. backup restore or Gist pull)
        setEditorCode(currentUserCode);
    }

    //sidebar & progress (updates on exercise switch or completion changes)
    renderSidebar(elements.sidebar.list, curriculum, activeLessonSlug, completedSlugs);
    renderProgressBar(elements.progressContainer, curriculum, activeLessonSlug, completedSlugs);
}


//event listeners
store.subscribe(render);

//run button
elements.runBtn.addEventListener('click', () => runner.run());

//reset button
if (elements.resetBtn) {
    resetEditorText(elements.resetBtn, ICONS.TRASH, () => {
        const { activeLessonSlug, currentLanguageId } = store.getState();
        const currentEx = exercises.find(e => e.id === activeLessonSlug);
        if (!currentEx) return;
        const exerciseVariant = getExerciseVariant(currentEx, currentLanguageId);
        setEditorCode(exerciseVariant.initialCode);
        store.getState().saveUserCode(activeLessonSlug, currentLanguageId, exerciseVariant.initialCode);
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
runner.init();

//setup initial state
const hashId = window.location.hash.slice(1);
const storedExerciseId = store.getState().activeLessonSlug;

if (hashId && exercises.some(e => e.id === hashId)) {
    store.getState().setCurrent(hashId);
} else if (storedExerciseId && exercises.some(e => e.id === storedExerciseId)) {
    window.location.hash = `#${storedExerciseId}`;
} else if (exercises.length > 0) {
    store.getState().setCurrent(exercises[0].id);
    window.location.hash = `#${exercises[0].id}`;
}

//initial render
render();

//kick off background credential decryption and startup sync (non-blocking)
ensureSettingsDecrypted(store)
    .then(() => initStartupSync())
    .catch((err) => {
        console.warn('[main] Startup decryption or sync check failed:', err);
    });

//immediately boot the active language runner
const activeLangId = store.getState().currentLanguageId;
if (activeLangId) {
    loadLanguageRunner(activeLangId)
        .then(async (activeRunnerInstance) => {
            // Stage 1: Wait until the active runner is 100% ready before pre-warming other languages
            if (activeRunnerInstance.whenReady) {
                await activeRunnerInstance.whenReady();
            } else {
                await activeRunnerInstance.isReady();
            }

            // Stage 2: Pre-warm remaining enabled languages sequentially in browser idle time
            const scheduleBackgroundPrewarm = () => {
                const currentLang = store.getState().currentLanguageId;
                prewarmBackgroundLanguages(currentLang).catch(() => { });
            };

            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(scheduleBackgroundPrewarm, { timeout: 8000 });
            } else {
                setTimeout(scheduleBackgroundPrewarm, 2000);
            }
        })
        .catch((err) => {
            console.error(`[main] Failed to load active language runner '${activeLangId}':`, err);
        });
}

