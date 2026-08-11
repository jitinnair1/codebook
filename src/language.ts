import { store } from './core/store';
import { loadLanguageRunner, getLoadedLanguageRunner, defaultLanguageId, getLanguageMetadata } from './languages/language-registry';
import type { CodeRunner } from './core/types';

export function getActiveLanguageId(): string {
    return store.getState().currentLanguageId || defaultLanguageId;
}

function getActiveLoadedRunner(): CodeRunner | null {
    return getLoadedLanguageRunner(getActiveLanguageId());
}

// Proxy that delegates to the lazy-loaded runner for the active language.
export const activeRunner: CodeRunner = {
    get name() {
        const id = getActiveLanguageId();
        return getActiveLoadedRunner()?.name || getLanguageMetadata(id)?.name || id;
    },

    async isReady() {
        try {
            const runner = await loadLanguageRunner(getActiveLanguageId());
            return runner.isReady();
        } catch {
            return false;
        }
    },

    getInitError() {
        return getActiveLoadedRunner()?.getInitError?.() || null;
    },

    async run(userCode: string, testCode?: string) {
        const runner = await loadLanguageRunner(getActiveLanguageId());
        return runner.run(userCode, testCode);
    },

    terminate() {
        getActiveLoadedRunner()?.terminate?.();
    },
};