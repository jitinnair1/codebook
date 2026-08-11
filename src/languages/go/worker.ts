// Web Worker for Go execution
// Primary Route: WASM Interpreter (yaegi.wasm)
// Fallback Route: Go Playground Compile API

import harness from './harness.go?raw';
import { createWorkerHandler } from '../base-worker';

function combineGoCode(userCode: string, testCode: string, harnessCode: string): string {
  const allCodes = [userCode, testCode, harnessCode];
  const imports = new Set<string>();
  const cleanSnippets: string[] = [];

  for (const code of allCodes) {
    if (!code || !code.trim()) continue;

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

    const cleanBody = bodyLines.join('\n').trim();
    if (cleanBody) cleanSnippets.push(cleanBody);
  }

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
    if (typeof (self as any).initYaegi === 'function') {
      await (self as any).initYaegi();
    }
  },

  async execute(userCode: string, testCode: string = '') {
    const combinedCode = combineGoCode(userCode, testCode, harness);

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
