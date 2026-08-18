import * as tsvfs from '@typescript/vfs';
import { createWorkerHandler } from '../base-worker';
import type { DiagnosticItem } from '../types';
import harness from './harness.ts?raw';

//JN: This needs to be cleaned up later. Right now, the native ts does not ship with `typescript.js` and
//vfs fetches from CDN by design to reduce bundle size.
const TS_VERSION = '6.0.3';
const TS_CDN_URL = `https://cdn.jsdelivr.net/npm/typescript@${TS_VERSION}/lib/typescript.min.js`;
const TS_LIB_CDN = `https://cdn.jsdelivr.net/npm/typescript@${TS_VERSION}/lib/`;

let ts: any = null;
let cachedFsMap: Map<string, string> = new Map();

function formatConsoleArg(arg: any): string {
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'undefined') return 'undefined';
  if (arg === null) return 'null';
  if (typeof arg === 'function') return `[Function: ${arg.name || 'anonymous'}]`;
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  try {
    const seen = new WeakSet();
    return JSON.stringify(arg, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    });
  } catch {
    return String(arg);
  }
}

async function loadTypeScriptCompiler(): Promise<any> {
  if (typeof (self as any).ts !== 'undefined') {
    return (self as any).ts;
  }

  const response = await fetch(TS_CDN_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch TypeScript compiler: HTTP ${response.status}`);
  }
  const code = await response.text();
  (0, eval)(code);

  if (typeof (self as any).ts === 'undefined') {
    throw new Error('TypeScript compiler failed to initialize.');
  }

  return (self as any).ts;
}

createWorkerHandler({
  async init() {
    ts = await loadTypeScriptCompiler();

    const compilerOptions: any = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      skipDefaultLibCheck: true,
    };

    // In-memory storer for Web Worker environment
    const memoryStore = new Map<string, string>();
    const storer = {
      getItem: (k: string) => memoryStore.get(k) ?? null,
      setItem: (k: string, v: string) => { memoryStore.set(k, v); },
      removeItem: (k: string) => { memoryStore.delete(k); },
    };

    const customFetcher = async (url: string) => {
      const fileName = url.substring(url.lastIndexOf('/') + 1);
      const res = await fetch(TS_LIB_CDN + fileName);
      if (!res.ok) {
        throw new Error(`Failed to fetch library file ${fileName}: HTTP ${res.status}`);
      }
      return {
        json: () => res.json(),
        text: () => res.text(),
      };
    };

    cachedFsMap = await tsvfs.createDefaultMapFromCDN(
      compilerOptions,
      TS_VERSION,
      true,
      ts,
      undefined,
      customFetcher,
      storer
    );
  },

  async execute(userCode: string, testCode: string = '') {
    if (!ts) {
      ts = await loadTypeScriptCompiler();
    }

    const outputs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => outputs.push(args.map(formatConsoleArg).join(' ')),
      error: (...args: any[]) => outputs.push('[error] ' + args.map(formatConsoleArg).join(' ')),
      warn: (...args: any[]) => outputs.push('[warn] ' + args.map(formatConsoleArg).join(' ')),
      info: (...args: any[]) => outputs.push(args.map(formatConsoleArg).join(' ')),
      debug: (...args: any[]) => outputs.push('[debug] ' + args.map(formatConsoleArg).join(' ')),
      dir: (arg: any) => outputs.push(formatConsoleArg(arg)),
      table: (arg: any) => outputs.push(formatConsoleArg(arg)),
    };

    const harnessLines = harness.split('\n').length;
    const userLines = userCode.split('\n').length;
    const combinedSource = `${harness}\n${userCode}\n${testCode}`;

    const compilerOptions: any = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      skipDefaultLibCheck: true,
    };

    // Phase 1: Real TypeScript Type Checking
    const diagnosticMessages: string[] = [];
    try {
      const fsMap = new Map(cachedFsMap);
      fsMap.set('/index.ts', combinedSource);

      const system = tsvfs.createSystem(fsMap);
      const host = tsvfs.createVirtualCompilerHost(system, compilerOptions, ts);
      const program = ts.createProgram({
        rootNames: ['/index.ts'],
        options: compilerOptions,
        host: host.compilerHost,
      });

      const syntacticDiagnostics = program.getSyntacticDiagnostics();
      const semanticDiagnostics = program.getSemanticDiagnostics();
      const diagnostics = [...syntacticDiagnostics, ...semanticDiagnostics].filter(
        d => !d.file || d.file.fileName === '/index.ts'
      );

      for (const d of diagnostics) {
        const rawMsg = typeof d.messageText === 'string'
          ? d.messageText
          : ts.flattenDiagnosticMessageText(d.messageText, '\n');

        if (d.file && d.start !== undefined) {
          const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
          let loc = `Line ${line + 1}:${character + 1}`;
          if (line >= harnessLines && line < harnessLines + userLines) {
            loc = `Line ${line - harnessLines + 1}:${character + 1}`;
          } else if (line >= harnessLines + userLines) {
            loc = `Test Line ${line - (harnessLines + userLines) + 1}:${character + 1}`;
          }
          diagnosticMessages.push(`[Type Error] ${loc} - ${rawMsg}`);
        } else {
          diagnosticMessages.push(`[Type Error] ${rawMsg}`);
        }
      }
    } catch (typeCheckErr: any) {
      console.error('[TypeScript Type Check Error]:', typeCheckErr);
      diagnosticMessages.push(`[Type Check Failed]: ${typeCheckErr?.message || String(typeCheckErr)}`);
    }

    // Phase 2: Transpile to JavaScript
    // Using CommonJS module output so the TS compiler converts all `export` statements
    // into `exports.x = x` assignments — no `export` keyword remains in the output,
    // allowing safe execution inside new Function() which runs as a classic script body.
    let transpiledJs = '';
    try {
      const transpileResult = ts.transpileModule(combinedSource, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
        },
      });
      transpiledJs = transpileResult.outputText;
    } catch (transpileErr: any) {
      return {
        success: false,
        output: diagnosticMessages.join('\n'),
        error: `Transpilation failed: ${transpileErr?.message || String(transpileErr)}`,
      };
    }

    // Phase 3: Execute in worker scope
    // A dummy `exports` object is passed so the CommonJS boilerplate (exports.x = ...) does
    // not throw a ReferenceError. The user's functions are also declared in local scope,
    // so the test harness can call them directly by name.
    try {
      const runnerFunc = new Function('console', 'exports', transpiledJs);
      runnerFunc(customConsole, {});

      const allOutput = [...diagnosticMessages, ...outputs].join('\n');
      const hasTypeErrors = diagnosticMessages.length > 0;

      return {
        success: !hasTypeErrors,
        output: allOutput,
        error: hasTypeErrors ? `TypeScript type check failed with ${diagnosticMessages.length} error(s)` : undefined,
      };
    } catch (runtimeErr: any) {
      const allOutput = [...diagnosticMessages, ...outputs].join('\n');
      return {
        success: false,
        output: allOutput,
        error: runtimeErr?.message || String(runtimeErr),
      };
    }
  },

  async lint(userCode: string): Promise<DiagnosticItem[]> {
    if (!userCode.trim()) return [];
    if (!ts) {
      ts = await loadTypeScriptCompiler();
    }

    try {
      const fsMap = new Map(cachedFsMap);
      fsMap.set('/index.ts', userCode);
      fsMap.set('/harness.ts', harness);

      const compilerOptions: any = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        skipDefaultLibCheck: true,
      };

      const system = tsvfs.createSystem(fsMap);
      const host = tsvfs.createVirtualCompilerHost(system, compilerOptions, ts);
      const program = ts.createProgram({
        rootNames: ['/index.ts', '/harness.ts'],
        options: compilerOptions,
        host: host.compilerHost,
      });

      const syntacticDiagnostics = program.getSyntacticDiagnostics();
      const semanticDiagnostics = program.getSemanticDiagnostics();
      const diagnostics = [...syntacticDiagnostics, ...semanticDiagnostics].filter(
        d => !d.file || d.file.fileName === '/index.ts'
      );

      const result: DiagnosticItem[] = [];

      for (const d of diagnostics) {
        const rawMsg = typeof d.messageText === 'string'
          ? d.messageText
          : ts.flattenDiagnosticMessageText(d.messageText, '\n');

        const from = d.start !== undefined ? d.start : 0;
        const to = d.start !== undefined ? d.start + (d.length || 1) : 1;
        const severity: 'warning' | 'error' = d.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error';

        result.push({
          from,
          to,
          severity,
          message: rawMsg,
          source: 'typescript'
        });
      }

      return result;
    } catch (err) {
      console.warn('[TypeScript Worker Lint Error]:', err);
      return [];
    }
  }
});
