import siteConfig from '../../site.toml';
import type { Extension } from '@codemirror/state';
import type { CodeRunner } from '../core/types';
import type { LanguageMetadata } from './types';

// Discover metadata and syntax extensions synchronously for immediate UI rendering
const metadataModules = import.meta.glob<{ metadata?: LanguageMetadata; default?: LanguageMetadata }>(
  './*/metadata.ts',
  { eager: true }
);

// Discover adapters as lazy dynamic imports (loaded on-demand for enabled languages)
const adapterModules = import.meta.glob<{ runner?: CodeRunner; default?: CodeRunner; [key: string]: any }>(
  './*/adapter.ts'
);

const syntaxModules = import.meta.glob<{ syntaxExtension?: Extension; default?: Extension }>(
  './*/syntax.ts',
  { eager: true }
);

// Maps for metadata and syntax
const metadataMap = new Map<string, LanguageMetadata>();
const syntaxMap = new Map<string, Extension>();

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
}

// Extract site config for enabled languages & default language
const configAny = siteConfig as any;
const allDiscoveredIds = Array.from(metadataMap.keys());
const fallbackDefaultId = allDiscoveredIds.length > 0 ? allDiscoveredIds[0] : '';

const rawLanguages: string[] = Array.isArray(configAny.languages)
  ? configAny.languages
  : (configAny.default_language || configAny.language)
    ? [configAny.default_language || configAny.language]
    : allDiscoveredIds;

export const enabledLanguageIds = rawLanguages.filter(id => metadataMap.has(id));

export const defaultLanguageId: string =
  configAny.default_language ||
  (enabledLanguageIds.length > 0 ? enabledLanguageIds[0] : fallbackDefaultId);

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

export function getAllDiscoveredLanguages(): LanguageMetadata[] {
  return Array.from(metadataMap.values());
}
