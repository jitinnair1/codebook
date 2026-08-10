import { loadPyodide } from 'pyodide';
import harness from './harness.py?raw';

let pyodidePromise: Promise<any> | null = null;

async function initPyodide() {
  if (!pyodidePromise) {
    // loadPyodide from the npm package fetches the WASM binary from CDN at runtime
    pyodidePromise = loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.3/full/'
    });
  }
  return pyodidePromise;
}

initPyodide()
  .then(() => {
    self.postMessage({ type: 'READY' });
  })
  .catch((err) => {
    console.error('[Python Worker Error]: Failed to load Pyodide runtime', err);
    self.postMessage({
      type: 'INIT_ERROR',
      error: err?.message || String(err)
    });
  });

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  if (data && data.type === 'RUN') {
    const { id, userCode, testCode = '' } = data;

    let stdoutLogs: string[] = [];
    let stderrLogs: string[] = [];

    try {
      const pyodide = await initPyodide();

      pyodide.setStdout({
        batched: (text: string) => {
          stdoutLogs.push(text);
        }
      });

      pyodide.setStderr({
        batched: (text: string) => {
          stderrLogs.push(text);
        }
      });

      const combinedCode = testCode ? `${harness}\n\n${userCode}\n\n${testCode}` : `${harness}\n\n${userCode}`;

      await pyodide.runPythonAsync(combinedCode);

      const output = stdoutLogs.join('\n');
      const errorStr = stderrLogs.join('\n');

      self.postMessage({
        type: 'RESULT',
        id,
        success: true,
        output,
        error: errorStr || undefined
      });
    } catch (err: any) {
      self.postMessage({
        type: 'RESULT',
        id,
        success: false,
        output: stdoutLogs.join('\n'),
        error: err?.message || String(err)
      });
    }
  }
};
