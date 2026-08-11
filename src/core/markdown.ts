import { marked } from 'marked';
import { EditorView } from 'codemirror';
import { EditorState, Extension } from '@codemirror/state';
import { getTheme } from '../ui/theme';
import { getLanguageSyntax, defaultLanguageId } from '../languages/language-registry';

export function configureMarkdown() {
    const renderer = {
        code({ text, lang }: { text: string; lang?: string }) {
            return `<div class="cm-static-code mb-4" data-lang="${lang || ''}">${text}</div>`;
        }
    };

    marked.use({ renderer: renderer as any });
}

export const parseMarkdown = (text: string) => {
    return marked.parse(text) as string;
};


//JN: Right now, codemirror essentially "injects" a read only editor in the markdown codeblocks using this
//function. So all codeblocks in the problem description are effectively read-only editors. Does this add
//an overhead as the number of code blocks across all exercises scales?
export function highlightStaticBlocks() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const blocks = document.querySelectorAll('.cm-static-code');
    blocks.forEach(block => {
        const text = block.textContent || "";
        const lang = block.getAttribute('data-lang');
        const targetLang = lang || defaultLanguageId;
        const syntaxExt: Extension | undefined = getLanguageSyntax(targetLang) || getLanguageSyntax(defaultLanguageId);

        block.textContent = "";

        new EditorView({
            state: EditorState.create({
                doc: text,
                extensions: [
                    EditorState.readOnly.of(true),
                    EditorView.editable.of(false),
                    getTheme(isDark),
                    ...(syntaxExt ? [syntaxExt] : []),
                    EditorView.lineWrapping,
                    EditorView.theme({
                        "&": { borderRadius: "4px", overflow: "hidden", backgroundColor: "var(--bg-app)" },
                        ".cm-scroller": { overflow: "visible" }
                    })
                ]
            }),
            parent: block as HTMLElement
        });
    });
}
