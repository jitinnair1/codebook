import type { CodeRunner, ExecutionResult, RunnerStatus } from '../core/types';

export abstract class BaseAdapter implements CodeRunner {
  abstract name: string;
  protected abstract createWorker(): Worker;

  protected worker: Worker | null = null;
  protected ready = false;
  protected status: RunnerStatus = 'loading';
  protected initError: string | null = null;
  protected statusListeners = new Set<(status: RunnerStatus, error?: string | null) => void>();
  protected readyResolvers: Array<() => void> = [];
  protected readyRejecters: Array<(err: Error) => void> = [];

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

  protected notifyStatusListeners() {
    for (const listener of this.statusListeners) {
      try {
        listener(this.status, this.initError);
      } catch (err) {
        console.error(`[${this.name} status listener error]:`, err);
      }
    }
  }

  protected resolveReadyPromises() {
    const resolvers = [...this.readyResolvers];
    this.readyResolvers = [];
    this.readyRejecters = [];
    resolvers.forEach(res => res());
  }

  protected rejectReadyPromises(err: Error) {
    const rejecters = [...this.readyRejecters];
    this.readyResolvers = [];
    this.readyRejecters = [];
    rejecters.forEach(rej => rej(err));
  }

  protected initWorker() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.ready = false;
    this.status = 'loading';
    this.initError = null;
    this.clearPendingCallbacks();
    this.notifyStatusListeners();

    this.worker = this.createWorker();

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === 'READY') {
        this.ready = true;
        this.status = 'ready';
        this.initError = null;
        this.resolveReadyPromises();
        this.notifyStatusListeners();
        return;
      }

      if (data?.type === 'INIT_ERROR') {
        console.error(`[${this.name} Worker Init Error]:`, data.error);
        this.ready = false;
        this.status = 'error';
        const errorMessage = data.error || `Failed to initialize ${this.name} runtime`;
        this.initError = errorMessage;
        this.rejectReadyPromises(new Error(errorMessage));
        this.notifyStatusListeners();
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
      this.ready = false;
      this.status = 'error';
      const errorMessage = err.message || 'Worker thread error';
      this.initError = errorMessage;
      this.rejectReadyPromises(new Error(errorMessage));
      this.notifyStatusListeners();
    };
  }

  getStatus(): RunnerStatus {
    return this.status;
  }

  subscribeStatus(listener: (status: RunnerStatus, error?: string | null) => void): () => void {
    this.statusListeners.add(listener);
    // Immediately emit current state to new subscriber
    try {
      listener(this.status, this.initError);
    } catch (err) {
      console.error(`[${this.name} initial status listener error]:`, err);
    }
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  async whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.status === 'error' && this.initError) {
      return Promise.reject(new Error(this.initError));
    }
    return new Promise<void>((resolve, reject) => {
      this.readyResolvers.push(resolve);
      this.readyRejecters.push(reject);
    });
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

    try {
      await Promise.race([
        this.whenReady(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for ready')), maxWaitMs))
      ]);
      return this.ready;
    } catch {
      return this.ready;
    }
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

