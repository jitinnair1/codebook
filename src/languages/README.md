# Adding a New Language

## Language Module Structure

Every language lives in its own directory under `src/languages/<lang_id>/`:

```text
src/languages/<lang_id>/
├── metadata.ts   # Language display name, ID, and file extension
├── adapter.ts    # CodeRunner implementation (handles execution/Web Worker)
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
Create `src/languages/python/adapter.ts` implementing the `CodeRunner` interface:

```ts
import type { CodeRunner, ExecutionResult } from '../../core/types';

export const runner: CodeRunner = {
  name: 'python',

  async isReady(): Promise<boolean> {
    // Return true when Web Worker / WASM runtime is initialized
    return true;
  },

  async run(userCode: string, testCode: string = ""): Promise<ExecutionResult> {
    try {
      // Execute user code + test code using your Web Worker or engine
      const output = "Execution output here...";
      return {
        success: true,
        output
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: err.message || String(err)
      };
    }
  }
};

export default runner;
```

### Step 4: Create `syntax.ts` 
If your language needs CodeMirror syntax highlighting, create `src/languages/python/syntax.ts`:

```ts
import { StreamLanguage } from '@codemirror/language';
import { python } from '@codemirror/legacy-modes/mode/python';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(python);
export default syntaxExtension;
```

### Step 5: Enable in `site.toml`
Open `site.toml` in the project root and add your language ID to the `languages` array:

```toml
default_language = "ocaml"
languages = ["ocaml", "python"]
```

## How It Works

1. `src/languages/registry.ts` uses Vite's `import.meta.glob` to automatically discover all language directories at build/dev time.
2. The UI dropdown in `src/ui/languageSelector.ts` populates enabled languages from `site.toml`.
3. Selecting the language loads its code, syntax highlighting, and runner adapter
