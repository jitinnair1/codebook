import { elements } from '../core/elements';
import { store } from '../core/store';
import { switchEditorTab, getActiveEditorTab } from '../core/editor';
import { getLanguageMetadata } from '../languages/language-registry';

let lastRenderedExerciseId: string | null = null;
let lastRenderedLanguageId: string | null = null;
let lastRenderedActiveTab: 'code' | 'test' | null = null;
let lastRenderedIsModified: boolean | null = null;

export function initEditorTabs() {
  renderEditorTabs();
}

export function renderEditorTabs() {
  const container = elements.editorTabs?.container;
  if (!container) return;

  const state = store.getState();
  const currentExId = state.currentExerciseId;
  const currentLangId = state.currentLanguageId;
  const activeTab = state.activeEditorTab || getActiveEditorTab() || 'code';

  const userTest = state.getUserTestCode(currentExId, currentLangId);
  const isTestModified = userTest !== undefined;

  // Avoid unnecessary DOM rebuilds if nothing visual changed
  if (
    currentExId === lastRenderedExerciseId &&
    currentLangId === lastRenderedLanguageId &&
    activeTab === lastRenderedActiveTab &&
    isTestModified === lastRenderedIsModified
  ) {
    return;
  }

  lastRenderedExerciseId = currentExId;
  lastRenderedLanguageId = currentLangId;
  lastRenderedActiveTab = activeTab;
  lastRenderedIsModified = isTestModified;

  const meta = getLanguageMetadata(currentLangId);
  const ext = meta?.extension || '.ts';

  const codeFilename = `solution${ext}`;
  const testFilename = `test${ext}`;

  const baseClasses = "group relative flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition-all cursor-pointer select-none shrink-0 border";
  const activeClasses = "bg-bg-app border-border-default text-fg-primary font-semibold shadow-xs";
  const inactiveClasses = "bg-transparent border-border-default/50 hover:border-border-default hover:bg-bg-app/60 text-fg-muted hover:text-fg-primary";

  const isCodeActive = activeTab === 'code';
  const isTestActive = activeTab === 'test';

  container.innerHTML = `
    <button type="button" id="tab-editor-code"
      class="editor-tab-item ${baseClasses} ${isCodeActive ? activeClasses : inactiveClasses}"
      title="Solution code (${codeFilename})">
      <span>${codeFilename}</span>
    </button>
    <button type="button" id="tab-editor-test"
      class="editor-tab-item ${baseClasses} ${isTestActive ? activeClasses : inactiveClasses}"
      title="Test suite (${testFilename})">
      ${isTestModified ? '<span class="w-1.5 h-1.5 rounded-full bg-brand shrink-0" title="Modified test suite"></span>' : ''}
      <span>${testFilename}</span>
    </button>
  `;

  const codeTabBtn = container.querySelector('#tab-editor-code');
  const testTabBtn = container.querySelector('#tab-editor-test');

  codeTabBtn?.addEventListener('click', () => {
    switchEditorTab('code');
    renderEditorTabs();
  });

  testTabBtn?.addEventListener('click', () => {
    switchEditorTab('test');
    renderEditorTabs();
  });
}
