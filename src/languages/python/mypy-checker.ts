import type { DiagnosticItem } from '../types';

let mypyReady = false;
let mypyInitPromise: Promise<void> | null = null;

const MYPY_BRIDGE_PYTHON = `
import json, re

_mypy_line_regex = re.compile(
    r'^/tmp_mypy_input\\.py:(\\d+)(?::(\\d+))?:\\s*(error|warning|note):\\s*(.*)$'
)

def _codebook_mypy_check(src: str) -> str:
    try:
        from mypy import api

        with open('/tmp_mypy_input.py', 'w', encoding='utf-8') as f:
            f.write(src)

        stdout, stderr, exit_status = api.run([
            '/tmp_mypy_input.py',
            '--ignore-missing-imports',
            '--follow-imports=silent',
            '--show-column-numbers',
            '--no-error-summary',
            '--no-color-output',
            '--check-untyped-defs',
            '--hide-error-context',
            '--allow-redefinition',
        ])

        diagnostics = []
        if stdout:
            for raw_line in stdout.splitlines():
                line = raw_line.strip()
                if not line or not line.startswith('/tmp_mypy_input.py:'):
                    continue

                m = _mypy_line_regex.match(line)
                if not m:
                    continue

                line_num = int(m.group(1))
                col_num = int(m.group(2)) if m.group(2) else 1
                kind = m.group(3).lower()
                message = m.group(4).strip()

                severity = 'error'
                if kind == 'warning':
                    severity = 'warning'
                elif kind == 'note':
                    severity = 'info'

                diagnostics.append({
                    "line": line_num,
                    "column": col_num,
                    "message": message,
                    "severity": severity,
                    "source": "mypy"
                })

        return json.dumps(diagnostics)
    except Exception as e:
        import sys
        print(f"[Mypy Internal Error]: {e}", file=sys.stderr)
        return "[]"

_codebook_mypy_check
`;

/**
 * Initializes micropip and mypy inside the provided Pyodide instance.
 */
export async function initMypy(pyodide: any): Promise<void> {
  if (mypyReady) {
    return;
  }

  if (mypyInitPromise) {
    return mypyInitPromise;
  }

  mypyInitPromise = (async () => {
    try {
      await pyodide.loadPackage('micropip');
      await pyodide.runPythonAsync(`
import micropip
await micropip.install(['typing_extensions', 'mypy_extensions', 'pathspec', 'mypy'])
`);
      pyodide.runPython(MYPY_BRIDGE_PYTHON);
      mypyReady = true;
    } catch (err) {
      mypyInitPromise = null;
      console.error('[Mypy Init Error]:', err);
      throw new Error(`Failed to initialize Mypy in Pyodide: ${err}`);
    }
  })();

  return mypyInitPromise;
}

/**
 * Checks whether Mypy is fully initialized and ready.
 */
export function isMypyReady(): boolean {
  return mypyReady;
}

/**
 * Runs static type checking using Mypy inside Pyodide.
 */
export async function checkWithMypy(pyodide: any, code: string): Promise<DiagnosticItem[]> {
  if (!code || !code.trim()) {
    return [];
  }

  if (!mypyReady) {
    await initMypy(pyodide);
  }

  try {
    const mypyCheckFn = pyodide.globals.get('_codebook_mypy_check');
    if (!mypyCheckFn) {
      pyodide.runPython(MYPY_BRIDGE_PYTHON);
    }
    const checkFn = pyodide.globals.get('_codebook_mypy_check');
    const rawJson = checkFn(code);
    const items: DiagnosticItem[] = JSON.parse(rawJson);
    return items;
  } catch (err) {
    console.warn('[Mypy Checker Error]:', err);
    return [];
  }
}
