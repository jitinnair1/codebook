import type { CodeRunner, ExecutionResult, RunnerStatus } from '../core/types';
import type { DiagnosticItem } from './types';
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage
} from './protocol';

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

  protected pendingLintCallbacks = new Map<
    string,
    { resolve: (diags: DiagnosticItem[]) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private lintRequestIdCounter = 0;
  private latestLintReqId = 0;
  private activeLintRequestId: string | null = null;

  constructor() {
    // Defer initWorker to microtask to ensure derived class fields are initialized
    queueMicrotask(() => {
      if (!this.worker) {
        this.initWorker();
      }
    });
  }

  protected postToWorker(message: WorkerInboundMessage): void {
    this.worker?.postMessage(message);
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

    for (const pending of this.pendingLintCallbacks.values()) {
      clearTimeout(pending.timer);
      pending.resolve([]);
    }
    this.pendingLintCallbacks.clear();
    this.activeLintRequestId = null;
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
      this.worker = null;
    }
    this.ready = false;
    this.status = 'loading';
    this.initError = null;
    this.clearPendingCallbacks();
    this.notifyStatusListeners();

    try {
      const w = this.createWorker();
      if (!w) return;
      this.worker = w;
    } catch (err: any) {
      console.error(`[${this.name || 'BaseAdapter'} createWorker Error]:`, err);
      this.status = 'error';
      const errorMessage = err?.message || 'Failed to create worker';
      this.initError = errorMessage;
      this.rejectReadyPromises(new Error(errorMessage));
      this.notifyStatusListeners();
      return;
    }

    this.worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
      const data = e.data;
      if (!data) return;

      if (data.type === 'READY') {
        this.ready = true;
        this.status = 'ready';
        this.initError = null;
        this.resolveReadyPromises();
        this.notifyStatusListeners();
        return;
      }

      if (data.type === 'INIT_ERROR') {
        console.error(`[${this.name} Worker Init Error]:`, data.error);
        this.ready = false;
        this.status = 'error';
        const errorMessage = data.error || `Failed to initialize ${this.name} runtime`;
        this.initError = errorMessage;
        this.rejectReadyPromises(new Error(errorMessage));
        this.notifyStatusListeners();
        return;
      }

      if (data.type === 'RESULT' && data.id) {
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
        return;
      }

      if (data.type === 'LINT_RESULT' && data.id) {
        if (this.activeLintRequestId === data.id) {
          this.activeLintRequestId = null;
        }
        const pending = this.pendingLintCallbacks.get(data.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingLintCallbacks.delete(data.id);
          pending.resolve(data.diagnostics || []);
        }
        return;
      }

      if (data.type === 'RESET_DONE') {
        // State reset acknowledged by worker
        return;
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

      this.postToWorker({
        type: 'RUN',
        id,
        userCode,
        testCode
      });
    });
  }

  async lint(code: string): Promise<DiagnosticItem[]> {
    if (!code.trim()) return [];
    if (!this.ready || !this.worker || this.initError) return [];

    // If an earlier lint request is still active, send a cancel signal to the worker
    if (this.activeLintRequestId) {
      this.postToWorker({
        type: 'CANCEL',
        id: this.activeLintRequestId
      });
      const previousPending = this.pendingLintCallbacks.get(this.activeLintRequestId);
      if (previousPending) {
        clearTimeout(previousPending.timer);
        this.pendingLintCallbacks.delete(this.activeLintRequestId);
        previousPending.resolve([]);
      }
    }

    const reqNum = ++this.lintRequestIdCounter;
    this.latestLintReqId = reqNum;
    const id = `lint_${reqNum}_${Date.now()}`;
    this.activeLintRequestId = id;

    return new Promise<DiagnosticItem[]>((resolve) => {
      const timer = setTimeout(() => {
        if (this.activeLintRequestId === id) {
          this.activeLintRequestId = null;
        }
        this.pendingLintCallbacks.delete(id);
        resolve([]);
      }, 10_000);

      this.pendingLintCallbacks.set(id, {
        resolve: (diags) => {
          if (reqNum === this.latestLintReqId) {
            resolve(diags);
          } else {
            resolve([]);
          }
        },
        timer
      });

      this.postToWorker({
        type: 'LINT',
        id,
        code
      });
    });
  }

  async reset(): Promise<void> {
    if (!this.worker || !this.ready) return;
    this.postToWorker({
      type: 'RESET'
    });
  }

  terminate(): void {
    this.initWorker();
  }
}

export class GenericLanguageAdapter extends BaseAdapter {
  name: string;
  private workerFactory: () => Worker;

  constructor(
    name: string,
    workerFactory: () => Worker
  ) {
    super();
    this.name = name;
    this.workerFactory = workerFactory;
    this.initWorker();
  }

  protected createWorker(): Worker {
    if (!this.workerFactory) {
      return null as any;
    }
    return this.workerFactory();
  }
}

export function createLanguageAdapter(
  name: string,
  workerFactory: () => Worker
): BaseAdapter {
  return new GenericLanguageAdapter(name, workerFactory);
}
