import harness from './harness.go?raw';
import wasmExecRaw from './wasm_exec.js?raw';
import yaegiWasmUrl from './yaegi.wasm?url';
import { createWorkerHandler } from '../base-worker';
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
        headerLineCount = i + 1;
        continue;
      }

      if (trimmed.startsWith('import (') || trimmed === 'import (') {
        inImportBlock = true;
        headerLineCount = i + 1;
        continue;
      }

      if (inImportBlock) {
        headerLineCount = i + 1;
        if (trimmed === ')') {
          inImportBlock = false;
          continue;
        }
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
          imports.add(trimmed);
        }
        continue;
      }

      if (trimmed.startsWith('import ')) {
        headerLineCount = i + 1;
        const importPath = trimmed.slice(7).trim();
        if (importPath) imports.add(importPath);
        continue;
      }

      if (trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
        inHeader = false;
        bodyLines.push(line);
      } else {
        headerLineCount = i + 1;
      }
    } else {
      bodyLines.push(line);
    }
  }

  return {
    imports,
    body: bodyLines.join('\n').trim(),
    headerLineCount
  };
}

let cachedHarness: ParsedGoSnippet | null = null;

function getCachedHarness(): ParsedGoSnippet {
  if (!cachedHarness) {
    cachedHarness = parseGoSnippet(harness);
  }
  return cachedHarness;
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

function combineGoForLint(userCode: string): { combined: string; userLineOffset: number; headerLineCount: number } {
  const harnessSnippet = getCachedHarness();
  const userSnippet = parseGoSnippet(userCode);

  const imports = new Set<string>(harnessSnippet.imports);
  userSnippet.imports.forEach((imp) => imports.add(imp));

  const importSection = imports.size > 0
    ? `import (\n\t${Array.from(imports).join('\n\t')}\n)`
    : '';

  const prefixParts: string[] = ['package main'];
  if (importSection) prefixParts.push(importSection);
  if (harnessSnippet.body) prefixParts.push(harnessSnippet.body);

  const prefix = prefixParts.join('\n\n');
  const userLineOffset = prefix.split('\n').length + 1;

  const combined = `${prefix}\n\n${userSnippet.body}`;
  return { combined, userLineOffset, headerLineCount: userSnippet.headerLineCount };
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

  async lint(userCode: string): Promise<DiagnosticItem[]> {
    if (!userCode.trim()) return [];
    if (typeof (self as any).yaegiEval !== 'function') return [];

    const { combined, userLineOffset, headerLineCount } = combineGoForLint(userCode);

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

        let line = (rawLine - userLineOffset) + headerLineCount + 1;
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
