import { siteConfig } from '../core/siteConfig';
import type { Extension } from '@codemirror/state';
import type { CodeRunner } from '../core/types';
import type { LanguageMetadata } from './types';
import { createLanguageLinter } from './lint-helper';

// Discover metadata and syntax extensions synchronously for immediate UI rendering
const metadataModules = import.meta.glob<{ metadata?: LanguageMetadata; default?: LanguageMetadata }>(
  './*/metadata.ts',
  { eager: true }
);

// Discover adapters as lazy dynamic imports (loaded on-demand for enabled languages)
const adapterModules = import.meta.glob<{ runner?: CodeRunner; default?: CodeRunner; [key: string]: any }>(
  './*/adapter.ts'
);

const syntaxModules = import.meta.glob<{ syntaxExtension?: Extension; lintExtension?: Extension; default?: Extension }>(
  './*/syntax.ts',
  { eager: true }
);

const linterModules = import.meta.glob<{ lintExtension?: Extension; default?: Extension }>(
  './*/linter.ts',
  { eager: true }
);

// Maps for metadata, syntax, and linters
const metadataMap = new Map<string, LanguageMetadata>();
const syntaxMap = new Map<string, Extension>();
const linterMap = new Map<string, Extension>();

for (const path in metadataModules) {
  const match = path.match(/\.\/([^/]+)\/metadata\.ts$/);
  if (!match) continue;
  const langId = match[1];

  const metaMod = metadataModules[path];
  const metadata = metaMod.metadata || metaMod.default;

  if (metadata) {
    metadataMap.set(langId, metadata);
  }

  const syntaxPath = `./${langId}/syntax.ts`;
  const syntaxMod = syntaxModules[syntaxPath];
  const syntax = syntaxMod ? (syntaxMod.syntaxExtension || syntaxMod.default) : undefined;
  if (syntax) {
    syntaxMap.set(langId, syntax);
  }

  const linterPath = `./${langId}/linter.ts`;
  const linterMod = linterModules[linterPath];
  const linter = linterMod ? (linterMod.lintExtension || linterMod.default) : undefined;
  if (linter) {
    linterMap.set(langId, linter);
  }
}

// Extract site config for enabled languages & default language
const config = siteConfig;
const allDiscoveredIds = Array.from(metadataMap.keys());

const rawLanguages: string[] = Array.isArray(config.languages)
  ? config.languages
  : (config.default_language ? [config.default_language] : allDiscoveredIds);

export const enabledLanguageIds = rawLanguages.filter(id => metadataMap.has(id));

export const defaultLanguageId: string =
  config.default_language ||
  (enabledLanguageIds.length > 0 ? enabledLanguageIds[0] : (allDiscoveredIds[0] || ''));

// Cache for loaded CodeRunner instances and pending load promises
const runnerCache = new Map<string, CodeRunner>();
const runnerLoadPromises = new Map<string, Promise<CodeRunner>>();

export function getEnabledLanguages(): LanguageMetadata[] {
  return enabledLanguageIds
    .map(id => metadataMap.get(id))
    .filter((meta): meta is LanguageMetadata => meta !== undefined);
}

export function getLanguageMetadata(id: string): LanguageMetadata | undefined {
  return metadataMap.get(id);
}

export function getLoadedLanguageRunner(id: string): CodeRunner | null {
  return runnerCache.get(id) || null;
}

export async function loadLanguageRunner(id: string): Promise<CodeRunner> {
  if (!enabledLanguageIds.includes(id)) {
    throw new Error(
      `Language '${id}' is not enabled in site.toml.\n` +
      `Enabled languages: ${enabledLanguageIds.join(', ')}`
    );
  }

  if (runnerCache.has(id)) {
    return runnerCache.get(id)!;
  }

  if (runnerLoadPromises.has(id)) {
    return runnerLoadPromises.get(id)!;
  }

  const adapterPath = `./${id}/adapter.ts`;
  const importFn = adapterModules[adapterPath];
  if (!importFn) {
    throw new Error(
      `Adapter module for language '${id}' is not registered under 'src/languages/${id}/adapter.ts'.`
    );
  }

  const promise = importFn().then((adapterMod) => {
    const runner = adapterMod.runner || adapterMod.default || Object.values(adapterMod)[0];
    if (!runner) {
      throw new Error(`Failed to find CodeRunner export in 'src/languages/${id}/adapter.ts'.`);
    }
    runnerCache.set(id, runner);
    runnerLoadPromises.delete(id);
    return runner;
  }).catch((err) => {
    runnerLoadPromises.delete(id);
    throw err;
  });

  runnerLoadPromises.set(id, promise);
  return promise;
}

export function getLanguageSyntax(id: string): Extension | undefined {
  return syntaxMap.get(id);
}

export function getLanguageLinter(id: string): Extension | undefined {
  if (linterMap.has(id)) {
    return linterMap.get(id);
  }
  const runner = runnerCache.get(id);
  if (runner && typeof runner.lint === 'function') {
    const autoLinter = createLanguageLinter(runner, id);
    linterMap.set(id, autoLinter);
    return autoLinter;
  }
  return undefined;
}

export function getLanguageExtension(id: string): Extension {
  const syntax = syntaxMap.get(id);
  const linter = getLanguageLinter(id);
  const extensions: Extension[] = [];
  if (syntax) extensions.push(syntax);
  if (linter) extensions.push(linter);
  return extensions;
}

let isPrewarming = false;

export async function prewarmBackgroundLanguages(activeLangId?: string): Promise<void> {
  if (isPrewarming) return;
  isPrewarming = true;

  const activeId = activeLangId || defaultLanguageId;
  const otherLangIds = enabledLanguageIds.filter(id => id !== activeId);

  for (const langId of otherLangIds) {
    try {
      const runner = await loadLanguageRunner(langId);
      if (runner.whenReady) {
        await runner.whenReady();
      } else {
        await runner.isReady();
      }
    } catch (err) {
      console.warn(`[LanguageRegistry] Background pre-warm for '${langId}' deferred:`, err);
    }
  }
}

