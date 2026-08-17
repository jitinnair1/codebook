import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import * as tsvfs from '@typescript/vfs';
import ts from 'typescript-runtime';
import harness from './harness.ts?raw';

//JN: Again, this can be cleaned up once TS7.1 ships the std lib
// *bangs head on wall: why is TS tooling like this*
// also, I need to check if we really need VFS as dep, here might be
// a better way to do this perhaps?
const libModules = import.meta.glob<string>(
  '../../../node_modules/typescript-runtime/lib/lib.*.d.ts',
  { query: '?raw', import: 'default', eager: true }
);

const cachedFsMap = new Map<string, string>();
for (const path in libModules) {
  const fileName = path.substring(path.lastIndexOf('/') + 1);
  cachedFsMap.set('/' + fileName, libModules[path]);
}
cachedFsMap.set('/harness.ts', harness);

const compilerOptions: any = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  skipDefaultLibCheck: true,
};

function runDiagnostics(code: string): Diagnostic[] {
  if (!code.trim()) return [];

  try {
    const fsMap = new Map(cachedFsMap);
    fsMap.set('/index.ts', code);

    const system = tsvfs.createSystem(fsMap);
    const host = tsvfs.createVirtualCompilerHost(system, compilerOptions, ts as any);
    const program = ts.createProgram({
      rootNames: ['/index.ts', '/harness.ts'],
      options: compilerOptions,
      host: host.compilerHost,
    });

    const syntacticDiagnostics = program.getSyntacticDiagnostics();
    const semanticDiagnostics = program.getSemanticDiagnostics();
    const diagnostics = [...syntacticDiagnostics, ...semanticDiagnostics].filter(
      (d: any) => !d.file || d.file.fileName === '/index.ts'
    );

    const codeMirrorDiagnostics: Diagnostic[] = [];

    for (const d of diagnostics) {
      const rawMsg = typeof d.messageText === 'string'
        ? d.messageText
        : ts.flattenDiagnosticMessageText(d.messageText, '\n');

      let from = 0;
      let to = 0;

      if (d.start !== undefined) {
        from = d.start;
        to = d.start + (d.length || 1);
      }

      from = Math.max(0, Math.min(from, code.length));
      to = Math.max(from + 1, Math.min(to, code.length));
      if (from === to && from > 0) from = from - 1;

      let severity: 'error' | 'warning' | 'info' = 'error';
      if (d.category === ts.DiagnosticCategory.Warning) {
        severity = 'warning';
      } else if (
        d.category === ts.DiagnosticCategory.Suggestion ||
        d.category === ts.DiagnosticCategory.Message
      ) {
        severity = 'info';
      }

      codeMirrorDiagnostics.push({
        from,
        to,
        severity,
        message: rawMsg,
        source: 'typescript',
      });
    }

    return codeMirrorDiagnostics;
  } catch (err) {
    console.warn('[TypeScript Linter Error]:', err);
    return [];
  }
}

export const lintExtension: Extension = linter(
  (view) => {
    const code = view.state.doc.toString();
    return runDiagnostics(code);
  },
  { delay: 300 }
);

export default lintExtension;
