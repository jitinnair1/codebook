import { BaseAdapter } from '../base-adapter';

class TypeScriptAdapter extends BaseAdapter {
  name = 'typescript';

  protected createWorker(): Worker {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
}

export const runner = new TypeScriptAdapter();
export default runner;
