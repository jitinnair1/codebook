import type { ExecutionResult } from '../core/types';

export interface WorkerEngine {
  init?(): Promise<void> | void;
  execute(userCode: string, testCode?: string): Promise<ExecutionResult> | ExecutionResult;
}

export function createWorkerHandler(engine: WorkerEngine): void {
  Promise.resolve()
    .then(() => engine.init?.())
    .then(() => {
      self.postMessage({ type: 'READY' });
    })
    .catch((err: any) => {
      console.error('[Worker Init Error]:', err);
      self.postMessage({
        type: 'INIT_ERROR',
        error: err?.message || String(err)
      });
    });

  self.onmessage = async (e: MessageEvent) => {
    const data = e.data;
    if (!data || data.type !== 'RUN') return;

    const { id, userCode, testCode = '' } = data;

    try {
      const res = await engine.execute(userCode, testCode);
      self.postMessage({
        type: 'RESULT',
        id,
        success: res.success,
        output: res.output,
        error: res.error
      });
    } catch (err: any) {
      self.postMessage({
        type: 'RESULT',
        id,
        success: false,
        output: '',
        error: err?.message || String(err)
      });
    }
  };
}
