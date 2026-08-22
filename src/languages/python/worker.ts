import { loadPyodide } from 'pyodide';
import { createWorkerHandler } from '../base-worker';
import type { DiagnosticItem } from '../types';
import harness from './harness.py?raw';
import { initRuffLinter, lintWithRuff } from './ruff-linter';
import { initMypy, isMypyReady, checkWithMypy } from './mypy-checker';

let pyodideInstance: any = null;
let pyodideInitPromise: Promise<any> | null = null;

let currentStdoutCollector: ((text: string) => void) | null = null;
let currentStderrCollector: ((text: string) => void) | null = null;

async function setupPyodide(): Promise<any> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (pyodideInitPromise) {
    return pyodideInitPromise;
  }

  pyodideInitPromise = (async () => {
    const instance = await loadPyodide({
      // JN: We specify the url here since by default it looks to fetch assets from
      // bundled module path which fails on deployment.
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.5/full/'
    });

    instance.setStdout({
      batched: (text: string) => {
        if (currentStdoutCollector) {
          currentStdoutCollector(text);
        }
      }
    });

    instance.setStderr({
      batched: (text: string) => {
        if (currentStderrCollector) {
          currentStderrCollector(text);
        }
      }
    });

    pyodideInstance = instance;
    return instance;
  })();

  return pyodideInitPromise;
}

createWorkerHandler({
  async init() {
    // 1. Pre-warm Ruff WASM and Pyodide concurrently for instant READY status
    const [, instance] = await Promise.all([
      initRuffLinter(),
      setupPyodide()
    ]);

    // 2. Pre-load Mypy in the background without blocking the worker's READY event
    if (instance) {
      initMypy(instance).catch((err) => {
        console.warn('[Python Worker Background Mypy Warmup]:', err);
      });
    }
  },

  async execute(userCode: string, testCode: string = '') {
    const instance = await setupPyodide();

    // Phase 1: Static Type Checking with Mypy (Strict Mode)
    if (userCode.trim()) {
      try {
        const typeDiagnostics = await checkWithMypy(instance, userCode);
        const typeErrors = typeDiagnostics.filter(d => d.severity === 'error');

        if (typeErrors.length > 0) {
          const formattedErrors = typeErrors.map(
            d => `[Type Error] Line ${d.line || 1}:${d.column || 1} - ${d.message}`
          );
          return {
            success: false,
            output: formattedErrors.join('\n'),
            error: `Python type check failed with ${typeErrors.length} error(s)`
          };
        }
      } catch (typeCheckErr: any) {
        console.warn('[Python Worker Type Check Warning]:', typeCheckErr);
      }
    }

    // Phase 2: Runtime Execution with isolated stdout/stderr buffers
    const localStdout: string[] = [];
    const localStderr: string[] = [];
    currentStdoutCollector = (text: string) => localStdout.push(text);
    currentStderrCollector = (text: string) => localStderr.push(text);

    const combinedCode = testCode ? `${harness}\n\n${userCode}\n\n${testCode}` : `${harness}\n\n${userCode}`;
    const pyDict = typeof instance.globals?.get === 'function' ? instance.globals.get('dict')() : null;

    // JN: the pyDict below is needed only for python since by default all executions will have a shared global scope
    // this does not happen in other languages since in those there is a clear scope separation (each exercise runs in its own
    // isolated scope)
    try {
      if (pyDict) {
        // JN: the run happens in a single thread and no additional threads are used, but even then the point of using async is to keep
        // it usable for any await coming from the user's code or for bridging asyncio to JS promise queues
        await instance.runPythonAsync(combinedCode, { globals: pyDict });
      } else {
        await instance.runPythonAsync(combinedCode);
      }

      const stdout = localStdout.join('\n');
      const stderr = localStderr.join('\n');
      const combinedOutput = stderr ? (stdout ? `${stdout}\n${stderr}` : stderr) : stdout;

      return {
        success: true,
        output: combinedOutput,
        error: undefined
      };
    } catch (err: any) {
      const stdout = localStdout.join('\n');
      const stderr = localStderr.join('\n');
      const combinedOutput = stderr ? (stdout ? `${stdout}\n${stderr}` : stderr) : stdout;

      return {
        success: false,
        output: combinedOutput,
        error: err?.message || String(err)
      };
    } finally {
      currentStdoutCollector = null;
      currentStderrCollector = null;

      if (pyDict && typeof pyDict.destroy === 'function') {
        pyDict.destroy();
      }
    }
  },

  async lint(code: string): Promise<DiagnosticItem[]> {
    if (!code.trim()) return [];

    // Step 1: Run ultra-fast Ruff WASM linter
    let ruffDiagnostics: DiagnosticItem[] = [];
    try {
      ruffDiagnostics = await lintWithRuff(code);
    } catch (err) {
      console.warn('[Python Worker Ruff Lint Error]:', err);
    }

    // If Ruff detects fatal syntax/parse errors (E999 or SyntaxError), return immediately
    const hasSyntaxError = ruffDiagnostics.some(
      d => d.severity === 'error' && (d.message.includes('SyntaxError') || d.message.includes('[E9'))
    );
    if (hasSyntaxError) {
      return ruffDiagnostics;
    }

    // Step 2: Run Mypy static type checking if Pyodide is ready
    let mypyDiagnostics: DiagnosticItem[] = [];
    if (pyodideInstance && isMypyReady()) {
      try {
        mypyDiagnostics = await checkWithMypy(pyodideInstance, code);
      } catch (err) {
        console.warn('[Python Worker Mypy Lint Error]:', err);
      }
    }

    // Step 3: Combine and sort diagnostics by line and column
    const combined = [...ruffDiagnostics, ...mypyDiagnostics];
    combined.sort((a, b) => {
      const lineDiff = (a.line || 1) - (b.line || 1);
      if (lineDiff !== 0) return lineDiff;
      return (a.column || 1) - (b.column || 1);
    });

    return combined;
  }
});
