//src/main.ts
import './input.css';
import { store } from './core/store';
import { exercises, curriculum } from './exercises/exercise-registry';
import { getExerciseVariant } from './core/types';
import { initEditor, getCode, updateEditorTheme } from './core/editor';
import { configureMarkdown, parseMarkdown, highlightStaticBlocks } from './core/markdown';

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
import { renderLanguageSelector } from './ui/languageSelector';
import { getLanguageMetadata, getLanguageSyntax } from './languages/language-registry';

//initialisation
initBranding();
initShortcuts();
initResetProgress();
renderFooter();
configureMarkdown();

const switchTab = initTabs(
    elements.tabs.problem,
    elements.tabs.code,
    elements.description.mobile,
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

function render() {
    const { currentExerciseId, currentLanguageId, completedIds } = store.getState();

    const prevExerciseId = lastRenderedExerciseId;
    const prevLanguageId = lastRenderedLanguageId;

    const isExerciseChanged = prevExerciseId !== null && currentExerciseId !== prevExerciseId;
    const isLanguageChanged = prevLanguageId !== null && currentLanguageId !== prevLanguageId;

    // Update tracking variables before any state mutation that triggers subscribers
    lastRenderedExerciseId = currentExerciseId;
    lastRenderedLanguageId = currentLanguageId;

    //if language or exercise changed, save state for previous config
    if ((isExerciseChanged || isLanguageChanged) && prevExerciseId && prevLanguageId) {
        const currentCode = getCode();
        if (currentCode) {
            store.getState().saveUserCode(prevExerciseId, prevLanguageId, currentCode);
        }
    }

    const currentEx = exercises.find(e => e.id === currentExerciseId);

    if (!currentEx) return;

    const exerciseVariant = getExerciseVariant(currentEx, currentLanguageId);

    //render description
    const descHtml = parseMarkdown(currentEx.description);
    const titleHtml = `<h1 class="text-3xl font-bold mb-6 text-fg-primary">${currentEx.id} ${currentEx.title}</h1>`;
    const fullContent = titleHtml + descHtml;

    if (elements.description.desktop) elements.description.desktop.innerHTML = fullContent;
    if (elements.description.mobile) elements.description.mobile.innerHTML = fullContent;

    //update nav
    if (navActions) navActions.updateNavState(currentExerciseId);

    //highlight static blocks
    highlightStaticBlocks();

    //sidebar & progress
    renderSidebar(elements.sidebar.list, curriculum, currentExerciseId, completedIds);
    renderProgressBar(elements.progressContainer, curriculum, currentExerciseId, completedIds);

    //language selector
    renderLanguageSelector(elements.languageSelectorContainer, currentEx);

    const syntaxExtension = getLanguageSyntax(currentLanguageId);

    //initialize editor with user code
    const editorText = store.getState().getUserCode(currentExerciseId, currentLanguageId) || exerciseVariant.initialCode;
    initEditor(editorText, syntaxExtension, () => {
        store.getState().saveUserCode(currentExerciseId, currentLanguageId, getCode());
        showPopup('Saved!');
    });

    //reset console on exercise or language switch
    if (isExerciseChanged || isLanguageChanged) {
        elements.console.textContent = "// Ready...";
    }
}


//event listeners
store.subscribe(render);

//run button
elements.runBtn.addEventListener('click', () => runner.run());

//reset button
if (elements.resetBtn) {
    resetEditorText(elements.resetBtn, ICONS.TRASH, () => {
        const { currentExerciseId, currentLanguageId } = store.getState();
        const currentEx = exercises.find(e => e.id === currentExerciseId);
        if (!currentEx) return;
        const exerciseVariant = getExerciseVariant(currentEx, currentLanguageId);
        store.getState().saveUserCode(currentExerciseId, currentLanguageId, exerciseVariant.initialCode);
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
runner.waitForCompiler(); // Starts polling for compiler readiness

const initialId = window.location.hash.slice(1) || exercises[0].id;
store.getState().setCurrent(initialId);

//initial render
render();
