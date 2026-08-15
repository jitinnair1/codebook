import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { EditorState, Compartment, Extension } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion, acceptCompletion } from '@codemirror/autocomplete';
import { vim } from '@replit/codemirror-vim';
import { themeCompartment, getTheme } from '../ui/theme';
import { showPopup } from '../ui/popup';
import { store } from './store';

let view: EditorView | null = null;
let tabCount = 0;
let lastTabTime = 0;
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let onSaveCallback: (() => void) | undefined;
let isProgrammaticChange = false;
let activeExerciseId: string | null = null;
let activeLanguageId: string | null = null;

//JN: since Codemirror's editor state and config are immutable by design, we use compartments to update
//the language syntax and theme. Compartments are dynamic slots for extensions (like syntax highlighting 
//or theme) used to swap the configs dynamically.
export const languageCompartment = new Compartment();
export const vimCompartment = new Compartment();

export function updateEditorLanguage(syntaxExtension?: Extension) {
    if (view) {
        view.dispatch({
            effects: languageCompartment.reconfigure(syntaxExtension || [])
        });
    }
}

export function updateEditorVimMode(enabled: boolean) {
    if (view) {
        view.dispatch({
            effects: vimCompartment.reconfigure(enabled ? vim() : [])
        });
    }
}

export function updateEditorTheme(isDark: boolean) {
    if (view) {
        view.dispatch({
            effects: themeCompartment.reconfigure(getTheme(isDark))
        });
    }
}

// Safely updates editor content without triggering auto-save
function setDocText(code: string) {
    if (!view) return;
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
    }
    const currentText = view.state.doc.toString();
    if (currentText === code) return;

    isProgrammaticChange = true;
    try {
        view.dispatch({
            changes: { from: 0, to: currentText.length, insert: code }
        });
    } finally {
        isProgrammaticChange = false;
    }
}

export function setEditorCode(code: string) {
    setDocText(code);
}

export function getCode(): string {
    return view ? view.state.doc.toString() : "";
}

// Immediately flushes pending edits to the store for the active exercise/language
export function flushAutoSave(targetExerciseId?: string, targetLanguageId?: string) {
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
    }
    if (view) {
        const { currentExerciseId, currentLanguageId } = store.getState();
        const exId = targetExerciseId ?? activeExerciseId ?? currentExerciseId;
        const langId = targetLanguageId ?? activeLanguageId ?? currentLanguageId;
        if (exId && langId) {
            store.getState().saveUserCode(exId, langId, view.state.doc.toString());
        }
    }
}

function scheduleAutoSave() {
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    autoSaveTimeout = setTimeout(() => {
        autoSaveTimeout = null;
        flushAutoSave();
    }, 300);
}

// Loads code and syntax for an exercise, automatically flushing prior edits
export function loadExerciseCode(
    exerciseId: string,
    languageId: string,
    code: string,
    syntaxExtension?: Extension,
    onSave?: () => void
) {
    onSaveCallback = onSave;

    // Flush any pending unsaved changes from the previous exercise/language context
    if (autoSaveTimeout && activeExerciseId && activeLanguageId && (activeExerciseId !== exerciseId || activeLanguageId !== languageId)) {
        const prevEx = activeExerciseId;
        const prevLang = activeLanguageId;
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
        if (view) {
            store.getState().saveUserCode(prevEx, prevLang, view.state.doc.toString());
        }
    }

    activeExerciseId = exerciseId;
    activeLanguageId = languageId;

    const editorEl = document.getElementById('editor');
    if (!editorEl) return;

    if (!view) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isVim = store.getState().vimMode;

        const state = EditorState.create({
            doc: code,
            extensions: [
                vimCompartment.of(isVim ? vim() : []),
                basicSetup,
                autocompletion(),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !isProgrammaticChange) {
                        scheduleAutoSave();
                    }
                }),
                keymap.of([
                    { key: "Tab", run: acceptCompletion },

                    // If user presses tab 3 times, show a toast indicating they can focus out with Esc + Tab
                    {
                        key: "Tab",
                        run: () => {
                            const now = Date.now();
                            if (now - lastTabTime > 2000) {
                                tabCount = 0;
                            }
                            tabCount++;
                            lastTabTime = now;

                            if (tabCount >= 3) {
                                showPopup('Press Esc + Tab to move focus out of editor', 3000);
                                tabCount = 0;
                            }
                            return false;
                        }
                    },
                    ...defaultKeymap,
                    indentWithTab,
                    {
                        key: "Mod-s",
                        run: () => {
                            flushAutoSave();
                            if (onSaveCallback) {
                                onSaveCallback();
                            } else {
                                showPopup('Saved!');
                            }
                            return true;
                        },
                        preventDefault: true
                    }
                ]),
                languageCompartment.of(syntaxExtension || []),
                themeCompartment.of(getTheme(isDark)),
                EditorView.lineWrapping,
                EditorView.theme({
                    "&": { height: "100%", backgroundColor: "var(--bg-app)", color: "var(--fg-primary)" },
                    ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-mono)" },
                }),
                //adding domEventHandlers here ensure the Tab is not overriden by the indentWithTab
                EditorView.domEventHandlers({
                    keydown: (event) => {
                        if (event.key !== 'Tab') {
                            tabCount = 0;
                        }
                    },
                    mousedown: () => {
                        tabCount = 0;
                    }
                })
            ]
        });

        view = new EditorView({
            state,
            parent: editorEl
        });
    } else {
        updateEditorLanguage(syntaxExtension);
        updateEditorVimMode(store.getState().vimMode);
        setDocText(code);
    }
}

// Backward-compatible alias for initEditor
export function initEditor(
    initialCode: string,
    syntaxExtension?: Extension,
    onSave?: () => void,
    _forceCodeUpdate = true,
    exerciseId?: string,
    languageId?: string
) {
    const { currentExerciseId, currentLanguageId } = store.getState();
    const exId = exerciseId || currentExerciseId;
    const langId = languageId || currentLanguageId;
    loadExerciseCode(exId, langId, initialCode, syntaxExtension, onSave);
}

