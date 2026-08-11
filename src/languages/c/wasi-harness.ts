export interface WasiHarnessConfig {
  mode?: 'buffer' | 'interactive';
  args?: string[];
  inputBytes?: Uint8Array;
  rawMode?: boolean;
  onOutput?: (text: string) => void;
}

export interface WasiHarness {
  imports: {
    wasi_snapshot_preview1: Record<string, Function>;
  };
  setMemory: (mem: WebAssembly.Memory) => void;
  getStdoutText: () => string;
  getStderrText: () => string;
  getStdoutBytes: () => Uint8Array;
  getExitCode: () => number;
}

export class WasiExitError extends Error {
  public code: number;
  constructor(code: number) {
    super(`WASI proc_exit with code ${code}`);
    this.code = code;
  }
}

export function createWasiHarness(config: WasiHarnessConfig = {}): WasiHarness {
  const args = config.args || ['c2wasm'];
  const rawMode = Boolean(config.rawMode);
  const inputBytes = config.inputBytes || new Uint8Array(0);

  let memory: WebAssembly.Memory | null = null;
  let exitCode = 0;
  let inputPos = 0;

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const stdoutByteChunks: Uint8Array[] = [];

  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();

  function getMemoryView(): DataView {
    if (!memory) throw new Error('WASI memory not initialized');
    return new DataView(memory.buffer);
  }

  function getMemoryBytes(): Uint8Array {
    if (!memory) throw new Error('WASI memory not initialized');
    return new Uint8Array(memory.buffer);
  }

  function writeText(fd: number, text: string) {
    if (config.onOutput) {
      config.onOutput(text);
    }
    if (fd === 2) {
      stderrChunks.push(text);
    } else {
      stdoutChunks.push(text);
    }
  }

  const baseWasiImports: Record<string, Function> = {
    proc_exit(code: number) {
      exitCode = code;
      throw new WasiExitError(code);
    },

    fd_write(fd: number, iovs: number, iovs_len: number, nwritten_ptr: number): number {
      const view = getMemoryView();
      const bytes = getMemoryBytes();
      let totalWritten = 0;

      for (let i = 0; i < iovs_len; i++) {
        const ptr = view.getUint32(iovs + i * 8, true);
        const len = view.getUint32(iovs + i * 8 + 4, true);

        if (len > 0) {
          const buf = bytes.subarray(ptr, ptr + len);
          if (fd === 1 && rawMode) {
            stdoutByteChunks.push(new Uint8Array(buf));
          } else {
            const text = decoder.decode(buf, { stream: true });
            writeText(fd, text);
          }
          totalWritten += len;
        }
      }

      if (nwritten_ptr) {
        view.setUint32(nwritten_ptr, totalWritten, true);
      }
      return 0; // WASI_ESUCCESS
    },

    fd_read(fd: number, iovs: number, iovs_len: number, nread_ptr: number): number {
      if (fd !== 0) return 8; // WASI_EBADF
      const view = getMemoryView();
      const bytes = getMemoryBytes();
      let totalRead = 0;

      for (let i = 0; i < iovs_len; i++) {
        const ptr = view.getUint32(iovs + i * 8, true);
        const len = view.getUint32(iovs + i * 8 + 4, true);
        const rem = inputBytes.length - inputPos;
        if (rem <= 0) break;

        const toCopy = Math.min(len, rem);
        bytes.set(inputBytes.subarray(inputPos, inputPos + toCopy), ptr);
        inputPos += toCopy;
        totalRead += toCopy;
        if (toCopy < len) break;
      }

      if (nread_ptr) {
        view.setUint32(nread_ptr, totalRead, true);
      }
      return 0;
    },

    fd_close() {
      return 0;
    },

    fd_seek() {
      return 0;
    },

    fd_fdstat_get(fd: number, stat_ptr: number): number {
      const view = getMemoryView();
      // Set filetype: 2 = character device for stdio
      view.setUint8(stat_ptr, fd <= 2 ? 2 : 4);
      view.setUint16(stat_ptr + 2, 0, true); // flags
      view.setBigUint64(stat_ptr + 8, BigInt(0xffffffff), true); // rights base
      view.setBigUint64(stat_ptr + 16, BigInt(0xffffffff), true); // rights inheriting
      return 0;
    },

    fd_fdstat_set_flags(): number {
      return 0;
    },

    fd_prestat_get(): number {
      return 8; // WASI_EBADF / WASI_ENOENT
    },

    fd_prestat_dir_name(): number {
      return 8;
    },

    args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number {
      const view = getMemoryView();
      view.setUint32(argc_ptr, args.length, true);
      let totalLen = 0;
      for (const arg of args) {
        totalLen += encoder.encode(arg).length + 1;
      }
      view.setUint32(argv_buf_size_ptr, totalLen, true);
      return 0;
    },

    args_get(argv_ptr: number, argv_buf_ptr: number): number {
      const view = getMemoryView();
      const bytes = getMemoryBytes();
      let currentBuf = argv_buf_ptr;

      for (let i = 0; i < args.length; i++) {
        view.setUint32(argv_ptr + i * 4, currentBuf, true);
        const argBytes = encoder.encode(args[i]);
        bytes.set(argBytes, currentBuf);
        bytes[currentBuf + argBytes.length] = 0;
        currentBuf += argBytes.length + 1;
      }
      return 0;
    },

    environ_sizes_get(count_ptr: number, buf_size_ptr: number): number {
      const view = getMemoryView();
      view.setUint32(count_ptr, 0, true);
      view.setUint32(buf_size_ptr, 0, true);
      return 0;
    },

    environ_get(): number {
      return 0;
    },

    path_open(): number {
      return 44; // WASI_ENOENT
    },

    clock_time_get(id: number, precision: bigint, time_ptr: number): number {
      const view = getMemoryView();
      const nowNs = BigInt(Math.floor(performance.now() * 1e6));
      view.setBigUint64(time_ptr, nowNs, true);
      return 0;
    },

    clock_res_get(id: number, res_ptr: number): number {
      const view = getMemoryView();
      view.setBigUint64(res_ptr, BigInt(1000), true);
      return 0;
    },

    random_get(buf_ptr: number, buf_len: number): number {
      const bytes = getMemoryBytes();
      const sub = bytes.subarray(buf_ptr, buf_ptr + buf_len);
      for (let i = 0; i < sub.length; i++) {
        sub[i] = Math.floor(Math.random() * 256);
      }
      return 0;
    }
  };

  // Wrap in a Proxy to dynamically fallback to stub function () => 0 for any unhandled WASI syscall
  const proxiedWasi = new Proxy(baseWasiImports, {
    get(target, prop: string) {
      if (prop in target) {
        return target[prop];
      }
      return () => 0;
    }
  });

  const imports = {
    wasi_snapshot_preview1: proxiedWasi
  };

  return {
    imports,
    setMemory(mem: WebAssembly.Memory) {
      memory = mem;
    },
    getStdoutText() {
      return stdoutChunks.join('');
    },
    getStderrText() {
      return stderrChunks.join('');
    },
    getStdoutBytes() {
      let total = 0;
      for (const c of stdoutByteChunks) total += c.length;
      const result = new Uint8Array(total);
      let offset = 0;
      for (const c of stdoutByteChunks) {
        result.set(c, offset);
        offset += c.length;
      }
      return result;
    },
    getExitCode() {
      return exitCode;
    }
  };
}
