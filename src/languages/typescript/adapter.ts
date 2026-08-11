import { CodeRunner, ExecutionResult } from '../../core/types';

class TypeScriptAdapter implements CodeRunner {
  name = 'typescript';
  private worker: Worker | null = null;
  private ready = false;
  private initError: string | null = null;
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
    this.initError = null;
    this.clearPendingCallbacks();

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === 'READY') {
        this.ready = true;
        return;
      }

      if (data?.type === 'INIT_ERROR') {
        console.error('[TypeScript Worker Init Error]:', data.error);
        this.initError = data.error || 'Failed to initialize TypeScript worker';
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
      this.initError = err.message || 'Worker thread error';
    };
  }

  async isReady(): Promise<boolean> {
    return this.ready;
  }

  getInitError(): string | null {
    return this.initError;
  }

  private async waitUntilReady(maxWaitMs = 15_000): Promise<boolean> {
    if (this.ready) return true;
    if (this.initError) return false;

    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.ready) return true;
      if (this.initError) return false;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.ready;
  }

  async run(userCode: string, testCode: string = ''): Promise<ExecutionResult> {
    const isReadyNow = await this.waitUntilReady();

    if (this.initError) {
      return {
        success: false,
        output: '',
        error: `TypeScript runtime initialization failed: ${this.initError}`
      };
    }

    if (!isReadyNow || !this.worker) {
      return {
        success: false,
        output: '',
        error: 'TypeScript execution worker is still loading. Please try again in a few seconds.'
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
