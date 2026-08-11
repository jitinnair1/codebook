import { loadPyodide } from 'pyodide';
import { createWorkerHandler } from '../base-worker';
import harness from './harness.py?raw';

let pyodideInstance: any = null;

createWorkerHandler({
  async init() {
    pyodideInstance = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.3/full/'
    });
  },

  async execute(userCode: string, testCode: string = '') {
    const stdoutLogs: string[] = [];
    const stderrLogs: string[] = [];

    if (!pyodideInstance) {
      pyodideInstance = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.3/full/'
      });
    }

    pyodideInstance.setStdout({
      batched: (text: string) => {
        stdoutLogs.push(text);
      }
    });

    pyodideInstance.setStderr({
      batched: (text: string) => {
        stderrLogs.push(text);
      }
    });

    const combinedCode = testCode ? `${harness}\n\n${userCode}\n\n${testCode}` : `${harness}\n\n${userCode}`;

    try {
      await pyodideInstance.runPythonAsync(combinedCode);
      const output = stdoutLogs.join('\n');
      const errorStr = stderrLogs.join('\n');

      return {
        success: true,
        output,
        error: errorStr || undefined
      };
    } catch (err: any) {
      return {
        success: false,
        output: stdoutLogs.join('\n'),
        error: err?.message || String(err)
      };
    }
  }
});
