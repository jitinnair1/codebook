import { transform } from 'sucrase';
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
try {
  cleanHarness = transpileTs(harness);
  self.postMessage({ type: 'READY' });
} catch (err: any) {
  const errorMsg = err?.message || String(err);
  console.error('[Harness Transpile Error]:', errorMsg);
  self.postMessage({
    type: 'INIT_ERROR',
    error: `Failed to initialize TypeScript harness: ${errorMsg}`
  });
}

interface RunMessage {
  type: 'RUN';
  id: string;
  userCode: string;
  testCode?: string;
}

self.onmessage = (e: MessageEvent<RunMessage>) => {
  const data = e.data;
  if (!data || data.type !== 'RUN') return;

  const { id, userCode, testCode = '' } = data;
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

    self.postMessage({
      type: 'RESULT',
      id,
      success: true,
      output: outputs.join('\n')
    });
  } catch (err: any) {
    self.postMessage({
      type: 'RESULT',
      id,
      success: false,
      output: outputs.join('\n'),
      error: err?.message || String(err)
    });
  }
};
