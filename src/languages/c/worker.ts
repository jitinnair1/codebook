import harness from './harness.c?raw';
import { createWorkerHandler } from '../base-worker';
import { initCompiler, compileAndRunC } from './compiler-api';

interface ParsedCSnippet {
  includes: Set<string>;
  body: string;
}

function parseCSnippet(code: string): ParsedCSnippet {
  const includes = new Set<string>();
  if (!code || !code.trim()) {
    return { includes, body: '' };
  }

  const lines = code.split('\n');
  const bodyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#include')) {
      includes.add(trimmed);
    } else {
      bodyLines.push(line);
    }
  }

  return {
    includes,
    body: bodyLines.join('\n').trim()
  };
}

function combineCCode(userCode: string, testCode: string = ''): string {
  const harnessParsed = parseCSnippet(harness);
  const userParsed = parseCSnippet(userCode);
  const testParsed = parseCSnippet(testCode);

  const allIncludes = new Set<string>([
    ...harnessParsed.includes,
    ...userParsed.includes,
    ...testParsed.includes
  ]);

  const includeSection = Array.from(allIncludes).join('\n');
  const bodySection = [harnessParsed.body, userParsed.body, testParsed.body]
    .filter(Boolean)
    .join('\n\n');

  return `${includeSection}\n\n${bodySection}`;
}

createWorkerHandler({
  async init() {
    await initCompiler();
  },

  async execute(userCode: string, testCode: string = '') {
    const combinedCode = combineCCode(userCode, testCode);

    try {
      return await compileAndRunC(combinedCode);
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: err?.message || String(err)
      };
    }
  }
});
