import { Marked } from 'marked';
import DOMPurify, { type Config } from 'dompurify';
import { EditorView } from 'codemirror';
import { EditorState, Extension } from '@codemirror/state';
import { getTheme } from '../ui/theme';
import { getLanguageSyntax, defaultLanguageId } from '../languages/language-registry';

// DOMPurify configuration: allow safe formatting tags, block scripts/iframes/forms/event handlers
const PURIFY_CONFIG: Config = {
    ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'a', 'img',
        'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sub', 'sup', 'mark',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span',
        'details', 'summary',
        'button',  // for copy-code buttons rendered by chatMarked
    ],
    ALLOWED_ATTR: [
        'href', 'target', 'rel', 'title', 'alt', 'src', 'loading',
        'class', 'id', 'type',
        'data-lang', 'data-chip-id',  // custom data attributes used by the app
    ],
    ALLOW_DATA_ATTR: false,  // block arbitrary data-* attributes except those explicitly listed
};

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function isSafeUrl(url: string): boolean {
    if (!url) return false;
    const trimmed = url.trim().toLowerCase();
    // Allow safe absolute web and email protocols
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('mailto:')) {
        return true;
    }
    // Allow safe in-page anchor links and relative paths (blocking protocol-relative //)
    if (trimmed.startsWith('#') || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
        return true;
    }
    // Reject javascript:, data:, vbscript:, file:, and other unsafe pseudo-protocols
    return false;
}

const safeLinkRenderer = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
    const safeHref = isSafeUrl(href) ? href : '#';
    const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://');
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeHtml(safeHref)}"${titleAttr}${targetAttr} class="text-brand underline hover:opacity-80">${text}</a>`;
};

const safeImageRenderer = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
    const safeHref = isSafeUrl(href) ? href : '';
    if (!safeHref) return escapeHtml(text || '');
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${escapeHtml(safeHref)}" alt="${escapeHtml(text || '')}"${titleAttr} class="max-w-full rounded-md my-2" loading="lazy" />`;
};

const descMarked = new Marked({
    renderer: {
        code({ text, lang }: { text: string; lang?: string }) {
            return `<div class="cm-static-code mb-4" data-lang="${lang || ''}">${escapeHtml(text)}</div>`;
        },
        link: safeLinkRenderer,
        html({ text }: { text: string }) {
            return escapeHtml(text);
        },
        image: safeImageRenderer,
    }
});

const chatMarked = new Marked({
    renderer: {
        code({ text, lang }: { text: string; lang?: string }) {
            const langClass = lang ? ` language-${escapeHtml(lang)}` : '';
            const cleanCode = escapeHtml(text.trim());
            return `
<div class="code-block-container not-prose my-2 rounded-md overflow-hidden border border-border-default bg-bg-app text-left">
    <div class="flex items-center justify-between px-2.5 py-1 bg-bg-surface/90 border-b border-border-default text-[10px] text-fg-muted font-mono select-none">
        <span>${escapeHtml(lang || 'code')}</span>
        <button type="button" class="chat-copy-code-btn hover:text-fg-primary cursor-pointer transition-colors text-[10px] flex items-center gap-1 font-sans" title="Copy code safely">
            <span>Copy</span>
        </button>
    </div>
    <pre class="px-3 py-2 max-h-60 overflow-auto text-xs leading-snug font-mono m-0 bg-transparent"><code class="${langClass}">${cleanCode}</code></pre>
</div>`;
        },
        link: safeLinkRenderer,
        html({ text }: { text: string }) {
            return escapeHtml(text);
        },
        image: safeImageRenderer,
    }
});

export function configureMarkdown() {
    // Configured via dedicated Marked instances
}

export const parseMarkdown = (text: string): string => {
    const raw = descMarked.parse(text) as string;
    return DOMPurify.sanitize(raw, PURIFY_CONFIG);
};

/**
 * Strips model reasoning and thought blocks (<thought>...</thought>, <think>...</think>),
 * including open in-progress streaming thought blocks.
 */
export function stripThoughtBlocks(text: string): string {
    if (!text) return '';
    return text
        // Remove closed thought / think tags and content
        .replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, '')
        // Remove open in-progress thought / think tags at stream tail
        .replace(/<(thought|think)>[\s\S]*$/gi, '')
        .trim();
}

export const parseChatMarkdown = (text: string): string => {
    const cleaned = stripThoughtBlocks(text);
    if (!cleaned) return '';
    const raw = chatMarked.parse(cleaned) as string;
    return DOMPurify.sanitize(raw, PURIFY_CONFIG);
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
