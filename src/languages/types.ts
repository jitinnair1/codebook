import type { Extension } from '@codemirror/state';
import type { CodeRunner } from '../core/types';

export interface LanguageMetadata {
  id: string;
  name: string;
  extension: string;
  cmLanguage: string;  //codemirror language extension identifier
}

export interface LanguageModule {
  metadata: LanguageMetadata;
  runner: CodeRunner;
  syntax?: Extension;
}
