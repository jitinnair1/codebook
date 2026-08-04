import { store } from './core/store';
import { getLanguageRunner, defaultLanguageId } from './languages/registry';
import type { CodeRunner } from './core/types';

export function getActiveRunner(): CodeRunner {
    const { currentLanguageId } = store.getState();
    const lang = currentLanguageId || defaultLanguageId;
    return getLanguageRunner(lang);
}

export const activeRunner = getActiveRunner();