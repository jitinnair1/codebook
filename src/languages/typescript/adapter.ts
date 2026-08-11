import { BaseAdapter } from '../base-adapter';

class TypeScriptAdapter extends BaseAdapter {
  name = 'typescript';

  protected getWorkerUrl(): URL {
    return new URL('./worker.ts', import.meta.url);
  }
}

export const runner = new TypeScriptAdapter();
export default runner;
