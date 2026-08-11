import { store } from './core/store';
import { loadLanguageRunner, getLoadedLanguageRunner, defaultLanguageId, getLanguageMetadata } from './languages/language-registry';
import type { CodeRunner } from './core/types';

export function getActiveLanguageId(): string {
    const { currentLanguageId } = store.getState();
    return currentLanguageId || defaultLanguageId;
}

// Proxy that delegates to the lazy-loaded runner for the active language.
export const activeRunner: CodeRunner = {
    get name() {
        const langId = getActiveLanguageId();
        const loaded = getLoadedLanguageRunner(langId);
        if (loaded) return loaded.name;
        return getLanguageMetadata(langId)?.name || langId;
    },

    async isReady() {
        const langId = getActiveLanguageId();
        try {
            const runner = await loadLanguageRunner(langId);
            return runner.isReady();
        } catch {
            return false;
        }
    },

    getInitError() {
        const langId = getActiveLanguageId();
        return getLoadedLanguageRunner(langId)?.getInitError?.() || null;
    },

    async run(userCode: string, testCode?: string) {
        const langId = getActiveLanguageId();
        const runner = await loadLanguageRunner(langId);
        return runner.run(userCode, testCode);
    },

    terminate() {
        const langId = getActiveLanguageId();
        getLoadedLanguageRunner(langId)?.terminate?.();
    },
};