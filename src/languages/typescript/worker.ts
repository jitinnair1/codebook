import harness from './harness.ts?raw';

function stripTsTypes(code: string): string {
  return code
    .replace(/:\s*\[[^\]]+\](\[\])?/g, '')
    .replace(/:\s*[\w<>]+(\[\])?/g, '')
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
    .replace(/type\s+\w+\s*=[^;]+;/g, '');
}

self.postMessage({ type: 'READY' });

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
