import { StreamLanguage } from '@codemirror/language';
import { c } from '@codemirror/legacy-modes/mode/clike';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(c);
export default syntaxExtension;
