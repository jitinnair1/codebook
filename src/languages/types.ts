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

export interface DiagnosticItem {
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  from?: number;
  to?: number;
  message: string;
  severity?: 'error' | 'warning' | 'info';
  source?: string;
}
