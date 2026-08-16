# TypeScript Language Engine

## Architecture

The TypeScript runner implements real compile-time type checking and runtime evaluation inside a Web Worker. It runs the official TypeScript Compiler API against a virtual file system (`@typescript/vfs`) to enforce strict type checking and surface real compiler diagnostics (`ts.Diagnostic`) before execution.

NOTE: Right now there is a CDN fetch step since native typescript (v7.0) does not ship the `typescript.js` yet so CDN paths are hardocded in the TS worker setup (ref. `worker.ts`)

## Execution Pipeline

1. **Initialization (`init`)**:
   - Dynamically loads the TypeScript Compiler API (`typescript@5.7.2`) into the Web Worker.
   - Sets up standard library definitions (`lib.es2022.full.d.ts`, `lib.dom.d.ts`) via `@typescript/vfs` fetched and cached from CDN.

2. **Type Checking (Phase 1)**:
   - Mounts the combined test harness, user solution, and test cases into an in-memory virtual file `/index.ts`.
   - Creates a TypeScript `Program` configured with `strict: true` and `noEmit: true`.
   - Collects syntactic and semantic diagnostics.
   - Maps diagnostic character and line offsets back to user editor line numbers.

3. **Transpilation (Phase 2)**:
   - Emits ES2022 JavaScript using `ts.transpileModule` with `module: CommonJS` output.
   - Using CommonJS (rather than ESNext) means the TypeScript compiler itself converts all `export function/class/const` declarations into plain `exports.x = x` assignments — no `export` keyword remains in the output, making it safe to execute inside `new Function()` which only accepts classic script bodies.

4. **Execution (Phase 3)**:
   - Executes the JavaScript in an isolated worker scope with intercepted console methods.
   - A dummy `exports` object is passed to absorb the CommonJS glue code; user functions are still declared in local scope and callable by name.
   - If type check errors were discovered in Phase 1, the execution result is marked as failed with detailed `[Type Error]` messages in the output.
