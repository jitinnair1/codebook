import curriculumConfig from './curriculum.yaml';
import { Exercise, Chapter, LanguageVariant } from '../core/types';
import { enabledLanguageIds } from '../languages/language-registry';

// Discover all problem.md files dynamically
const problemFiles = import.meta.glob<string>(
  './*/problem.md',
  { query: '?raw', import: 'default', eager: true }
);

// Discover template, test, and optional validator files across all exercise subfolders
const templateFiles = import.meta.glob<string>(
  './*/*/template.*',
  { query: '?raw', import: 'default', eager: true }
);

const testFiles = import.meta.glob<string>(
  './*/*/test.*',
  { query: '?raw', import: 'default', eager: true }
);

const solutionFiles = import.meta.glob<string>(
  './*/*/solution.*',
  { query: '?raw', import: 'default', eager: true }
);

const validatorFiles = import.meta.glob<{ default?: (code: string, output: string) => true | string; validate?: (code: string, output: string) => true | string }>(
  './*/*/validator.ts',
  { eager: true }
);

const validatorRawFiles = import.meta.glob<string>(
  './*/*/validator.ts',
  { query: '?raw', import: 'default', eager: true }
);

function generateId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Format exercise title from directory name
function formatTitle(folder: string): string {
  return folder
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const rawChapters: Array<{ title: string; id?: string; exercises?: string[] }> =
  curriculumConfig?.chapters
    ? Object.entries(curriculumConfig.chapters).map(([title, exercises]) => ({
        title,
        exercises: Array.isArray(exercises) ? (exercises as string[]) : []
      }))
    : [];

export const curriculum: Chapter[] = rawChapters.map((ch, chapterIndex) => {
  const chapterId = ch.id || generateId(ch.title);
  const chapterNumber = chapterIndex + 1;

  const exerciseList: Exercise[] = (ch.exercises || [])
    .map((folder, exerciseIndex) => {
      const exerciseNumber = exerciseIndex + 1;
      const exId = `${chapterNumber}.${exerciseNumber}`;

      const problemPath = `./${folder}/problem.md`;
      const description = problemFiles[problemPath] || '';
      const title = formatTitle(folder);

      const exercise: Exercise = {
        id: exId,
        title,
        description,
        variants: {}
      };

      return exercise;
    });

  return {
    id: chapterId,
    title: ch.title,
    exercises: exerciseList
  };
});

// Helper to auto-discover and attach variants from subfolders
function attachDiscoveredVariants(chapterList: Chapter[]) {
  const discoveredMap: Record<string, Record<string, LanguageVariant>> = {};

  for (const path in templateFiles) {
    const match = path.match(/^\.\/([^/]+)\/([^/]+)\/template\..+$/);
    if (!match) continue;
    const [, folder, langId] = match;

    if (!enabledLanguageIds.includes(langId)) continue;

    const initialCode = templateFiles[path] || '';
    const testPathKey = Object.keys(testFiles).find(p => p.startsWith(`./${folder}/${langId}/test.`));
    const testCode = testPathKey ? (testFiles[testPathKey] || '') : '';

    const solutionPathKey = Object.keys(solutionFiles).find(p => p.startsWith(`./${folder}/${langId}/solution.`));
    const solutionCode = solutionPathKey ? (solutionFiles[solutionPathKey] || '') : '';

    const validatorPathKey = Object.keys(validatorFiles).find(p => p === `./${folder}/${langId}/validator.ts`);
    const validatorMod = validatorPathKey ? validatorFiles[validatorPathKey] : undefined;
    const validateFn = validatorMod?.validate || validatorMod?.default;

    const validatorRawPathKey = Object.keys(validatorRawFiles).find(p => p === `./${folder}/${langId}/validator.ts`);
    const validatorCode = validatorRawPathKey ? (validatorRawFiles[validatorRawPathKey] || '') : '';

    if (!discoveredMap[folder]) {
      discoveredMap[folder] = {};
    }
    discoveredMap[folder][langId] = {
      initialCode,
      testCode,
      ...(solutionCode ? { solutionCode } : {}),
      ...(validatorCode ? { validatorCode } : {}),
      ...(validateFn ? { validate: validateFn } : {})
    };
  }

  rawChapters.forEach((ch, chapterIndex) => {
    const chapterObj = chapterList[chapterIndex];
    if (!chapterObj) return;

    (ch.exercises || []).forEach((folder, exerciseIndex) => {
      const ex = chapterObj.exercises[exerciseIndex];
      if (!ex) return;

      if (!ex.variants) {
        ex.variants = {};
      }

      if (discoveredMap[folder]) {
        for (const langId in discoveredMap[folder]) {
          ex.variants[langId] = { ...discoveredMap[folder][langId] };
        }
      }
    });
  });
}

export const exercises: Exercise[] = curriculum.flatMap(c => c.exercises);

// Attach discovered variants automatically
attachDiscoveredVariants(curriculum);

export const getExercise = (id: string) => {
  return exercises.find(e => e.id === id) || exercises[0];
};
