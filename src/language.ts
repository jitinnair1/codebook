import { store } from './core/store';
import { loadLanguageRunner, getLoadedLanguageRunner, defaultLanguageId, getLanguageMetadata } from './languages/language-registry';
import type { CodeRunner, RunnerStatus } from './core/types';

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

    getStatus(): RunnerStatus {
        const runner = getActiveLoadedRunner();
        if (!runner) return 'loading';
        return runner.getStatus ? runner.getStatus() : (runner.getInitError?.() ? 'error' : 'ready');
    },

    async isReady() {
        try {
            const runner = await loadLanguageRunner(getActiveLanguageId());
            return runner.isReady();
        } catch {
            return false;
        }
    },

    async whenReady(): Promise<void> {
        const runner = await loadLanguageRunner(getActiveLanguageId());
        if (runner.whenReady) {
            await runner.whenReady();
        } else {
            await runner.isReady();
        }
    },

    getInitError() {
        return getActiveLoadedRunner()?.getInitError?.() || null;
    },

    subscribeStatus(listener: (status: RunnerStatus, error?: string | null) => void): () => void {
        let currentRunnerUnsub: (() => void) | null = null;
        let currentLangId = getActiveLanguageId();

        const attachToCurrentLanguage = async () => {
            if (currentRunnerUnsub) {
                currentRunnerUnsub();
                currentRunnerUnsub = null;
            }

            const langId = getActiveLanguageId();
            currentLangId = langId;

            try {
                // Emit loading immediately while fetching adapter
                const existingRunner = getLoadedLanguageRunner(langId);
                if (existingRunner?.subscribeStatus) {
                    currentRunnerUnsub = existingRunner.subscribeStatus(listener);
                } else {
                    listener('loading', null);
                    const runner = await loadLanguageRunner(langId);
                    if (currentLangId === langId && runner.subscribeStatus) {
                        currentRunnerUnsub = runner.subscribeStatus(listener);
                    }
                }
            } catch (err: any) {
                if (currentLangId === langId) {
                    listener('error', err?.message || String(err));
                }
            }
        };

        // Attach to current active language immediately
        attachToCurrentLanguage();

        // Subscribe to store language changes
        const storeUnsub = store.subscribe(() => {
            const newLangId = getActiveLanguageId();
            if (newLangId !== currentLangId) {
                attachToCurrentLanguage();
            }
        });

        return () => {
            storeUnsub();
            if (currentRunnerUnsub) {
                currentRunnerUnsub();
            }
        };
    },

    async run(userCode: string, testCode?: string) {
        const runner = await loadLanguageRunner(getActiveLanguageId());
        return runner.run(userCode, testCode);
    },

    terminate() {
        getActiveLoadedRunner()?.terminate?.();
    },
};