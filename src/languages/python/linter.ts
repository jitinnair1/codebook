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
      return convertDiagnostics(items, view.state.doc, 'python');
    } catch (err) {
      console.warn('[Python Linter Error]:', err);
      return [];
    }
  },
  { delay: 300 }
);

export default lintExtension;
