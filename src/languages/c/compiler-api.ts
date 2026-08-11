import compilerWasmUrl from './compiler.wasm?url';
import assemblerWasmUrl from './assembler.wasm?url';
import { createWasiHarness, WasiExitError } from './wasi-harness';

let compilerModule: WebAssembly.Module | null = null;
let assemblerModule: WebAssembly.Module | null = null;
let loadPromise: Promise<void> | null = null;

export async function initCompiler(): Promise<void> {
  if (compilerModule && assemblerModule) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [compBuf, asmBuf] = await Promise.all([
      fetch(compilerWasmUrl).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching compiler.wasm`);
        return r.arrayBuffer();
      }),
      fetch(assemblerWasmUrl).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching assembler.wasm`);
        return r.arrayBuffer();
      })
    ]);

    compilerModule = await WebAssembly.compile(compBuf);
    assemblerModule = await WebAssembly.compile(asmBuf);
  })();

  return loadPromise;
}

export async function compileAndRunC(cSourceCode: string): Promise<{ success: boolean; output: string; error?: string }> {
  await initCompiler();

  if (!compilerModule || !assemblerModule) {
    throw new Error('c2wasm compiler modules are not loaded.');
  }

  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(cSourceCode);

  // 1. Compile C Source Code -> WASM Binary Bytes via c2wasm (-b flag)
  const compilerHarness = createWasiHarness({
    mode: 'buffer',
    args: ['c2wasm', '-b'],
    inputBytes,
    rawMode: true
  });

  let compiledWasmBytes: Uint8Array | null = null;

  try {
    const instance = await WebAssembly.instantiate(compilerModule, compilerHarness.imports);
    compilerHarness.setMemory(instance.exports.memory as WebAssembly.Memory);

    const startFn = instance.exports._start as Function | undefined;
    if (typeof startFn === 'function') {
      startFn();
    }
  } catch (err: any) {
    if (!(err instanceof WasiExitError) || err.code !== 0) {
      const compileErr = compilerHarness.getStderrText() || compilerHarness.getStdoutText() || err?.message || String(err);
      return {
        success: false,
        output: compilerHarness.getStdoutText(),
        error: compileErr || 'C Compilation Failed'
      };
    }
  }

  compiledWasmBytes = compilerHarness.getStdoutBytes();

  if (!compiledWasmBytes || compiledWasmBytes.length === 0) {
    const compileErr = compilerHarness.getStderrText() || 'c2wasm emitted 0 bytes of WASM binary.';
    return {
      success: false,
      output: compilerHarness.getStdoutText(),
      error: compileErr
    };
  }

  // 2. Execute Generated WASM Binary in Browser
  const userHarness = createWasiHarness({
    mode: 'buffer',
    args: ['program']
  });

  try {
    const userModule = await WebAssembly.compile(compiledWasmBytes.buffer as ArrayBuffer);
    const userInstance = await WebAssembly.instantiate(userModule, userHarness.imports);
    userHarness.setMemory(userInstance.exports.memory as WebAssembly.Memory);

    const startFn = (userInstance.exports._start || userInstance.exports.main) as Function | undefined;
    if (typeof startFn === 'function') {
      startFn();
    }

    return {
      success: userHarness.getExitCode() === 0,
      output: userHarness.getStdoutText(),
      error: userHarness.getStderrText() || undefined
    };
  } catch (err: any) {
    if (err instanceof WasiExitError) {
      const stdout = userHarness.getStdoutText();
      const stderr = userHarness.getStderrText();
      return {
        success: err.code === 0,
        output: stdout,
        error: stderr || (stdout.trim() ? undefined : `Program exited with code ${err.code}`)
      };
    }

    return {
      success: false,
      output: userHarness.getStdoutText(),
      error: err?.message || String(err)
    };
  }
}
