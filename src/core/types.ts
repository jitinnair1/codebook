export interface LanguageVariant {
    initialCode: string;
    testCode: string;
    validate?: (code: string, output: string) => true | string;
}

export interface Exercise {
    id: string;
    title: string;
    description: string;
    initialCode?: string;
    testCode?: string;
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

export interface CodeRunner {
    name: string;
    isReady(): Promise<boolean>;
    getInitError?(): string | null;
    run(userCode: string, testCode?: string): Promise<ExecutionResult>;
    terminate?(): void;
}