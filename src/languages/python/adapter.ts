import { BaseAdapter } from '../base-adapter';

class PythonAdapter extends BaseAdapter {
  name = 'python';

  protected getWorkerUrl(): URL {
    return new URL('./worker.ts', import.meta.url);
  }
}

export const runner = new PythonAdapter();
export default runner;
