import { StreamLanguage } from '@codemirror/language';
import { oCaml } from '@codemirror/legacy-modes/mode/mllike';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(oCaml);
export default syntaxExtension;
