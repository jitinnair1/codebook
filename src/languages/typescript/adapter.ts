import { CodeRunner, ExecutionResult } from '../../core/types';

class TypeScriptAdapter implements CodeRunner {
  name = 'typescript';
  private worker: Worker | null = null;
  private ready = false;
  private pendingCallbacks = new Map<string, { resolve: (res: ExecutionResult) => void; timer: ReturnType<typeof setTimeout> }>();
  private requestIdCounter = 0;

  constructor() {
    this.initWorker();
  }

  private clearPendingCallbacks(reason = 'TypeScript worker was terminated or restarted.') {
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
      console.error('[TypeScript Worker Error]:', err);
    };
  }

  async isReady(): Promise<boolean> {
    return this.ready;
  }

  async run(userCode: string, testCode: string = ''): Promise<ExecutionResult> {
    if (!this.worker || !this.ready) {
      return {
        success: false,
        output: '',
        error: 'TypeScript execution worker is not ready.'
      };
    }

    const id = `req_${++this.requestIdCounter}_${Date.now()}`;

    return new Promise<ExecutionResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        this.initWorker();
        resolve({
          success: false,
          output: '',
          error: 'TypeScript execution timed out (30s).'
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

export const runner = new TypeScriptAdapter();
export default runner;
