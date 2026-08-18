import harness from './harness.ml?raw';
import toplevelUrl from './toplevel.bc.js?url';
import { createWorkerHandler } from '../base-worker';
import type { DiagnosticItem } from '../types';

interface OCamlRuntime {
    run: (code: string) => { out: string; err: string; success: boolean };
}

function getOCamlRuntime(): OCamlRuntime | undefined {
    const fromSelf = (self as unknown as { ocaml?: OCamlRuntime }).ocaml;
    if (fromSelf && typeof fromSelf.run === 'function') return fromSelf;

    const fromGlobal = (globalThis as unknown as { ocaml?: OCamlRuntime }).ocaml;
    if (fromGlobal && typeof fromGlobal.run === 'function') return fromGlobal;

    return undefined;
}

function parseOCamlDiagnostics(errText: string, harnessLines: number): DiagnosticItem[] {
    if (!errText || !errText.trim()) return [];

    const diagnostics: DiagnosticItem[] = [];
    const regex = /(?:File "[^"]*", |Line |line )?line (\d+), characters (\d+)-(\d+):[\s\S]*?(Error|Warning[^\n:]*):\s*([\s\S]*?)(?=(?:File "[^"]*", |Line |line \d+, characters)|$)/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(errText)) !== null) {
        const rawLine = parseInt(match[1], 10) || 1;
        const colStart = parseInt(match[2], 10) || 0;
        const colEnd = parseInt(match[3], 10) || (colStart + 1);
        const kind = match[4].toLowerCase();
        const rawMessage = match[5].trim().replace(/\s+/g, ' ');

        let userLine = rawLine;
        if (harnessLines > 0 && userLine > harnessLines) {
            userLine = userLine - harnessLines;
        } else if (harnessLines > 0 && userLine <= harnessLines) {
            userLine = 1;
        }

        const severity: 'error' | 'warning' = kind.startsWith('warning') ? 'warning' : 'error';

        diagnostics.push({
            line: userLine,
            column: colStart + 1,
            endLine: userLine,
            endColumn: colEnd + 1,
            severity,
            message: rawMessage,
            source: 'ocaml'
        });
    }

    if (diagnostics.length === 0 && (errText.toLowerCase().includes('error') || errText.toLowerCase().includes('syntax'))) {
        diagnostics.push({
            line: 1,
            column: 1,
            severity: 'error',
            message: errText.trim().replace(/\s+/g, ' '),
            source: 'ocaml'
        });
    }

    return diagnostics;
}

createWorkerHandler({
    async init() {
        const response = await fetch(toplevelUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} fetching toplevel.bc.js`);
        }
        const script = await response.text();
        // Indirect eval: (0, eval)(...) runs in global scope in sloppy mode (required for `with()` statements in js_of_ocaml)
        (0, eval)(script);

        if (!getOCamlRuntime()) {
            throw new Error('OCaml compiler runtime (ocaml.run) was not found after script execution');
        }
    },

    execute(userCode: string, testCode: string = '') {
        const ocaml = getOCamlRuntime();

        if (!ocaml || !ocaml.run) {
            return {
                success: false,
                output: '',
                error: 'OCaml compiler not initialized in worker'
            };
        }

        const combinedCode = harness + '\n' + userCode + '\n' + testCode + ';;';

        try {
            const result = ocaml.run(combinedCode);
            const cleanOutput = (result.out || '').replace(/module Tests :[\s\S]*?end\n/g, '');

            return {
                success: Boolean(result.success),
                output: cleanOutput,
                error: result.err || ''
            };
        } catch (err: any) {
            return {
                success: false,
                output: '',
                error: err?.message || String(err)
            };
        }
    },

    lint(code: string): DiagnosticItem[] {
        if (!code.trim()) return [];
        const ocaml = getOCamlRuntime();
        if (!ocaml || !ocaml.run) return [];

        const harnessLines = harness ? harness.split('\n').length : 0;
        const combinedCode = harness ? `${harness}\n${code}\n;;` : `${code}\n;;`;

        try {
            const result = ocaml.run(combinedCode);
            if (!result.err || !result.err.trim()) {
                return [];
            }
            return parseOCamlDiagnostics(result.err, harnessLines);
        } catch (err: any) {
            console.warn('[OCaml Worker Lint Error]:', err);
            return [];
        }
    }
});
