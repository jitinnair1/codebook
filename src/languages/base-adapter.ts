import type { CodeRunner, ExecutionResult } from '../core/types';

export abstract class BaseAdapter implements CodeRunner {
  abstract name: string;
  protected abstract createWorker(): Worker;

  protected worker: Worker | null = null;
  protected ready = false;
  protected initError: string | null = null;
  protected pendingCallbacks = new Map<
    string,
    { resolve: (res: ExecutionResult) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private requestIdCounter = 0;

  constructor() {
    this.initWorker();
  }

  protected clearPendingCallbacks(reason = `${this.name} worker was terminated or restarted.`) {
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

  protected initWorker() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.ready = false;
    this.initError = null;
    this.clearPendingCallbacks();

    this.worker = this.createWorker();

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === 'READY') {
        this.ready = true;
        return;
      }

      if (data?.type === 'INIT_ERROR') {
        console.error(`[${this.name} Worker Init Error]:`, data.error);
        this.initError = data.error || `Failed to initialize ${this.name} runtime`;
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
      console.error(`[${this.name} Worker Error]:`, err);
      this.initError = err.message || 'Worker thread error';
    };
  }

  async isReady(): Promise<boolean> {
    return this.ready;
  }

  getInitError(): string | null {
    return this.initError;
  }

  protected async waitUntilReady(maxWaitMs = 15_000): Promise<boolean> {
    if (this.ready) return true;
    if (this.initError) return false;

    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.ready) return true;
      if (this.initError) return false;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return this.ready;
  }

  async run(userCode: string, testCode: string = ''): Promise<ExecutionResult> {
    const isReadyNow = await this.waitUntilReady();

    if (this.initError) {
      return {
        success: false,
        output: '',
        error: `${this.name} runtime initialization failed: ${this.initError}`
      };
    }

    if (!isReadyNow || !this.worker) {
      return {
        success: false,
        output: '',
        error: `${this.name} execution worker is still loading. Please try again in a few seconds.`
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
          error: `${this.name} execution timed out (30s).`
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
