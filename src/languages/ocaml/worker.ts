import harness from './harness.ml?raw';

// Import as URL only — do NOT statically import the script itself.
// toplevel.bc.js is a js_of_ocaml IIFE that uses `with()`, which is
// forbidden in ES module strict mode. Loading via fetch + indirect eval
// executes it in sloppy (non-strict) mode where `with` is allowed.
import toplevelUrl from './toplevel.bc.js?url';

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

// Load the OCaml runtime dynamically and only signal READY once confirmed
async function loadRuntime(): Promise<void> {
    try {
        const response = await fetch(toplevelUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} fetching toplevel.bc.js`);
        }
        const script = await response.text();
        // Indirect eval: (0, eval)(...) runs in the global scope in sloppy mode,
        // which is required because js_of_ocaml emits `with()` statements.
        (0, eval)(script);
    } catch (e: any) {
        const errorMsg = e?.message || String(e);
        console.error('[OCaml Worker] Failed to load runtime:', errorMsg);
        self.postMessage({
            type: 'INIT_ERROR',
            error: `Failed to load OCaml runtime script: ${errorMsg}`
        });
        return;
    }

    if (getOCamlRuntime()) {
        self.postMessage({ type: 'READY' });
    } else {
        const errorMsg = 'OCaml compiler runtime (ocaml.run) was not found after script execution';
        console.error('[OCaml Worker]:', errorMsg);
        self.postMessage({
            type: 'INIT_ERROR',
            error: errorMsg
        });
    }
}

loadRuntime();

self.onmessage = (e: MessageEvent) => {
    const data = e.data;
    if (data && data.type === 'RUN') {
        const { id, userCode, testCode = "" } = data;
        const ocaml = getOCamlRuntime();

        if (!ocaml || !ocaml.run) {
            self.postMessage({
                type: 'RESULT',
                id,
                success: false,
                output: "",
                error: "OCaml compiler not initialized in worker"
            });
            return;
        }

        const fullCode = harness + "\n" + userCode + "\n" + testCode + ";;";

        try {
            const result = ocaml.run(fullCode);
            const cleanOutput = (result.out || "").replace(/module Tests :[\s\S]*?end\n/g, "");

            self.postMessage({
                type: 'RESULT',
                id,
                success: Boolean(result.success),
                output: cleanOutput,
                error: result.err || ""
            });
        } catch (err: any) {
            self.postMessage({
                type: 'RESULT',
                id,
                success: false,
                output: "",
                error: err?.message || String(err)
            });
        }
    }
};
