import type { ExecutionResult } from '../core/types';
import type { DiagnosticItem } from './types';

// ============================================================================
// Host -> Worker Messages (Inbound)
// ============================================================================

export interface WorkerInitMessage {
  type: 'INIT';
}

export interface WorkerRunMessage {
  type: 'RUN';
  id: string;
  userCode: string;
  testCode?: string;
}

export interface WorkerLintMessage {
  type: 'LINT';
  id: string;
  code: string;
}

export interface WorkerResetMessage {
  type: 'RESET';
  id?: string;
}

export interface WorkerCancelMessage {
  type: 'CANCEL';
  id: string;
}

export type WorkerInboundMessage =
  | WorkerInitMessage
  | WorkerRunMessage
  | WorkerLintMessage
  | WorkerResetMessage
  | WorkerCancelMessage;

// ============================================================================
// Worker -> Host Messages (Outbound)
// ============================================================================

export interface WorkerReadyMessage {
  type: 'READY';
}

export interface WorkerInitErrorMessage {
  type: 'INIT_ERROR';
  error: string;
}

export interface WorkerResultMessage {
  type: 'RESULT';
  id: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface WorkerLintResultMessage {
  type: 'LINT_RESULT';
  id: string;
  diagnostics: DiagnosticItem[];
}

export interface WorkerResetDoneMessage {
  type: 'RESET_DONE';
  id?: string;
}

export type WorkerOutboundMessage =
  | WorkerReadyMessage
  | WorkerInitErrorMessage
  | WorkerResultMessage
  | WorkerLintResultMessage
  | WorkerResetDoneMessage;

// Re-export common types for message handlers
export type { ExecutionResult, DiagnosticItem };
