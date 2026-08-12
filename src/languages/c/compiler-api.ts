import compilerWasmUrl from './compiler.wasm?url';
import { createWasiHarness, WasiExitError } from './wasi-harness';

let compilerModule: WebAssembly.Module | null = null;
let loadPromise: Promise<void> | null = null;

export async function initCompiler(): Promise<void> {
  if (compilerModule) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const compBuf = await fetch(compilerWasmUrl).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching compiler.wasm`);
      return r.arrayBuffer();
    });

    compilerModule = await WebAssembly.compile(compBuf);
  })();

  return loadPromise;
}

export interface CompileOptions {
  virtualFS?: Record<string, string | Uint8Array>;
}

export async function compileAndRunC(
  cSourceCode: string,
  options?: CompileOptions
): Promise<{ success: boolean; output: string; error?: string }> {
  await initCompiler();

  if (!compilerModule) {
    throw new Error('c2wasm compiler module is not loaded.');
  }

  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(cSourceCode);

  // 1. Compile C Source Code -> WASM Binary Bytes via c2wasm (-b flag)
  const compilerHarness = createWasiHarness({
    mode: 'buffer',
    args: ['c2wasm', '-b'],
    inputBytes,
    rawMode: true,
    virtualFS: options?.virtualFS
  });

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

  const compiledWasmBytes = compilerHarness.getStdoutBytes();

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
    args: ['program'],
    virtualFS: options?.virtualFS
  });

  try {
    const userModule = await WebAssembly.compile(compiledWasmBytes as BufferSource);
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
