import type { ExecutionResult } from '../core/types';
import type { DiagnosticItem } from './types';

export interface WorkerEngine {
  init?(): Promise<void> | void;
  execute(userCode: string, testCode?: string): Promise<ExecutionResult> | ExecutionResult;
  lint?(code: string): Promise<DiagnosticItem[]> | DiagnosticItem[];
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
    if (!data) return;

    if (data.type === 'RUN') {
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
    } else if (data.type === 'LINT') {
      const { id, code } = data;

      try {
        const diagnostics = engine.lint ? await engine.lint(code) : [];
        self.postMessage({
          type: 'LINT_RESULT',
          id,
          diagnostics: Array.isArray(diagnostics) ? diagnostics : []
        });
      } catch (err: any) {
        console.error('[Worker Lint Error]:', err);
        self.postMessage({
          type: 'LINT_RESULT',
          id,
          diagnostics: []
        });
      }
    }
  };
}
