import { CodeRunner, ExecutionResult } from '../../core/types';

class GoAdapter implements CodeRunner {
  name = 'go';
  private worker: Worker | null = null;
  private ready = false;
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

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === 'READY') {
        this.ready = true;
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
      console.error('[Go Worker Error]:', err);
    };
  }

  async isReady(): Promise<boolean> {
    return this.ready;
  }

  async run(userCode: string, testCode: string = ''): Promise<ExecutionResult> {
    if (!this.worker) {
      return {
        success: false,
        output: '',
        error: 'Go execution worker is not initialized.'
      };
    }

    const id = `req_${++this.requestIdCounter}_${Date.now()}`;

    return new Promise<ExecutionResult>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        resolve({
          success: false,
          output: '',
          error: 'Go execution timed out (30s).'
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

export const runner = new GoAdapter();
export default runner;
