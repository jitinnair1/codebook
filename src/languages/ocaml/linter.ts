import { linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { convertDiagnostics } from '../lint-helper';
import runner from './adapter';

export const lintExtension: Extension = linter(
  async (view) => {
    const code = view.state.doc.toString();
    if (!code.trim()) return [];

    try {
      const items = await runner.lint(code);
      return convertDiagnostics(items, view.state.doc, 'ocaml');
    } catch (err) {
      console.warn('[OCaml Linter Error]:', err);
      return [];
    }
  },
  { delay: 300 }
);

export default lintExtension;
