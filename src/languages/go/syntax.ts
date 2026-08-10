import { StreamLanguage } from '@codemirror/language';
import { go } from '@codemirror/legacy-modes/mode/go';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(go);
export default syntaxExtension;
