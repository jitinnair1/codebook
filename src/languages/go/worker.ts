// Primary Route: WASM Interpreter (yaegi.wasm)
// Fallback Route: Go Playground Compile API
import harness from './harness.go?raw';
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
    return (self as any).yaegiEval(code);
  }
  throw new Error('WASM interpreter binary (yaegi.wasm) is not loaded.');
}

async function runPlaygroundApi(code: string): Promise<{ success: boolean; output: string; error?: string }> {
  const body = new URLSearchParams();
  body.append('version', '2');
  body.append('body', code);

  const response = await fetch('https://play.golang.org/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; title=GoPlayground'
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Execution request failed with status ${response.status}`);
  }

  const resData = await response.json();

  if (resData.Errors) {
    return {
      success: false,
      output: '',
      error: resData.Errors
    };
  }

  let output = '';
  if (Array.isArray(resData.Events)) {
    output = resData.Events.map((ev: { Message?: string }) => ev.Message || '').join('');
  }

  return {
    success: true,
    output
  };
}

createWorkerHandler({
  async init() {
    getCachedHarness();
    if (typeof (self as any).initYaegi === 'function') {
      await (self as any).initYaegi();
    }
  },

  async execute(userCode: string, testCode: string = '') {
    const combinedCode = combineGoCode(userCode, testCode);

    // 1. Primary Route: Try In-Browser WASM Interpreter
    try {
      return await runWasmInterpreter(combinedCode);
    } catch (wasmErr: any) {
      console.log('[Go Worker]: Primary WASM route unavailable, attempting Playground API fallback:', wasmErr?.message);
    }

    // 2. Fallback Route: Go Playground API
    try {
      return await runPlaygroundApi(combinedCode);
    } catch (apiErr: any) {
      return {
        success: false,
        output: '',
        error: apiErr?.message || String(apiErr)
      };
    }
  }
});
