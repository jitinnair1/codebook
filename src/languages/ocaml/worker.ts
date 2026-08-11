import harness from './harness.ml?raw';
import toplevelUrl from './toplevel.bc.js?url';
import { createWorkerHandler } from '../base-worker';

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
    }
});
