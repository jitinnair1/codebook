import { BaseAdapter } from '../base-adapter';

class GoAdapter extends BaseAdapter {
  name = 'go';

  protected createWorker(): Worker {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
}

export const runner = new GoAdapter();
export default runner;
