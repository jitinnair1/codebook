export interface WasiHarnessConfig {
  mode?: 'buffer' | 'interactive';
  args?: string[];
  inputBytes?: Uint8Array;
  rawMode?: boolean;
  onOutput?: (text: string) => void;
  virtualFS?: Record<string, string | Uint8Array>;
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

  interface OpenFile {
    data: Uint8Array;
    pos: number;
  }

  const openFiles = new Map<number, OpenFile>();
  let nextFd = 4;

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const stdoutByteChunks: Uint8Array[] = [];

  const stdoutDecoder = new TextDecoder('utf-8');
  const stderrDecoder = new TextDecoder('utf-8');
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
            const dec = fd === 2 ? stderrDecoder : stdoutDecoder;
            const text = dec.decode(buf, { stream: true });
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
      const view = getMemoryView();
      const bytes = getMemoryBytes();
      let totalRead = 0;

      if (fd === 0) {
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
      }

      const file = openFiles.get(fd);
      if (!file) return 8; // WASI_EBADF

      for (let i = 0; i < iovs_len; i++) {
        const ptr = view.getUint32(iovs + i * 8, true);
        const len = view.getUint32(iovs + i * 8 + 4, true);
        const rem = file.data.length - file.pos;
        if (rem <= 0) break;

        const toCopy = Math.min(len, rem);
        bytes.set(file.data.subarray(file.pos, file.pos + toCopy), ptr);
        file.pos += toCopy;
        totalRead += toCopy;
        if (toCopy < len) break;
      }

      if (nread_ptr) {
        view.setUint32(nread_ptr, totalRead, true);
      }
      return 0;
    },

    fd_close(fd: number): number {
      if (openFiles.has(fd)) {
        openFiles.delete(fd);
      }
      return 0;
    },

    fd_seek(fd: number, offset: bigint | number, whence: number, newoffset_ptr: number): number {
      const file = openFiles.get(fd);
      if (!file) return 8; // WASI_EBADF

      const numOffset = Number(offset);
      let newPos = file.pos;
      if (whence === 0) {
        newPos = numOffset;
      } else if (whence === 1) {
        newPos += numOffset;
      } else if (whence === 2) {
        newPos = file.data.length + numOffset;
      }

      newPos = Math.max(0, Math.min(file.data.length, newPos));
      file.pos = newPos;

      if (newoffset_ptr) {
        const view = getMemoryView();
        view.setBigUint64(newoffset_ptr, BigInt(newPos), true);
      }
      return 0;
    },

    fd_fdstat_get(fd: number, stat_ptr: number): number {
      const view = getMemoryView();
      let filetype = 4; // regular file
      if (fd <= 2) filetype = 2; // character device
      else if (fd === 3) filetype = 3; // directory
      view.setUint8(stat_ptr, filetype);
      view.setUint16(stat_ptr + 2, 0, true);
      view.setBigUint64(stat_ptr + 8, BigInt(0xffffffff), true);
      view.setBigUint64(stat_ptr + 16, BigInt(0xffffffff), true);
      return 0;
    },

    fd_fdstat_set_flags(): number {
      return 0;
    },

    fd_prestat_get(fd: number, prestat_ptr: number): number {
      if (config.virtualFS && fd === 3) {
        const view = getMemoryView();
        view.setUint8(prestat_ptr, 0); // WASI_PREOPENTYPE_DIR = 0
        view.setUint32(prestat_ptr + 4, 1, true); // dir name length ("/")
        return 0;
      }
      return 8; // WASI_EBADF
    },

    fd_prestat_dir_name(fd: number, path_ptr: number, path_len: number): number {
      if (config.virtualFS && fd === 3) {
        const bytes = getMemoryBytes();
        bytes.set(encoder.encode('.'), path_ptr);
        return 0;
      }
      return 8; // WASI_EBADF
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

    path_open(
      dirfd: number,
      dirflags: number,
      path_ptr: number,
      path_len: number,
      oflags: number,
      fs_rights_base: bigint,
      fs_rights_inheriting: bigint,
      fdflags: number,
      opened_fd_ptr: number
    ): number {
      if (!config.virtualFS) return 44; // WASI_ENOENT

      const bytes = getMemoryBytes();
      const rawPath = stdoutDecoder.decode(bytes.subarray(path_ptr, path_ptr + path_len));
      const normalizedPath = rawPath.replace(/^\.?\//, '');

      const fileContent = config.virtualFS[rawPath] ?? config.virtualFS[normalizedPath] ?? config.virtualFS['/' + normalizedPath];

      if (fileContent === undefined) {
        return 44; // WASI_ENOENT
      }

      const data = typeof fileContent === 'string' ? encoder.encode(fileContent) : fileContent;
      const fd = nextFd++;
      openFiles.set(fd, { data, pos: 0 });

      const view = getMemoryView();
      view.setUint32(opened_fd_ptr, fd, true);
      return 0;
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
      const remaining = stdoutDecoder.decode();
      if (remaining) {
        writeText(1, remaining);
      }
      return stdoutChunks.join('');
    },
    getStderrText() {
      const remaining = stderrDecoder.decode();
      if (remaining) {
        writeText(2, remaining);
      }
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
