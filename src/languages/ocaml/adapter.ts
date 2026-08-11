import { BaseAdapter } from '../base-adapter';

class OCamlAdapter extends BaseAdapter {
    name = 'ocaml';

    protected getWorkerUrl(): URL {
        return new URL('./worker.ts', import.meta.url);
    }
}

export const runner = new OCamlAdapter();
export default runner;
