import { StreamLanguage } from '@codemirror/language';
import { python } from '@codemirror/legacy-modes/mode/python';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(python);
export default syntaxExtension;
