import { StreamLanguage } from '@codemirror/language';
import { typescript } from '@codemirror/legacy-modes/mode/javascript';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(typescript);
export default syntaxExtension;

