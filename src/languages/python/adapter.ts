import { BaseAdapter } from '../base-adapter';

class PythonAdapter extends BaseAdapter {
  name = 'python';

  protected createWorker(): Worker {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
}

export const runner = new PythonAdapter();
export default runner;
