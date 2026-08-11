import { BaseAdapter } from '../base-adapter';

class CAdapter extends BaseAdapter {
  name = 'c';

  protected createWorker(): Worker {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
}

export const runner = new CAdapter();
export default runner;
