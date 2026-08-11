import { transform } from 'sucrase';
import { createWorkerHandler } from '../base-worker';
import harness from './harness.ts?raw';

function transpileTs(code: string): string {
  if (!code.trim()) return '';
  try {
    return transform(code, { transforms: ['typescript'] }).code;
  } catch (err) {
    console.error('[TypeScript Transpile Error]:', err);
    return code;
  }
}

let cleanHarness = '';

createWorkerHandler({
  init() {
    cleanHarness = transpileTs(harness);
  },

  execute(userCode: string, testCode: string = '') {
    const outputs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      error: (...args: any[]) => outputs.push('[error] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      warn: (...args: any[]) => outputs.push('[warn] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      info: (...args: any[]) => outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    };

    try {
      const cleanUserCode = transpileTs(userCode);
      const cleanTestCode = transpileTs(testCode);

      const combinedCode = `
        ${cleanHarness}
        ${cleanUserCode}
        ${cleanTestCode}
      `;

      const runnerFunc = new Function('console', combinedCode);
      runnerFunc(customConsole);

      return {
        success: true,
        output: outputs.join('\n')
      };
    } catch (err: any) {
      return {
        success: false,
        output: outputs.join('\n'),
        error: err?.message || String(err)
      };
    }
  }
});
