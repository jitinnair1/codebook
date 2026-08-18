import type { ExecutionResult } from '../core/types';
import type { DiagnosticItem } from './types';
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  WorkerRunMessage,
  WorkerLintMessage,
  WorkerResetMessage
} from './protocol';

export interface ExecutionContext {
  id: string;
  userCode: string;
  testCode?: string;
  isCancelled: () => boolean;
}

export interface LintContext {
  id: string;
  code: string;
  isCancelled: () => boolean;
}

export interface WorkerEngine {
  init?(): Promise<void> | void;
  execute(
    userCode: string,
    testCode?: string,
    context?: ExecutionContext
  ): Promise<ExecutionResult> | ExecutionResult;
  lint?(
    code: string,
    context?: LintContext
  ): Promise<DiagnosticItem[]> | DiagnosticItem[];
  reset?(): Promise<void> | void;
}

export function createWorkerHandler(engine: WorkerEngine): void {
  function send(msg: WorkerOutboundMessage) {
    self.postMessage(msg);
  }

  // Queue to guarantee sequential execution of worker tasks
  const messageQueue: WorkerInboundMessage[] = [];
  let isProcessing = false;
  const cancelledRequestIds = new Set<string>();
  let latestQueuedLintId: string | null = null;

  // Initialize engine on worker startup
  Promise.resolve()
    .then(() => engine.init?.())
    .then(() => {
      send({ type: 'READY' });
    })
    .catch((err: any) => {
      console.error('[Worker Init Error]:', err);
      send({
        type: 'INIT_ERROR',
        error: err?.message || String(err)
      });
    });

  async function processRun(msg: WorkerRunMessage) {
    const { id, userCode, testCode = '' } = msg;

    if (cancelledRequestIds.has(id)) {
      cancelledRequestIds.delete(id);
      send({
        type: 'RESULT',
        id,
        success: false,
        output: '',
        error: 'Execution cancelled.'
      });
      return;
    }

    const context: ExecutionContext = {
      id,
      userCode,
      testCode,
      isCancelled: () => cancelledRequestIds.has(id)
    };

    try {
      const res = await engine.execute(userCode, testCode, context);
      send({
        type: 'RESULT',
        id,
        success: res.success,
        output: res.output,
        error: res.error
      });
    } catch (err: any) {
      send({
        type: 'RESULT',
        id,
        success: false,
        output: '',
        error: err?.message || String(err)
      });
    } finally {
      cancelledRequestIds.delete(id);
    }
  }

  async function processLint(msg: WorkerLintMessage) {
    const { id, code } = msg;

    // If a newer lint request has arrived in the queue, skip stale one
    if (latestQueuedLintId && latestQueuedLintId !== id) {
      send({
        type: 'LINT_RESULT',
        id,
        diagnostics: []
      });
      return;
    }

    if (cancelledRequestIds.has(id)) {
      cancelledRequestIds.delete(id);
      send({
        type: 'LINT_RESULT',
        id,
        diagnostics: []
      });
      return;
    }

    const context: LintContext = {
      id,
      code,
      isCancelled: () => cancelledRequestIds.has(id) || (latestQueuedLintId !== null && latestQueuedLintId !== id)
    };

    try {
      const diagnostics = engine.lint ? await engine.lint(code, context) : [];
      send({
        type: 'LINT_RESULT',
        id,
        diagnostics: Array.isArray(diagnostics) ? diagnostics : []
      });
    } catch (err: any) {
      console.error('[Worker Lint Error]:', err);
      send({
        type: 'LINT_RESULT',
        id,
        diagnostics: []
      });
    } finally {
      cancelledRequestIds.delete(id);
    }
  }

  async function processReset(msg: WorkerResetMessage) {
    try {
      if (engine.reset) {
        await engine.reset();
      }
      send({
        type: 'RESET_DONE',
        id: msg.id
      });
    } catch (err: any) {
      console.error('[Worker Reset Error]:', err);
      send({
        type: 'RESET_DONE',
        id: msg.id
      });
    }
  }

  async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    try {
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift()!;

        if (msg.type === 'RUN') {
          await processRun(msg);
        } else if (msg.type === 'LINT') {
          await processLint(msg);
        } else if (msg.type === 'RESET') {
          await processReset(msg);
        }
      }
    } finally {
      isProcessing = false;
    }
  }

  self.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
    const data = e.data;
    if (!data || !data.type) return;

    if (data.type === 'CANCEL') {
      cancelledRequestIds.add(data.id);
      return;
    }

    if (data.type === 'LINT') {
      latestQueuedLintId = data.id;
    }

    messageQueue.push(data);
    processQueue();
  };
}
