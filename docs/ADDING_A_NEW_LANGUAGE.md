# Adding a New Language

## Architecture Overview

Language support is decoupled into three layers:

1. **Site Configuration** (`site.toml`): Controls globally enabled languages and default selection.
2. **Language Modules** (`src/languages/<lang_id>/`): Defines metadata, runner adapter, worker engine, syntax highlighting, and optional linter.
3. **Exercise Variants** (`src/exercises/<exercise_id>/<lang_id>/`): Starter template, test harness, and optional custom validators.

All modules are auto-discovered at build/dev time via Vite's `import.meta.glob`:
- `metadata.ts`, `syntax.ts`, and `linter.ts` are loaded eagerly for immediate UI and editor rendering.
- `adapter.ts` is loaded lazily on demand when the language is selected or pre-warmed.

---

## Language Module Structure (`src/languages/<lang_id>/`)

```text
src/languages/<lang_id>/
├── metadata.ts       # (Required) ID, display name, extension, CodeMirror mode identifier
├── adapter.ts        # (Required) Adapter connecting host to worker via createLanguageAdapter
├── worker.ts         # (Required) Execution/lint engine via createWorkerHandler
├── syntax.ts         # (Optional) CodeMirror syntax highlighting extension
├── linter.ts         # (Optional) CodeMirror lint extension via createLanguageLinter
└── <assets>          # (Optional) WASM binaries, runtime scripts, or harness files
```

---

## Checkpoints

### 1. Language Metadata (`src/languages/<lang_id>/metadata.ts`)

Export a `LanguageMetadata` object:

```ts
import type { LanguageMetadata } from '../types';

export const metadata: LanguageMetadata = {
  id: 'python',
  name: 'Python 3',
  extension: '.py',
  cmLanguage: 'python'
};

export default metadata;
```

---

### 2. Execution Adapter (`src/languages/<lang_id>/adapter.ts`)

Use `createLanguageAdapter` to instantiate the runner with a worker factory:

```ts
import { createLanguageAdapter } from '../base-adapter';

export const runner = createLanguageAdapter(
  'python',
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
);

export default runner;
```

> **Advanced**: For custom behavior, subclass `BaseAdapter` directly and override `createWorker()`. `BaseAdapter` manages worker lifecycles, message queues, 30s execution timeouts, 10s lint timeouts, and status events.

---

### 3. Worker Script (`src/languages/<lang_id>/worker.ts`)

Implement runtime execution and optional linting using `createWorkerHandler`:

```ts
import { createWorkerHandler } from '../base-worker';
import type { DiagnosticItem } from '../types';

createWorkerHandler({
  async init() {
    // Optional: Pre-load WASM binaries, packages, or compiler runtimes
  },

  async execute(userCode: string, testCode: string = '', context) {
    // Execute userCode + testCode
    // Check context?.isCancelled() during long operations if supported
    return {
      success: true,
      output: 'Program output...',
      error: undefined
    };
  },

  async lint(code: string, context): Promise<DiagnosticItem[]> {
    // Optional: Return syntax/type diagnostics for live editor feedback
    return [
      {
        line: 1,
        column: 1,
        message: 'Syntax error description',
        severity: 'error' // 'error' | 'warning' | 'info'
      }
    ];
  },

  async reset() {
    // Optional: Reset worker runtime state
  }
});
```

#### Shared Worker Protocol & Helpers:
- `../base-worker`: Handles `INIT`, `RUN`, `LINT`, `CANCEL`, and `RESET` messages sequentially.
- `../lint-helper`: Provides `convertDiagnostics(items, doc)` to map line/column or character offsets to CodeMirror diagnostics.
- `../harness-helper`: Provides `combineSourceWithSpans()`, `mapCombinedLineToUser()`, and `normalizeDiagnostic()` to remap line numbers when wrapping code with test harnesses.

---

### 4. Syntax Highlighting (`src/languages/<lang_id>/syntax.ts`) *(Optional)*

Export a CodeMirror `Extension`:

```ts
import { StreamLanguage } from '@codemirror/language';
import { python } from '@codemirror/legacy-modes/mode/python';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(python);
export default syntaxExtension;
```

---

### 5. In-Editor Linter (`src/languages/<lang_id>/linter.ts`) *(Optional)*

Connect the adapter's `lint()` method to CodeMirror via `createLanguageLinter`:

```ts
import { createLanguageLinter } from '../lint-helper';
import runner from './adapter';

export const lintExtension = createLanguageLinter(runner, 'python');
export default lintExtension;
```

> If `linter.ts` is omitted but the runner implements `lint()`, `language-registry.ts` will automatically bind the linter dynamically.

---

### 6. Exercise Variants (`src/exercises/<exercise_id>/<lang_id>/`)

Add the language folder to each supported exercise:

- **`template.<ext>`** (e.g. `template.py`): Starter code displayed in the editor.
- **`test.<ext>`** (e.g. `test.py`): Test harness appended during execution.
- **`validator.ts`** *(Optional)*: Custom TypeScript validation logic:
  ```ts
  export function validate(code: string, output: string): true | string {
    if (!code.includes('def solve')) return 'Must define solve function';
    return true;
  }
  ```

---

### 7. Enable in Site Configuration (`site.toml`)

Once the language module and exercise variants are in place, enable the language ID in `site.toml`:

```toml
default_language = "ocaml"
languages = ["ocaml", "python", "go", "typescript"] # Add language ID
```

> If a language is enabled in `site.toml` but missing for an exercise, the UI marks it as `(N/A)` for that exercise.

---

## More Checks

### 1. Static Code Blocks in Markdown Descriptions (`problem.md`)
`highlightStaticBlocks()` in `src/core/markdown.ts` automatically queries `getLanguageSyntax(lang)` from `language-registry.ts`. Fenced blocks (e.g. ` ```python `) in `problem.md` are highlighted automatically as long as `syntax.ts` exists.

### 2. Custom File Import Declarations (`src/declarations.d.ts`)
If starter code, harnesses, or tests are imported as raw strings (e.g. `import harness from './harness.py?raw'`), ensure the file extension pattern is covered in `src/declarations.d.ts`.

### 3. Vite Config & Static Binary Assets (`vite.config.ts` / `public/`)
Large WASM binaries or worker scripts should either be imported with `new URL('...', import.meta.url)` or placed in `public/`. If your runtime requires `SharedArrayBuffer`, verify COOP/COEP headers in `vite.config.ts`.

### 4. Curriculum Mapping (`src/exercises/curriculum.yaml`)
If adding exercises specific to the new language, register their IDs in `src/exercises/curriculum.yaml`.

---

## Checklist for Adding a New Language

- [ ] Created `src/languages/<lang_id>/metadata.ts`.
- [ ] Created `src/languages/<lang_id>/adapter.ts` (using `createLanguageAdapter`).
- [ ] Created `src/languages/<lang_id>/worker.ts` (using `createWorkerHandler`).
- [ ] Created `src/languages/<lang_id>/syntax.ts` (if syntax mode available).
- [ ] Created `src/languages/<lang_id>/linter.ts` (if worker implements `lint()`).
- [ ] Added `<lang_id>/template.<ext>` and `<lang_id>/test.<ext>` to exercise folders.
- [ ] Enabled language ID in `languages` in `site.toml`.
- [ ] Verified execution, test results, syntax highlighting, and diagnostics in UI.


