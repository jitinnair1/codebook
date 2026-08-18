import { createLanguageAdapter } from '../base-adapter';

export const runner = createLanguageAdapter(
  'python',
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
);

export default runner;
