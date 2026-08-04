import { store } from './core/store';
import { getLanguageRunner, defaultLanguageId } from './languages/registry';
import type { CodeRunner } from './core/types';

export function getActiveRunner(): CodeRunner {
    const { currentLanguageId } = store.getState();
    const lang = currentLanguageId || defaultLanguageId;
    return getLanguageRunner(lang);
}

// Proxy that always delegates to the current language's runner,
// so switching languages is reflected immediately.
export const activeRunner: CodeRunner = {
    get name() { return getActiveRunner().name; },
    isReady() { return getActiveRunner().isReady(); },
    run(userCode: string, testCode?: string) { return getActiveRunner().run(userCode, testCode); },
    terminate() { return getActiveRunner().terminate?.(); },
};