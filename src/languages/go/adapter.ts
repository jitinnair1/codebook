import { BaseAdapter } from '../base-adapter';

class GoAdapter extends BaseAdapter {
  name = 'go';

  protected getWorkerUrl(): URL {
    return new URL('./worker.ts', import.meta.url);
  }
}

export const runner = new GoAdapter();
export default runner;
