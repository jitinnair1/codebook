import siteConfig from '../site.toml';
import type { CodeRunner } from './core/types';

const adapters = import.meta.glob<{ runner?: CodeRunner; default?: CodeRunner; [key: string]: any }>('./languages/*/adapter.ts', { eager: true });

export function getActiveRunner(): CodeRunner {
    const lang = (siteConfig as any).language || 'ocaml';
    const key = `./languages/${lang}/adapter.ts`;
    const module = adapters[key];
    if (!module) {
        throw new Error(`Unsupported language configured in site.toml: ${lang}`);
    }
    return module.runner || module.default || Object.values(module)[0];
}

export const activeRunner = getActiveRunner();