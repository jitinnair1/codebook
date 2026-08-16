import { exercises } from '../exercises/exercise-registry';
import { getExerciseVariant, Exercise } from './types';
import { loadLanguageRunner } from '../languages/language-registry';

export type VerificationStatus = 'passed' | 'failed' | 'error' | 'missing_solution';

export interface VerificationItemResult {
  exerciseId: string;
  exerciseTitle: string;
  languageId: string;
  description?: string;
  solutionCode?: string;
  testCode?: string;
  status: VerificationStatus;
  durationMs: number;
  error?: string;
  output?: string;
}

export interface VerificationProgress {
  current: number;
  total: number;
  currentItem?: {
    exerciseId: string;
    exerciseTitle: string;
    languageId: string;
  };
  latestResult?: VerificationItemResult;
}

export interface VerificationReport {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  errors: number;
  missingSolutions: number;
  totalDurationMs: number;
  results: VerificationItemResult[];
}

export interface VerificationOptions {
  languageId?: string;
  exerciseIds?: string[];
  onProgress?: (progress: VerificationProgress) => void;
  shouldAbort?: () => boolean;
}

export async function verifySingleExercise(
  exercise: Exercise,
  languageId: string
): Promise<VerificationItemResult> {
  const variant = getExerciseVariant(exercise, languageId);
  const baseResult: Omit<VerificationItemResult, 'status' | 'durationMs'> = {
    exerciseId: exercise.id,
    exerciseTitle: exercise.title,
    languageId,
    description: exercise.description,
    solutionCode: variant.solutionCode || '',
    testCode: variant.testCode || ''
  };

  if (!variant.solutionCode || !variant.solutionCode.trim()) {
    return {
      ...baseResult,
      status: 'missing_solution',
      durationMs: 0,
      error: 'No solution file found for this language variant.'
    };
  }

  const startTime = performance.now();

  try {
    const runner = await loadLanguageRunner(languageId);
    const testCode = variant.testCode || '';
    const result = await runner.run(variant.solutionCode, testCode);
    const durationMs = Math.round(performance.now() - startTime);

    const isAssertionFailure =
      Boolean(result.output && result.output.includes('Test failed:')) ||
      Boolean(result.error && result.error.includes('Test failed:'));

    if (!result.success || isAssertionFailure) {
      return {
        ...baseResult,
        status: isAssertionFailure ? 'failed' : 'error',
        durationMs,
        output: result.output,
        error: result.error || (isAssertionFailure ? 'Test suite reported test failure.' : 'Execution failed')
      };
    }

    // Custom structural / output validator
    if (variant.validate) {
      const validationResult = variant.validate(variant.solutionCode, result.output);
      if (validationResult !== true) {
        return {
          ...baseResult,
          status: 'failed',
          durationMs,
          output: result.output,
          error: typeof validationResult === 'string' ? validationResult : 'Custom validation failed'
        };
      }
    }

    return {
      ...baseResult,
      status: 'passed',
      durationMs,
      output: result.output
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    const errMessage = err?.message || String(err);
    const isAssertionFailure = errMessage.includes('Test failed:');
    return {
      ...baseResult,
      status: isAssertionFailure ? 'failed' : 'error',
      durationMs,
      error: errMessage
    };
  }
}

export async function runVerification(options: VerificationOptions = {}): Promise<VerificationReport> {
  const { languageId, exerciseIds, onProgress, shouldAbort } = options;

  // Build target list of (exercise, langId) pairs
  const targetExercises = exerciseIds && exerciseIds.length > 0
    ? exercises.filter(e => exerciseIds.includes(e.id))
    : exercises;

  const queue: Array<{ exercise: Exercise; languageId: string }> = [];

  for (const ex of targetExercises) {
    const availableLangs = Object.keys(ex.variants || {});
    const targetLangs = languageId
      ? (availableLangs.includes(languageId) ? [languageId] : [])
      : availableLangs;

    for (const lang of targetLangs) {
      queue.push({ exercise: ex, languageId: lang });
    }
  }

  // Pre-warm distinct language runners concurrently
  const distinctLangs = Array.from(new Set(queue.map(q => q.languageId)));
  await Promise.all(
    distinctLangs.map(async (lang) => {
      try {
        const runner = await loadLanguageRunner(lang);
        if (runner.whenReady) {
          await runner.whenReady();
        } else {
          await runner.isReady();
        }
      } catch {
        // Runner errors will be reported on test execution
      }
    })
  );

  const results: VerificationItemResult[] = [];
  const startOverall = performance.now();

  for (let i = 0; i < queue.length; i++) {
    if (shouldAbort && shouldAbort()) {
      break;
    }

    const { exercise, languageId: lang } = queue[i];

    onProgress?.({
      current: i + 1,
      total: queue.length,
      currentItem: {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        languageId: lang
      }
    });

    const itemResult = await verifySingleExercise(exercise, lang);
    results.push(itemResult);

    onProgress?.({
      current: i + 1,
      total: queue.length,
      currentItem: {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        languageId: lang
      },
      latestResult: itemResult
    });
  }

  const totalDurationMs = Math.round(performance.now() - startOverall);

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const errors = results.filter(r => r.status === 'error').length;
  const missingSolutions = results.filter(r => r.status === 'missing_solution').length;

  return {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    errors,
    missingSolutions,
    totalDurationMs,
    results
  };
}
