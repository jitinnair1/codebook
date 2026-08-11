import { BaseAdapter } from '../base-adapter';

class OCamlAdapter extends BaseAdapter {
    name = 'ocaml';

    protected createWorker(): Worker {
        return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    }
}

export const runner = new OCamlAdapter();
export default runner;
