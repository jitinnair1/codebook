import type { DiagnosticItem } from './types';

export interface SourceSpan {
  startLine: number;
  endLine: number;
  lineCount: number;
}

export interface CombinedSourceInfo {
  combinedCode: string;
  harnessSpan: SourceSpan;
  userSpan: SourceSpan;
  testSpan: SourceSpan;
}

/**
 * Combines harness code, user code, and test code, tracking exact line boundaries
 * for precise diagnostic error remapping.
 */
export function combineSourceWithSpans(
  harness: string,
  userCode: string,
  testCode = '',
  delimiter = '\n'
): CombinedSourceInfo {
  const harnessTrimmed = harness ? harness.trimEnd() : '';
  const userTrimmed = userCode ? userCode.trimEnd() : '';
  const testTrimmed = testCode ? testCode.trimEnd() : '';

  const harnessLines = harnessTrimmed ? harnessTrimmed.split('\n').length : 0;
  const userLines = userTrimmed ? userTrimmed.split('\n').length : 0;
  const testLines = testTrimmed ? testTrimmed.split('\n').length : 0;

  const parts: string[] = [];
  let currentLine = 1;

  let harnessSpan: SourceSpan = { startLine: 0, endLine: 0, lineCount: 0 };
  let userSpan: SourceSpan = { startLine: 1, endLine: 1, lineCount: 0 };
  let testSpan: SourceSpan = { startLine: 0, endLine: 0, lineCount: 0 };

  if (harnessTrimmed) {
    parts.push(harnessTrimmed);
    harnessSpan = {
      startLine: currentLine,
      endLine: currentLine + harnessLines - 1,
      lineCount: harnessLines
    };
    currentLine += harnessLines;
  }

  if (userTrimmed) {
    parts.push(userTrimmed);
    userSpan = {
      startLine: currentLine,
      endLine: currentLine + userLines - 1,
      lineCount: userLines
    };
    currentLine += userLines;
  } else {
    userSpan = {
      startLine: currentLine,
      endLine: currentLine,
      lineCount: 1
    };
  }

  if (testTrimmed) {
    parts.push(testTrimmed);
    testSpan = {
      startLine: currentLine,
      endLine: currentLine + testLines - 1,
      lineCount: testLines
    };
  }

  return {
    combinedCode: parts.join(delimiter),
    harnessSpan,
    userSpan,
    testSpan
  };
}

/**
 * Maps a 1-based line number from combined source back to the user code's 1-based line number.
 */
export function mapCombinedLineToUser(
  rawLine: number,
  harnessLineCount: number,
  userLineCount?: number
): { line: number; isUserCode: boolean; isTestCode: boolean } {
  if (harnessLineCount > 0 && rawLine <= harnessLineCount) {
    return { line: 1, isUserCode: false, isTestCode: false };
  }

  const offsetLine = harnessLineCount > 0 ? rawLine - harnessLineCount : rawLine;

  if (userLineCount !== undefined && offsetLine > userLineCount) {
    return {
      line: offsetLine - userLineCount,
      isUserCode: false,
      isTestCode: true
    };
  }

  return {
    line: Math.max(1, offsetLine),
    isUserCode: true,
    isTestCode: false
  };
}

/**
 * Normalizes a DiagnosticItem ensuring proper 1-based coordinates and valid severity.
 */
export function normalizeDiagnostic(
  diag: Partial<DiagnosticItem>,
  defaultSource = 'linter'
): DiagnosticItem {
  return {
    line: diag.line !== undefined ? Math.max(1, diag.line) : undefined,
    column: diag.column !== undefined ? Math.max(1, diag.column) : undefined,
    endLine: diag.endLine !== undefined ? Math.max(1, diag.endLine) : diag.line,
    endColumn: diag.endColumn !== undefined ? Math.max(1, diag.endColumn) : (diag.column !== undefined ? diag.column + 1 : undefined),
    from: diag.from !== undefined ? Math.max(0, diag.from) : undefined,
    to: diag.to !== undefined ? Math.max(0, diag.to) : undefined,
    message: diag.message || 'Syntax error',
    severity: diag.severity === 'warning' || diag.severity === 'info' ? diag.severity : 'error',
    source: diag.source || defaultSource
  };
}
