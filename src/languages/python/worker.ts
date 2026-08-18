import { loadPyodide } from 'pyodide';
import { createWorkerHandler } from '../base-worker';
import type { DiagnosticItem } from '../types';
import harness from './harness.py?raw';

let pyodideInstance: any = null;
let pyLintFn: any = null;
const stdoutLogs: string[] = [];
const stderrLogs: string[] = [];

async function setupPyodide() {
  if (!pyodideInstance) {
    pyodideInstance = await loadPyodide({
      //JN: We specify the url here since by default it looks to fetch assets from
      //bundled module path which fails on deployment. TODO: clean this up so that manual intervention
      //is not needed on upgrades
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.5/full/'
    });

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

    pyLintFn = pyodideInstance.runPython(`
import ast, json

def _codebook_lint(src):
    try:
        ast.parse(src)
        return "[]"
    except SyntaxError as e:
        diag = {
            "line": e.lineno if e.lineno is not None else 1,
            "column": e.offset if e.offset is not None else 1,
            "endLine": getattr(e, 'end_lineno', None) or (e.lineno if e.lineno is not None else 1),
            "endColumn": getattr(e, 'end_offset', None) or ((e.offset + 1) if e.offset is not None else 2),
            "message": e.msg if e.msg else str(e),
            "severity": "error",
            "source": "python"
        }
        return json.dumps([diag])
    except Exception as e:
        return json.dumps([{
            "line": 1,
            "column": 1,
            "message": str(e),
            "severity": "error",
            "source": "python"
        }])

_codebook_lint
`);
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
    const pyDict = typeof instance.globals?.get === 'function' ? instance.globals.get('dict')() : null;

    //JN: the pyDict below is needed only for python since by default all executions will have a shared global scope
    //this does not happen in other languages since in those there is a clear scope separation (each exercise runs in its own
    //isolated scope)
    try {
      if (pyDict) {
        //JN: the run happens is a single thread an no additional threads are used, but even then teh point of using async is to keep
        //it usable for any await coming from the user's code or for bridging asyncio to JS promise queues
        await instance.runPythonAsync(combinedCode, { globals: pyDict });
      } else {
        await instance.runPythonAsync(combinedCode);
      }
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
    } finally {
      if (pyDict && typeof pyDict.destroy === 'function') {
        pyDict.destroy();
      }
    }
  },

  async lint(code: string): Promise<DiagnosticItem[]> {
    if (!code.trim()) return [];
    await setupPyodide();

    if (!pyLintFn) return [];

    try {
      const rawJson = pyLintFn(code);
      const items: DiagnosticItem[] = JSON.parse(rawJson);
      return items;
    } catch (err) {
      console.warn('[Python Worker Lint Error]:', err);
      return [];
    }
  }
});

