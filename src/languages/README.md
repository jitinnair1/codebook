# Adding a New Language

## Language Module Structure

Every language lives in its own directory under `src/languages/<lang_id>/`:

```text
src/languages/<lang_id>/
├── metadata.ts   # Language display name, ID, and file extension
├── adapter.ts    # BaseAdapter subclass connecting to worker
├── worker.ts     # Worker script using createWorkerHandler
└── syntax.ts     # (Optional) CodeMirror syntax highlighting definition
```

### Step 1: Create the Language Folder
Create a new directory named after your language ID (e.g., `src/languages/python/`).

```bash
mkdir -p src/languages/python
```

### Step 2: Create `metadata.ts`
Create `src/languages/python/metadata.ts` exporting the `LanguageMetadata` object:

```ts
import type { LanguageMetadata } from '../types';

export const metadata: LanguageMetadata = {
  id: 'python',
  name: 'Python 3',
  extension: '.py',
  cmLanguage: 'python' //choose the correct codemirror language name
};

export default metadata;
```

### Step 3: Create `adapter.ts`
Create `src/languages/python/adapter.ts` extending `BaseAdapter`:

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

### Step 4: Create `worker.ts`
Create `src/languages/python/worker.ts` using `createWorkerHandler`:

```ts
import { createWorkerHandler } from '../base-worker';

createWorkerHandler({
  async init() {
    // Asynchronous WASM/runtime initialization
  },

  async execute(userCode: string, testCode: string = '') {
    // Return ExecutionResult
    return {
      success: true,
      output: 'Execution output...'
    };
  }
});
```

### Step 5: Create `syntax.ts` 
If your language needs CodeMirror syntax highlighting, create `src/languages/python/syntax.ts`:

```ts
import { StreamLanguage } from '@codemirror/language';
import { python } from '@codemirror/legacy-modes/mode/python';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(python);
export default syntaxExtension;
```

### Step 6: Enable in `site.toml`
Open `site.toml` in the project root and add your language ID to the `languages` array:

```toml
default_language = "ocaml"
languages = ["ocaml", "python"]
```

## How It Works

1. `src/languages/language-registry.ts` uses Vite's `import.meta.glob` to automatically discover all language directories at build/dev time.
2. The UI dropdown in `src/ui/languageSelector.ts` populates enabled languages from `site.toml`.
3. Selecting the language loads its code, syntax highlighting, and runner adapter
