// src/core/ai/context.ts
import { store } from '../store';
import { exercises } from '../../exercises/exercise-registry';
import { getExerciseVariant } from '../types';
import { getCode } from '../editor';
import { elements } from '../elements';

export interface PromptContext {
  systemPrompt: string;
  exerciseId: string;
  exerciseTitle: string;
  languageId: string;
}

/**
 * Builds the comprehensive mentor system prompt containing the active problem statement,
 * active user code, test harness, runtime console output, and pedagogical instructions.
 */
export function buildSystemPrompt(): PromptContext {
  const { currentExerciseId, currentLanguageId } = store.getState();
  const currentEx = exercises.find(e => e.id === currentExerciseId);

  const exerciseTitle = currentEx?.title || 'Unknown Exercise';
  const exerciseDesc = currentEx?.description || '';
  const variant = currentEx ? getExerciseVariant(currentEx, currentLanguageId) : null;

  const starterCode = variant?.initialCode || '';
  const testCode = variant?.testCode || '';
  const userCode = getCode() || starterCode;

  // Retrieve current console output, omitting default placeholder text
  let consoleOutput = elements.console?.textContent?.trim() || '';
  if (consoleOutput === '// Ready...') {
    consoleOutput = '';
  }

  const systemPrompt = `You are an encouraging, expert mentor and pair programmer.
Your mission is to help the learner understand programming concepts, diagnose bugs, and reason through problems on their own.

CRITICAL RULES (NON-SPOILING POLICY):
1. NEVER provide the complete solution code, full function implementation, or copy-paste code blocks that solve the exercise for the learner.
2. If the learner asks "Give me the answer", "Solve it for me", or similar, politely decline and offer a guiding question or hint instead.
3. Diagnose where the learner's mental model or code is diverging. Explain compiler/interpreter errors in simple, accessible language without jargon.
4. When illustrating concepts, only show short (1-3 line) generic syntax examples—never the specific answer to the problem.
5. Guide the learner step-by-step. Keep explanations concise, practical, and encourage them to test small hypotheses.
6. Format your output in clean Markdown. Use standard code blocks (\`\`\`${currentLanguageId}) and KaTeX math notation ($...$ or $$...$$) where applicable.

ACTIVE WORKSPACE CONTEXT:
<problem_statement id="${currentExerciseId}" title="${escapeXml(exerciseTitle)}" language="${currentLanguageId}">
${exerciseDesc}
</problem_statement>

<starter_code language="${currentLanguageId}">
${starterCode}
</starter_code>

<user_active_code language="${currentLanguageId}">
${userCode}
</user_active_code>

<test_harness language="${currentLanguageId}">
${testCode || 'Standard validation assertions'}
</test_harness>

<recent_console_output>
${consoleOutput || 'No output recorded yet (code has not been run or console was cleared).'}
</recent_console_output>`;

  return {
    systemPrompt,
    exerciseId: currentExerciseId,
    exerciseTitle,
    languageId: currentLanguageId,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
