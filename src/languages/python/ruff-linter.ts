import initRuff, { Workspace, type Diagnostic } from '@astral-sh/ruff-wasm-web';
import type { DiagnosticItem } from '../types';

let ruffWorkspace: Workspace | null = null;
let initPromise: Promise<Workspace> | null = null;

/**
 * Initializes the Ruff WebAssembly module and returns a configured Workspace.
 */
export async function initRuffLinter(): Promise<Workspace> {
  if (ruffWorkspace) {
    return ruffWorkspace;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await initRuff();

    const workspace = new Workspace({
      'line-length': 88,
      'indent-width': 4,
      format: {
        'indent-style': 'space',
        'quote-style': 'double',
      },
      lint: {
        select: [
          'E4', // Import errors
          'E7', // Statement errors (comparisons, etc.)
          'E9', // Runtime/Syntax errors
          'F',  // Pyflakes (undefined variables, unused imports/variables)
          'B',  // Flake8-bugbear (mutable defaults, common pitfalls)
          'W',  // Pycodestyle warnings
          'UP', // Pyupgrade (modern Python syntax)
        ],
        ignore: [],
      },
    });

    ruffWorkspace = workspace;
    return workspace;
  })();

  return initPromise;
}

/**
 * Maps a Ruff diagnostic code to an appropriate editor severity level.
 */
function getSeverityForCode(code?: string): 'error' | 'warning' | 'info' {
  if (!code) return 'error';

  // Syntax and fatal parse errors
  if (code.startsWith('E9') || code === 'SyntaxError') {
    return 'error';
  }

  // Undefined names and unbound local errors
  if (code === 'F821' || code === 'F822' || code === 'F823') {
    return 'error';
  }

  // Warnings for unused imports, unused variables, bugbear pitfalls, style
  if (code.startsWith('W') || code.startsWith('B') || code === 'F401' || code === 'F841') {
    return 'warning';
  }

  return 'warning';
}

/**
 * Runs Ruff WASM linter against Python code and returns structured DiagnosticItem array.
 */
export async function lintWithRuff(code: string): Promise<DiagnosticItem[]> {
  if (!code || !code.trim()) {
    return [];
  }

  try {
    const workspace = await initRuffLinter();
    const rawDiagnostics = workspace.check(code) as Diagnostic[];

    if (!rawDiagnostics || !Array.isArray(rawDiagnostics)) {
      return [];
    }

    const results: DiagnosticItem[] = [];

    for (const d of rawDiagnostics) {
      const startLoc = d.location;
      const endLoc = d.end_location;

      // Handle 1-based coordinate extraction from Ruff WASM
      const line = startLoc?.row !== undefined
        ? (startLoc.row > 0 ? startLoc.row : startLoc.row + 1)
        : 1;

      const col = startLoc?.column !== undefined
        ? (startLoc.column > 0 ? startLoc.column : startLoc.column + 1)
        : 1;

      const endLine = endLoc?.row !== undefined
        ? (endLoc.row > 0 ? endLoc.row : endLoc.row + 1)
        : line;

      const endCol = endLoc?.column !== undefined
        ? (endLoc.column > 0 ? endLoc.column : endLoc.column + 1)
        : (col + 1);

      const ruleCode = d.code || '';
      const message = ruleCode ? `${d.message} [${ruleCode}]` : d.message;
      const severity = getSeverityForCode(ruleCode);

      results.push({
        line,
        column: col,
        endLine,
        endColumn: endCol,
        message,
        severity,
        source: 'ruff'
      });
    }

    return results;
  } catch (err) {
    console.warn('[Ruff Linter Error]:', err);
    return [];
  }
}
