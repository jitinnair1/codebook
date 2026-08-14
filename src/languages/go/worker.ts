import harness from './harness.go?raw';
import wasmExecRaw from './wasm_exec.js?raw';
import yaegiWasmUrl from './yaegi.wasm?url';
import { createWorkerHandler } from '../base-worker';

interface ParsedGoSnippet {
  imports: Set<string>;
  body: string;
}

function parseGoSnippet(code: string): ParsedGoSnippet {
  const imports = new Set<string>();
  if (!code || !code.trim()) {
    return { imports, body: '' };
  }

  const lines = code.split('\n');
  let inImportBlock = false;
  let inHeader = true;
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inHeader) {
      if (trimmed.startsWith('package ')) continue;

      if (trimmed.startsWith('import (') || trimmed === 'import (') {
        inImportBlock = true;
        continue;
      }

      if (inImportBlock) {
        if (trimmed === ')') {
          inImportBlock = false;
          continue;
        }
        if (trimmed && !trimmed.startsWith('//')) {
          imports.add(trimmed);
        }
        continue;
      }

      if (trimmed.startsWith('import ')) {
        const importPath = trimmed.slice(7).trim();
        if (importPath) imports.add(importPath);
        continue;
      }

      if (trimmed !== '' && !trimmed.startsWith('//')) {
        inHeader = false;
        bodyLines.push(line);
      }
    } else {
      bodyLines.push(line);
    }
  }

  return {
    imports,
    body: bodyLines.join('\n').trim()
  };
}

let cachedHarness: ParsedGoSnippet | null = null;

function getCachedHarness(): ParsedGoSnippet {
  if (!cachedHarness) {
    cachedHarness = parseGoSnippet(harness);
  }
  return cachedHarness;
}

//JN: Go requires a separate function for cobining the harness, userCode and testCode because
// go expects the imports to be at the same place in a single file for execution. Using Go AST
// via WASM increases bundle size and is also slightly slower. If this becomes a bottleneck later
// switching to the Go AST WASM might be better
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
  }
});
