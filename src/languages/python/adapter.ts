import { CodeRunner, ExecutionResult } from '../../core/types';

class PythonAdapter implements CodeRunner {
  name = 'python';
  private worker: Worker | null = null;
  private ready = false;
  private initError: string | null = null;
  private pendingCallbacks = new Map<string, (res: ExecutionResult) => void>();
  private requestIdCounter = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.ready = false;
    this.initError = null;

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === 'READY') {
        this.ready = true;
        return;
      }

      if (data?.type === 'INIT_ERROR') {
        this.initError = data.error || 'Failed to initialize Python runtime';
        return;
      }

      if (data?.type === 'RESULT' && data.id) {
        const callback = this.pendingCallbacks.get(data.id);
        if (callback) {
          this.pendingCallbacks.delete(data.id);
          callback({
            success: data.success,
            output: data.output,
            error: data.error
          });
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error('[Python Worker Error]:', err);
      this.initError = err.message || 'Worker thread error';
    };
  }

  async isReady(): Promise<boolean> {
    return this.ready;
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
        error: `Python runtime initialization failed: ${this.initError}`
      };
    }

    if (!isReadyNow || !this.worker) {
      return {
        success: false,
        output: '',
        error: 'Python runtime is still loading. Please try again in a few seconds.'
      };
    }

    const id = `req_${++this.requestIdCounter}_${Date.now()}`;

    return new Promise<ExecutionResult>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        resolve({
          success: false,
          output: '',
          error: 'Execution timed out (30s).'
        });
      }, 30_000);

      this.pendingCallbacks.set(id, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

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

export const runner = new PythonAdapter();
export default runner;
