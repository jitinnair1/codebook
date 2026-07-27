//src/main.ts
import './input.css';
import { store } from './core/store';
import { exercises, curriculum } from './exercises/registry';
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

function render() {
    const { currentExerciseId, completedIds, userCode } = store.getState();
    const currentEx = exercises.find(e => e.id === currentExerciseId);

    if (!currentEx) return;

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

    //initialize editor with user code
    const editorText = userCode[currentExerciseId] || currentEx.initialCode;
    initEditor(editorText, () => {
        store.getState().saveUserCode(currentExerciseId, getCode());
        showPopup('Saved!');
    });

    //reset console on exercise switch
    if (currentExerciseId !== lastRenderedExerciseId) {
        elements.console.textContent = "// Ready...";
        lastRenderedExerciseId = currentExerciseId;
    }
}


//event listeners
store.subscribe(render);

//run button
elements.runBtn.addEventListener('click', () => runner.run());

//reset button
if (elements.resetBtn) {
    resetEditorText(elements.resetBtn, ICONS.TRASH, () => {
        const { currentExerciseId } = store.getState();
        const currentEx = exercises.find(e => e.id === currentExerciseId);
        if (!currentEx) return;
        store.getState().saveUserCode(currentExerciseId, currentEx.initialCode);
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
window.addEventListener('hashchange', () => {
    const id = window.location.hash.slice(1);
    if (exercises.find(e => e.id === id)) {
        store.getState().setCurrent(id);
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
