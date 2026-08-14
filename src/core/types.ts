export interface LanguageVariant {
    initialCode: string;
    testCode: string;
    solutionCode?: string;
    validate?: (code: string, output: string) => true | string;
}

export interface Exercise {
    id: string;
    title: string;
    description: string;
    initialCode?: string;
    testCode?: string;
    solutionCode?: string;
    validate?: (code: string, output: string) => true | string;
    variants?: Record<string, LanguageVariant>;
}

export function getExerciseVariant(exercise: Exercise, langId: string): LanguageVariant {
    if (exercise.variants && exercise.variants[langId]) {
        return exercise.variants[langId];
    }
    return {
        initialCode: exercise.initialCode || '',
        testCode: exercise.testCode || '',
        solutionCode: exercise.solutionCode || '',
        validate: exercise.validate,
    };
}

export interface Chapter {
    id: string;
    title: string;

    exercises: Exercise[];
}

export interface ExecutionResult {
    success: boolean;
    output: string;
    error?: string;
}

export type WorkerRequest = {
    type: 'RUN';
    id: string;
    userCode: string;
    testCode?: string;
};

export type WorkerResponse = {
    type: 'RESULT';
    id: string;
    success: boolean;
    output: string;
    error?: string;
};

export type RunnerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CodeRunner {
    name: string;
    getStatus?(): RunnerStatus;
    isReady(): Promise<boolean>;
    whenReady?(): Promise<void>;
    getInitError?(): string | null;
    subscribeStatus?(listener: (status: RunnerStatus, error?: string | null) => void): () => void;
    run(userCode: string, testCode?: string): Promise<ExecutionResult>;
    terminate?(): void;
}