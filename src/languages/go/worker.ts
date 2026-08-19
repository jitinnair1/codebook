import harness from './harness.go?raw';
import wasmExecRaw from './wasm_exec.js?raw';
import yaegiWasmUrl from './yaegi.wasm?url';
import { createWorkerHandler, LintContext } from '../base-worker';
import type { DiagnosticItem } from '../types';

interface ParsedGoSnippet {
  imports: Set<string>;
  body: string;
  headerLineCount: number;
}

function parseGoSnippet(code: string): ParsedGoSnippet {
  const imports = new Set<string>();
  if (!code || !code.trim()) {
    return { imports, body: '', headerLineCount: 0 };
  }

  const lines = code.split('\n');
  let inImportBlock = false;
  let inHeader = true;
  let headerLineCount = 0;
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inHeader) {
      if (trimmed.startsWith('package ')) {
        headerLineCount++;
        continue;
      }
      if (trimmed.startsWith('import (')) {
        inImportBlock = true;
        headerLineCount++;
        continue;
      }
      if (inImportBlock) {
        headerLineCount++;
        if (trimmed === ')') {
          inImportBlock = false;
        } else if (trimmed) {
          imports.add(trimmed);
        }
        continue;
      }
      if (trimmed.startsWith('import ')) {
        headerLineCount++;
        const imp = trimmed.substring(7).trim();
        if (imp) imports.add(imp);
        continue;
      }
      if (!trimmed) {
        headerLineCount++;
        continue;
      }
      inHeader = false;
    }

    bodyLines.push(line);
  }

  return {
    imports,
    body: bodyLines.join('\n'),
    headerLineCount
  };
}

let cachedHarnessSnippet: ParsedGoSnippet | null = null;
function getCachedHarness(): ParsedGoSnippet {
  if (!cachedHarnessSnippet) {
    cachedHarnessSnippet = parseGoSnippet(harness);
  }
  return cachedHarnessSnippet;
}

function combineGoCode(userCode: string, testCode: string): string {
  const harnessSnippet = getCachedHarness();
  const userSnippet = parseGoSnippet(userCode);
  const testSnippet = parseGoSnippet(testCode);

  const imports = new Set<string>(harnessSnippet.imports);
  userSnippet.imports.forEach((imp) => imports.add(imp));
  testSnippet.imports.forEach((imp) => imports.add(imp));

  const cleanSnippets: string[] = [];
  if (harnessSnippet.body) cleanSnippets.push(harnessSnippet.body);
  if (userSnippet.body) cleanSnippets.push(userSnippet.body);
  if (testSnippet.body) cleanSnippets.push(testSnippet.body);

  const importSection = imports.size > 0
    ? `import (\n\t${Array.from(imports).join('\n\t')}\n)`
    : '';

  return `package main\n\n${importSection}\n\n${cleanSnippets.join('\n\n')}`;
}

function combineGoForLint(
  userCode: string,
  testCode = '',
  activeTab: 'code' | 'test' = 'code'
): { combined: string; lineOffset: number; headerLineCount: number } {
  const harnessSnippet = getCachedHarness();
  const userSnippet = parseGoSnippet(userCode);
  const testSnippet = parseGoSnippet(testCode);

  const imports = new Set<string>(harnessSnippet.imports);
  userSnippet.imports.forEach((imp) => imports.add(imp));
  if (activeTab === 'test') {
    testSnippet.imports.forEach((imp) => imports.add(imp));
  }

  const importSection = imports.size > 0
    ? `import (\n\t${Array.from(imports).join('\n\t')}\n)`
    : '';

  const prefixParts: string[] = ['package main'];
  if (importSection) prefixParts.push(importSection);
  if (harnessSnippet.body) prefixParts.push(harnessSnippet.body);

  if (activeTab === 'test') {
    if (userSnippet.body) prefixParts.push(userSnippet.body);
    const prefix = prefixParts.join('\n\n');
    const lineOffset = prefix.split('\n').length + 1;
    const combined = `${prefix}\n\n${testSnippet.body}`;
    return { combined, lineOffset, headerLineCount: testSnippet.headerLineCount };
  } else {
    const prefix = prefixParts.join('\n\n');
    const lineOffset = prefix.split('\n').length + 1;
    const combined = `${prefix}\n\n${userSnippet.body}`;
    return { combined, lineOffset, headerLineCount: userSnippet.headerLineCount };
  }
}

async function runWasmInterpreter(code: string): Promise<{ success: boolean; output: string; error?: string }> {
  if (typeof (self as any).yaegiEval === 'function') {
    const res = (self as any).yaegiEval(code);
    return {
      success: Boolean(res?.success),
      output: res?.output || '',
      error: res?.error || undefined
    };
  }
  throw new Error('WASM interpreter binary (yaegi.wasm) is not loaded.');
}

createWorkerHandler({
  async init() {
    getCachedHarness();

    // 1. Evaluate wasm_exec.js into worker scope to define self.Go
    (0, eval)(wasmExecRaw);

    if (typeof (self as any).Go !== 'function') {
      throw new Error('Failed to load Go WebAssembly bridge (Go constructor not found).');
    }

    const go = new (self as any).Go();

    // 2. Fetch and instantiate yaegi.wasm
    const response = await fetch(yaegiWasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to load yaegi.wasm: HTTP ${response.status}`);
    }
    const wasmBuffer = await response.arrayBuffer();
    const wasmModule = await WebAssembly.instantiate(wasmBuffer, go.importObject);

    // 3. Start Go main loop (which sets self.yaegiEval)
    go.run(wasmModule.instance);

    if (typeof (self as any).yaegiEval !== 'function') {
      throw new Error('yaegiEval is not available after WebAssembly initialization.');
    }
  },

  async execute(userCode: string, testCode: string = '') {
    const combinedCode = combineGoCode(userCode, testCode);
    return await runWasmInterpreter(combinedCode);
  },

  async lint(code: string, context?: LintContext): Promise<DiagnosticItem[]> {
    if (!code.trim()) return [];
    if (typeof (self as any).yaegiEval !== 'function') return [];

    const activeTab = context?.activeTab || 'code';
    const userCode = activeTab === 'code' ? code : (context?.userCode || '');
    const testCode = activeTab === 'test' ? code : (context?.testCode || '');

    const { combined, lineOffset, headerLineCount } = combineGoForLint(userCode, testCode, activeTab);

    try {
      const res = await runWasmInterpreter(combined);
      if (res.success || !res.error) {
        return [];
      }

      const errStr = res.error;
      const diagnostics: DiagnosticItem[] = [];
      const regex = /(?:^|\n)(?:_:)??(\d+):(\d+):\s*(.*)/g;

      let match: RegExpExecArray | null;
      while ((match = regex.exec(errStr)) !== null) {
        const rawLine = parseInt(match[1], 10) || 1;
        const col = parseInt(match[2], 10) || 1;
        const message = match[3].trim();

        let line = (rawLine - lineOffset) + headerLineCount + 1;
        if (line <= 0) line = 1;

        diagnostics.push({
          line,
          column: col,
          severity: 'error',
          message,
          source: 'go'
        });
      }

      if (diagnostics.length === 0 && errStr) {
        diagnostics.push({
          line: 1,
          column: 1,
          severity: 'error',
          message: errStr.trim(),
          source: 'go'
        });
      }

      return diagnostics;
    } catch (err: any) {
      console.warn('[Go Worker Lint Error]:', err);
      return [];
    }
  }
});
