import { createLanguageLinter } from '../lint-helper';
import runner from './adapter';

export const lintExtension = createLanguageLinter(runner, 'ocaml');
export default lintExtension;
