import { CodeRunner, ExecutionResult } from '../../core/types';

class OCamlAdapter implements CodeRunner {
    name = 'ocaml';
    private worker: Worker | null = null;
    private ready = false;
    private pendingCallbacks = new Map<string, { resolve: (res: ExecutionResult) => void; timer: ReturnType<typeof setTimeout> }>();
    private requestIdCounter = 0;

    constructor() {
        this.initWorker();
    }

    private clearPendingCallbacks(reason = 'Compiler worker was terminated or restarted.') {
        for (const pending of this.pendingCallbacks.values()) {
            clearTimeout(pending.timer);
            pending.resolve({
                success: false,
                output: '',
                error: reason
            });
        }
        this.pendingCallbacks.clear();
    }

    private initWorker() {
        if (this.worker) {
            this.worker.terminate();
        }
        this.ready = false;
        this.clearPendingCallbacks();

        // Vite Web Worker instantiation
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

        this.worker.onmessage = (e: MessageEvent) => {
            const data = e.data;
            if (data?.type === 'READY') {
                this.ready = true;
                return;
            }

            if (data?.type === 'RESULT' && data.id) {
                const pending = this.pendingCallbacks.get(data.id);
                if (pending) {
                    clearTimeout(pending.timer);
                    this.pendingCallbacks.delete(data.id);
                    pending.resolve({
                        success: data.success,
                        output: data.output,
                        error: data.error
                    });
                }
            }
        };

        this.worker.onerror = (err) => {
            console.error('[OCaml Worker Error]:', err);
        };
    }

    async isReady(): Promise<boolean> {
        return this.ready;
    }

    async run(userCode: string, testCode: string = ""): Promise<ExecutionResult> {
        if (!this.worker || !this.ready) {
            return {
                success: false,
                output: "",
                error: "Compiler worker not ready"
            };
        }

        const id = `req_${++this.requestIdCounter}_${Date.now()}`;

        return new Promise<ExecutionResult>((resolve) => {
            const timer = setTimeout(() => {
                this.pendingCallbacks.delete(id);
                resolve({
                    success: false,
                    output: "",
                    error: "Execution timed out (30s). The compiler worker may have crashed."
                });
            }, 30_000);

            this.pendingCallbacks.set(id, { resolve, timer });

            this.worker?.postMessage({
                type: 'RUN',
                id,
                userCode,
                testCode
            });
        });
    }

    terminate(): void {
        this.initWorker();
    }
}

export const runner = new OCamlAdapter();
export const ocamlRunner = runner;
export default runner;
