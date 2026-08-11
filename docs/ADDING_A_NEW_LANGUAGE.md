# Guide: Adding a New Language

This document provides a concise step-by-step walkthrough for adding a new programming language runner and exercise support

---

## Architecture Overview

Language support is decoupled into three main layers:
1. **Site Configuration** (`site.toml`): Controls which languages are globally enabled.
2. **Language Modules** (`src/languages/<lang_id>/`): Defines language metadata, CodeMirror syntax highlighting, and execution runner adapter.
3. **Exercise Variants** (`src/exercises/<exercise_id>/<lang_id>/`): Contains initial starter code, tests, and optional custom validators for each exercise.

All language modules and exercise variants are auto-discovered at build/dev time via Vite's `import.meta.glob`.

---

## Step-by-Step Implementation Guide

### 1. Site Configuration (`site.toml`)

Enable the new language ID in `site.toml` in the project root:

```toml
default_language = "ocaml"
languages = ["ocaml", "python"] # Add your language ID here
```

> **Note**: If a language is enabled here but an exercise lacks a `<lang_id>` subfolder, the UI dropdown automatically marks that language as `(N/A)` for that exercise.

---

### 2. Language Module (`src/languages/<lang_id>/`)

Create a directory: `src/languages/<lang_id>/` (e.g., `src/languages/python/`).

#### A. Metadata (`src/languages/<lang_id>/metadata.ts`)
Defines basic metadata for UI and editor setup.

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

#### B. Execution Adapter (`src/languages/<lang_id>/adapter.ts`)
Extends `BaseAdapter` from `../base-adapter` to manage worker lifecycle, postMessage execution requests, timeouts, and initialization status.

```ts
import { BaseAdapter } from '../base-adapter';

class PythonAdapter extends BaseAdapter {
  name = 'python';

  protected createWorker(): Worker {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
}

export const runner = new PythonAdapter();
export default runner;
```

#### C. CodeMirror Syntax Highlighting (`src/languages/<lang_id>/syntax.ts`)
*(Optional)* Provides editor syntax highlighting using CodeMirror language modes.

```ts
import { StreamLanguage } from '@codemirror/language';
import { python } from '@codemirror/legacy-modes/mode/python';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(python);
export default syntaxExtension;
```

#### D. Web Worker & Static Assets (`src/languages/<lang_id>/worker.ts`)
Implement the language execution logic using `createWorkerHandler` from `../base-worker`.

```ts
import { createWorkerHandler } from '../base-worker';

createWorkerHandler({
  async init() {
    // Perform any asynchronous runtime/WASM initialization here
  },

  async execute(userCode: string, testCode: string = '') {
    // Execute user code + test code and return ExecutionResult
    return {
      success: true,
      output: 'Execution output...'
    };
  }
});
```

Place any large static binary assets (e.g. `.wasm`, `.data` tars) in `public/` or import them into the worker script.

---

### 3. Exercise Variants (`src/exercises/<exercise_id>/<lang_id>/`)

For every exercise that supports the new language, add a `<lang_id>` subfolder under `src/exercises/<exercise_id>/`.

Example: `src/exercises/hello_world/python/`

- **`template.<ext>`** (e.g., `template.py`): Initial starter code shown to the user.
- **`test.<ext>`** (e.g., `test.py`): Test harness appended to user code.
- **`validator.ts`** *(Optional)*: Custom TypeScript validation function:
  ```ts
  export function validate(code: string, output: string): true | string {
    if (!code.includes("print")) return "Must use print function";
    return true;
  }
  ```

---

## Overlooked / Easily Missed Touchpoints

Beyond `site.toml`, `src/languages/`, and `src/exercises/`, verify the following places:

### 1. Markdown Problem Description Code Blocks (`src/core/markdown.ts`)
Static code blocks inside problem descriptions (`problem.md`) are highlighted via `highlightStaticBlocks()`.
- **Current Behavior**: `src/core/markdown.ts` has explicit syntax branches (e.g., checking for `'ocaml'` or `'c'`).
- **Action Required**: Add a branch for your new language, or update `highlightStaticBlocks()` to query `getLanguageSyntax(lang)` from `src/languages/language-registry.ts`.

### 2. Execution Orchestrator Dynamic Lookup (`src/core/runner.ts` / `src/language.ts`)
- Ensure `runner.run()` evaluates `getActiveRunner()` dynamically at execution time rather than using a static reference cached on app start.

### 3. TypeScript File Declarations (`src/declarations.d.ts` & `src/env.d.ts`)
- If starter code files or tests use custom file extensions (e.g. `.py`, `.rs`) and are imported without Vite's `?raw` suffix, declare the module extension in `src/declarations.d.ts` to prevent TypeScript compilation errors.

### 4. Vite Raw Text Loader (`vite.config.ts`)
- Vite's `import.meta.glob` uses `?raw` to load templates/tests as strings. If direct raw imports are used elsewhere for custom file extensions, update `rawTextPlugin()` in `vite.config.ts`.

### 5. Curriculum Order (`src/exercises/curriculum.yaml`)
- If adding brand-new exercises specifically for the new language, register them under the appropriate chapter in `curriculum.yaml`.

---

## Checklist for Adding a New Language

- [ ] Enabled language ID in `site.toml` (`languages` array).
- [ ] Created `src/languages/<lang_id>/metadata.ts`.
- [ ] Created `src/languages/<lang_id>/adapter.ts` (extending `BaseAdapter`).
- [ ] Created `src/languages/<lang_id>/worker.ts` (using `createWorkerHandler`).
- [ ] Created `src/languages/<lang_id>/syntax.ts` (if applicable).
- [ ] Added `<lang_id>/template.<ext>` and `<lang_id>/test.<ext>` inside relevant `src/exercises/<exercise_id>/` directories.
- [ ] Updated `src/core/markdown.ts` if code snippets in `problem.md` use the new language identifier.
- [ ] Tested language selection, code execution, and test pass/fail output in the UI.
