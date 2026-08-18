export interface LanguageVariant {
    initialCode: string;
    testCode: string;
    solutionCode?: string;
    validatorCode?: string;
    validate?: (code: string, output: string) => true | string;
}

export interface Exercise {
    id: string;
    title: string;
    description: string;
    variants?: Record<string, LanguageVariant>;
}

export function getExerciseVariant(exercise: Exercise, langId: string): LanguageVariant {
    return exercise.variants?.[langId] || {
        initialCode: '',
        testCode: '',
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


export type RunnerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CodeRunner {
    name: string;
    getStatus?(): RunnerStatus;
    isReady(): Promise<boolean>;
    whenReady?(): Promise<void>;
    getInitError?(): string | null;
    subscribeStatus?(listener: (status: RunnerStatus, error?: string | null) => void): () => void;
    run(userCode: string, testCode?: string): Promise<ExecutionResult>;
    lint?(code: string): Promise<any>;
    reset?(): Promise<void> | void;
    terminate?(): void;
}

// Chat Domain Types
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface ChatConversation {
    id: string;
    exerciseId: string;
    languageId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
    unread?: boolean;
}

export interface ChatEndpoint {
    id: string;
    name?: string;
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface ChatSettings {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    model: string;
    selectedEndpointId: string;
    endpoints: ChatEndpoint[];
}

export const defaultChatSettings: ChatSettings = {
    enabled: false,
    baseUrl: '',
    apiKey: '',
    model: '',
    selectedEndpointId: 'default-endpoint',
    endpoints: [
        {
            id: 'default-endpoint',
            name: '',
            baseUrl: '',
            apiKey: '',
            model: '',
        },
    ],
};

export interface GistSyncSettings {
    enabled: boolean;
    token: string;
    gistId: string;
    autoSync: boolean;
    lastSyncedAt?: number;
}

export const defaultGistSyncSettings: GistSyncSettings = {
    enabled: false,
    token: '',
    gistId: '',
    autoSync: true,
};

// Store Slices & Combined AppState
export interface ExerciseSlice {
    currentExerciseId: string;
    currentLanguageId: string;
    completedIds: string[];
    userCode: Record<string, string>;
    vimMode: boolean;
    markComplete: (id: string) => void;
    setCurrent: (id: string) => void;
    setLanguage: (langId: string) => void;
    saveUserCode: (exerciseId: string, languageId: string, code: string) => void;
    getUserCode: (exerciseId: string, languageId: string) => string | undefined;
    setVimMode: (enabled: boolean) => void;
}

export interface ChatSlice {
    chatConversations: Record<string, ChatConversation[]>;
    activeConversationId: Record<string, string>;
    createConversation: (exerciseId: string, languageId: string, title?: string) => string;
    setActiveConversation: (exerciseId: string, conversationId: string) => void;
    updateConversationLanguage: (exerciseId: string, conversationId: string, languageId: string) => void;
    updateConversationTitle: (exerciseId: string, conversationId: string, title: string) => void;
    deleteConversation: (exerciseId: string, conversationId: string) => void;
    getActiveConversation: (exerciseId: string) => ChatConversation | undefined;
    addChatMessage: (exerciseId: string, message: ChatMessage, conversationId?: string) => void;
    clearChatHistory: (exerciseId: string, conversationId?: string) => void;
}

export interface SettingsSlice {
    chatSettings: ChatSettings;
    setChatSettings: (settings: Partial<ChatSettings>) => void;
}

export interface SyncSlice {
    gistSyncSettings: GistSyncSettings;
    setGistSyncSettings: (settings: Partial<GistSyncSettings>) => void;
    unlinkGist: () => void;
}

export interface BackupSlice {
    resetProgress: () => void;
    restoreBackup: (backupState: Partial<AppState>) => void;
}

export type AppState = ExerciseSlice & ChatSlice & SettingsSlice & SyncSlice & BackupSlice;