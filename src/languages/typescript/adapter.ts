import { CodeRunner, ExecutionResult } from '../../core/types';
import harness from './harness.ts?raw';

function stripTsTypes(code: string): string {
  return code
    .replace(/:\s*\[[^\]]+\](\[\])?/g, '')
    .replace(/:\s*[\w<>]+(\[\])?/g, '')
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
    .replace(/type\s+\w+\s*=[^;]+;/g, '');
}

class TypeScriptAdapter implements CodeRunner {
  name = 'typescript';

  async isReady(): Promise<boolean> {
    return true;
  }

  async run(userCode: string, testCode: string = ''): Promise<ExecutionResult> {
    const outputs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      error: (...args: any[]) => outputs.push('[error] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      warn: (...args: any[]) => outputs.push('[warn] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      info: (...args: any[]) => outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    };

    try {
      const cleanHarness = stripTsTypes(harness);
      const cleanUserCode = stripTsTypes(userCode);
      const cleanTestCode = stripTsTypes(testCode);

      const combinedCode = `
        ${cleanHarness}
        ${cleanUserCode}
        ${cleanTestCode}
      `;

      const runnerFunc = new Function('console', combinedCode);
      runnerFunc(customConsole);

      return {
        success: true,
        output: outputs.join('\n'),
      };
    } catch (err: any) {
      return {
        success: false,
        output: outputs.join('\n'),
        error: err?.message || String(err),
      };
    }
  }
}

export const runner = new TypeScriptAdapter();
export default runner;
