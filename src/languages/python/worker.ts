import { loadPyodide } from 'pyodide';
import { createWorkerHandler } from '../base-worker';
import harness from './harness.py?raw';

let pyodideInstance: any = null;
const stdoutLogs: string[] = [];
const stderrLogs: string[] = [];

async function setupPyodide() {
  if (!pyodideInstance) {
    pyodideInstance = await loadPyodide();

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
  }
  return pyodideInstance;
}

createWorkerHandler({
  async init() {
    await setupPyodide();
  },

  async execute(userCode: string, testCode: string = '') {
    stdoutLogs.length = 0;
    stderrLogs.length = 0;

    const instance = await setupPyodide();
    const combinedCode = testCode ? `${harness}\n\n${userCode}\n\n${testCode}` : `${harness}\n\n${userCode}`;

    try {
      await instance.runPythonAsync(combinedCode);
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
