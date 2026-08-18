# Adding a New Language

## Language Module Structure

Every language lives in its own directory under `src/languages/<lang_id>/`:

```text
src/languages/<lang_id>/
├── metadata.ts       # Language display name, ID, file extension, and CM mode
├── adapter.ts        # Runner adapter created via createLanguageAdapter
├── worker.ts         # Worker script using createWorkerHandler
├── syntax.ts         # (Optional) CodeMirror syntax highlighting definition
├── linter.ts         # (Optional) CodeMirror lint extension via createLanguageLinter
└── <assets>          # (Optional) WASM binaries, runtime scripts, or harness files
```

### Step 1: Create the Language Folder
Create a new directory named after your language ID:

```bash
mkdir -p src/languages/<lang_id>
```

### Step 2: Create `metadata.ts`
Export the `LanguageMetadata` object:

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

### Step 3: Create `adapter.ts`
Instantiate the runner using `createLanguageAdapter`:

```ts
import { createLanguageAdapter } from '../base-adapter';

export const runner = createLanguageAdapter(
  'python',
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
);

export default runner;
```

### Step 4: Create `worker.ts`
Implement execution and optional linting with `createWorkerHandler`:

```ts
import { createWorkerHandler } from '../base-worker';
import type { DiagnosticItem } from '../types';

createWorkerHandler({
  async init() {
    // Optional: Pre-load WASM binaries, packages, or compiler runtimes
  },

  async execute(userCode: string, testCode: string = '', context) {
    return {
      success: true,
      output: 'Execution output...',
      error: undefined
    };
  },

  async lint(code: string, context): Promise<DiagnosticItem[]> {
    return [];
  }
});
```

### Step 5: Create `syntax.ts` *(Optional)*
Export CodeMirror syntax highlighting if available:

```ts
import { StreamLanguage } from '@codemirror/language';
import { python } from '@codemirror/legacy-modes/mode/python';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(python);
export default syntaxExtension;
```

### Step 6: Create `linter.ts` *(Optional)*
Connect worker diagnostics to CodeMirror:

```ts
import { createLanguageLinter } from '../lint-helper';
import runner from './adapter';

export const lintExtension = createLanguageLinter(runner, 'python');
export default lintExtension;
```

### Step 7: Add Exercise Templates & Tests
Create `<lang_id>/template.<ext>` and `<lang_id>/test.<ext>` inside relevant `src/exercises/<exercise_id>/` folders.

### Step 8: Enable in `site.toml`
When everything is implemented and ready, add the language ID to `languages` in `site.toml`:

```toml
default_language = "ocaml"
languages = ["ocaml", "python", "go", "typescript"]
```

## How It Works

1. `src/languages/language-registry.ts` discovers `metadata.ts`, `syntax.ts`, and `linter.ts` eagerly at build/dev time.
2. `adapter.ts` is dynamically imported and initialized on-demand via `loadLanguageRunner(id)`.
3. The UI dropdown in `src/ui/languageSelector.ts` populates enabled languages from `site.toml`.

