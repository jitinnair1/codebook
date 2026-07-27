import harness from './harness.ml?raw';

// Import the OCaml bytecode runtime into worker scope
import './toplevel.bc.js';

interface OCamlRuntime {
    run: (code: string) => { out: string; err: string; success: boolean };
}

function getOCamlRuntime(): OCamlRuntime | undefined {
    return (self as unknown as { ocaml?: OCamlRuntime }).ocaml;
}

// Notify main thread worker is ready
self.postMessage({ type: 'READY' });

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
