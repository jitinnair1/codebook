import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { EditorState, Compartment, Extension } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion, acceptCompletion } from '@codemirror/autocomplete';
import { themeCompartment, getTheme } from '../ui/theme';
import { showPopup } from '../ui/popup';

let view: EditorView | null = null;
let tabCount = 0;
let lastTabTime = 0;

//JN: since Codemirror's editor state and config are immutable by design, we use compartments to update
//the language syntax and theme. Compartments are dynamic slots for extensions (like syntax highlighting 
//or theme) used to swap the configs dynamically.
export const languageCompartment = new Compartment();

export function updateEditorLanguage(syntaxExtension?: Extension) {
    if (view) {
        view.dispatch({
            effects: languageCompartment.reconfigure(syntaxExtension || [])
        });
    }
}

export function initEditor(initialCode: string, syntaxExtension?: Extension, onSave?: () => void) {
    const editorEl = document.getElementById('editor');
    if (!editorEl) return;

    if (!view) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        const state = EditorState.create({
            doc: initialCode,
            extensions: [
                basicSetup,
                autocompletion(),
                keymap.of([
                    { key: "Tab", run: acceptCompletion },

                    //if user presses tab 3 times, show a toast indicating
                    //that they can focus out with Esc + Tab
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

                    //allow tab indents
                    indentWithTab,

                    //enable save with Ctrl/Cmd + S
                    {
                        key: "Mod-s",
                        run: () => {
                            if (onSave) onSave();
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
        const currentCode = view.state.doc.toString();
        if (currentCode !== initialCode) {
            view.dispatch({
                changes: { from: 0, to: currentCode.length, insert: initialCode }
            });
        }
    }
}

export function updateEditorTheme(isDark: boolean) {
    if (view) {
        view.dispatch({
            effects: themeCompartment.reconfigure(getTheme(isDark))
        });
    }
}

export function getCode(): string {
    return view ? view.state.doc.toString() : "";
}
