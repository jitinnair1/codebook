import { StreamLanguage } from '@codemirror/language';
import { javascript } from '@codemirror/legacy-modes/mode/javascript';
import type { Extension } from '@codemirror/state';

export const syntaxExtension: Extension = StreamLanguage.define(javascript);
export default syntaxExtension;
