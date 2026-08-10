import siteConfig from '../../site.toml';
import type { Extension } from '@codemirror/state';
import type { CodeRunner } from '../core/types';
import type { LanguageMetadata, LanguageModule } from './types';

//discover metadata, adapters, and syntax extensions via vite's import.meta.glob
const metadataModules = import.meta.glob<{ metadata?: LanguageMetadata; default?: LanguageMetadata }>(
  './*/metadata.ts',
  { eager: true }
);

const adapterModules = import.meta.glob<{ runner?: CodeRunner; default?: CodeRunner;[key: string]: any }>(
  './*/adapter.ts',
  { eager: true }
);

const syntaxModules = import.meta.glob<{ syntaxExtension?: Extension; default?: Extension }>(
  './*/syntax.ts',
  { eager: true }
);

//map discovered languages by language id
const discoveredLanguages = new Map<string, LanguageModule>();

for (const path in metadataModules) {
  const match = path.match(/\.\/([^/]+)\/metadata\.ts$/);
  if (!match) continue;
  const langId = match[1];

  const metaMod = metadataModules[path];
  const metadata = metaMod.metadata || metaMod.default;

  const adapterPath = `./${langId}/adapter.ts`;
  const adapterMod = adapterModules[adapterPath];
  const runner = adapterMod ? (adapterMod.runner || adapterMod.default || Object.values(adapterMod)[0]) : undefined;

  const syntaxPath = `./${langId}/syntax.ts`;
  const syntaxMod = syntaxModules[syntaxPath];
  const syntax = syntaxMod ? (syntaxMod.syntaxExtension || syntaxMod.default) : undefined;

  if (metadata && runner) {
    discoveredLanguages.set(langId, { metadata, runner, syntax });
  }
}

//extract site config for enabled languages & default language
const configAny = siteConfig as any;
const allDiscoveredIds = Array.from(discoveredLanguages.keys());
const fallbackDefaultId = allDiscoveredIds.length > 0 ? allDiscoveredIds[0] : '';

const rawLanguages: string[] = Array.isArray(configAny.languages)
  ? configAny.languages
  : (configAny.default_language || configAny.language)
    ? [configAny.default_language || configAny.language]
    : allDiscoveredIds;

const enabledLanguageIds = rawLanguages.filter(id => discoveredLanguages.has(id));

export const defaultLanguageId: string =
  configAny.default_language ||
  (enabledLanguageIds.length > 0 ? enabledLanguageIds[0] : fallbackDefaultId);

export function getEnabledLanguages(): LanguageMetadata[] {
  return enabledLanguageIds
    .map(id => discoveredLanguages.get(id)?.metadata)
    .filter((meta): meta is LanguageMetadata => meta !== undefined);
}

export function getLanguageMetadata(id: string): LanguageMetadata | undefined {
  return discoveredLanguages.get(id)?.metadata;
}

export function getLanguageRunner(id: string): CodeRunner {
  const mod = discoveredLanguages.get(id);
  if (!mod) {
    throw new Error(
      `Language '${id}' is not registered or supported.\n` +
      `Please check if the language has been setup correctly under 'src/languages/${id}' or in 'site.toml'`
    );
  }
  return mod.runner;
}

export function getLanguageSyntax(id: string): Extension | undefined {
  return discoveredLanguages.get(id)?.syntax;
}

export function getAllDiscoveredLanguages(): LanguageMetadata[] {
  return Array.from(discoveredLanguages.values()).map(m => m.metadata);
}
