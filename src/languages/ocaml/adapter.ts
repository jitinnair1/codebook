import { createLanguageAdapter } from '../base-adapter';

export const runner = createLanguageAdapter(
  'ocaml',
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
);

export default runner;
