export const elements = {
    //problem description
    description: {
        desktop: document.getElementById('ex-desc-desktop') as HTMLElement,
        mobile: document.getElementById('ex-desc-desktop') as HTMLElement,
    },

    //sidebar
    sidebar: {
        list: document.getElementById('sidebar-list') as HTMLElement,
        toggle: document.getElementById('sidebar-toggle') as HTMLButtonElement,
        nav: document.getElementById('sidebar-nav') as HTMLElement,
    },

    //problem and editor panels
    problemAndChatPanel: document.getElementById('problem-and-chat-panel') as HTMLElement,
    editorConsolePanel: document.getElementById('editor-and-console-panel') as HTMLElement,
    console: document.getElementById('console-output') as HTMLElement,
    status: document.getElementById('status') as HTMLElement,
    statusDot: document.getElementById('status-dot') as HTMLElement,

    //buttons
    runBtn: document.getElementById('run-btn') as HTMLButtonElement,
    resetBtn: document.getElementById('reset-btn') as HTMLButtonElement,
    clearConsoleBtn: document.getElementById('clear-console-btn') as HTMLButtonElement,
    shortcutsBtn: document.getElementById('shortcuts-btn') as HTMLButtonElement,
    speedrunBtn: document.getElementById('speedrun-btn') as HTMLButtonElement,
    settingsBtn: document.getElementById('settings-btn') as HTMLButtonElement,
    resetProgressBtn: document.getElementById('reset-progress-btn') as HTMLButtonElement,
    languageSelectorContainer: document.getElementById('language-selector-container') as HTMLElement,

    //shortcuts modal
    shortcuts: {
        modal: document.getElementById('shortcuts-modal') as HTMLElement,
        closeBtn: document.getElementById('close-shortcuts-btn') as HTMLButtonElement,
        list: document.getElementById('shortcuts-list') as HTMLElement,
    },

    //settings modal
    settings: {
        modal: document.getElementById('settings-modal') as HTMLElement,
        closeBtn: document.getElementById('close-settings-btn') as HTMLButtonElement,
        content: document.getElementById('settings-content') as HTMLElement,
        vimToggle: document.getElementById('vim-mode-toggle') as HTMLInputElement,
        chatToggle: document.getElementById('chat-mode-toggle') as HTMLInputElement,
        chatFields: document.getElementById('chat-settings-fields') as HTMLElement,
        endpointSection: document.getElementById('chat-endpoint-section') as HTMLElement,
        refreshModelsBtn: document.getElementById('refresh-models-btn') as HTMLButtonElement,
        chatModelContainer: document.getElementById('chat-model-container') as HTMLElement,
        exportBackupBtn: document.getElementById('export-backup-btn') as HTMLButtonElement,
        exportBackupIcon: document.getElementById('export-backup-icon') as HTMLElement,
        importBackupBtn: document.getElementById('import-backup-btn') as HTMLButtonElement,
        importBackupIcon: document.getElementById('import-backup-icon') as HTMLElement,
        importBackupInput: document.getElementById('import-backup-input') as HTMLInputElement,
        includeKeysCheckbox: document.getElementById('backup-include-keys') as HTMLInputElement,
        backupStatusMsg: document.getElementById('backup-status-msg') as HTMLElement,
    },

    //reset progress modal
    resetProgress: {
        modal: document.getElementById('reset-progress-modal') as HTMLElement,
        closeBtn: document.getElementById('close-reset-progress-btn') as HTMLButtonElement,
        cancelBtn: document.getElementById('cancel-reset-progress-btn') as HTMLButtonElement,
        confirmBtn: document.getElementById('confirm-reset-progress-btn') as HTMLButtonElement,
    },

    //speedrun modal (dev)
    speedrun: {
        modal: document.getElementById('speedrun-modal') as HTMLElement,
        closeBtn: document.getElementById('close-speedrun-btn') as HTMLButtonElement,
        headerIcon: document.getElementById('speedrun-header-icon') as HTMLElement,
        langSelect: document.getElementById('speedrun-lang-select') as HTMLSelectElement,
        startBtn: document.getElementById('speedrun-start-btn') as HTMLButtonElement,
        startBtnText: document.getElementById('speedrun-start-btn-text') as HTMLElement,
        exportBtn: document.getElementById('speedrun-export-btn') as HTMLButtonElement,
        exportIcon: document.getElementById('speedrun-export-icon') as HTMLElement,
        exportText: document.getElementById('speedrun-export-text') as HTMLElement,
        progressContainer: document.getElementById('speedrun-progress-container') as HTMLElement,
        progressBar: document.getElementById('speedrun-progress-bar') as HTMLElement,
        progressStatus: document.getElementById('speedrun-progress-status') as HTMLElement,
        progressCounter: document.getElementById('speedrun-progress-counter') as HTMLElement,
        statusFilters: document.getElementById('speedrun-status-filters') as HTMLElement,
        stats: {
            all: document.getElementById('stat-all') as HTMLElement,
            passed: document.getElementById('stat-passed') as HTMLElement,
            failed: document.getElementById('stat-failed') as HTMLElement,
            errors: document.getElementById('stat-errors') as HTMLElement,
            missing: document.getElementById('stat-missing') as HTMLElement,
            time: document.getElementById('stat-time') as HTMLElement,
        },
        sortBtn: document.getElementById('speedrun-sort-btn') as HTMLButtonElement,
        sortIcon: document.getElementById('speedrun-sort-icon') as HTMLElement,
        sortLabel: document.getElementById('speedrun-sort-label') as HTMLElement,
        resultsList: document.getElementById('speedrun-results-list') as HTMLElement,
    },

    //navigation and tabs
    nav: {
        prev: document.getElementById('nav-prev') as HTMLButtonElement,
        next: document.getElementById('nav-next') as HTMLButtonElement,
    },
    tabs: {
        problem: document.getElementById('tab-problem') as HTMLButtonElement,
        code: document.getElementById('tab-code') as HTMLButtonElement,
    },

    //resize handles and panes
    resize: {
        paneProblem: document.getElementById('problem-and-chat-panel') as HTMLElement,
        paneConsole: document.getElementById('pane-console') as HTMLElement,
        dragHDesktop: document.getElementById('drag-h-desktop') as HTMLElement,
        dragVConsole: document.getElementById('drag-v-console') as HTMLElement,
    },

    //progress bar
    progressContainer: document.getElementById('progress-container') as HTMLElement,

    //branding
    branding: {
        brandLink: document.getElementById('header-brand') as HTMLAnchorElement,
        logo: document.getElementById('header-logo') as HTMLElement,
        title: document.getElementById('header-title') as HTMLElement,
        subtitle: document.getElementById('header-subtitle') as HTMLElement,
    },

    //Rubber Duck Chat (Unified Flow)
    chat: {
        scrollContainer: document.getElementById('problem-and-chat-scroll') as HTMLElement,
        section: document.getElementById('chat-section') as HTMLElement,
        inputContainer: document.getElementById('chat-input-container') as HTMLElement,
        clearBtn: document.getElementById('clear-chat-btn') as HTMLButtonElement,
        messages: document.getElementById('chat-messages') as HTMLElement,
        quickChips: document.getElementById('chat-quick-chips') as HTMLElement,
        input: document.getElementById('chat-input') as HTMLTextAreaElement,
        sendBtn: document.getElementById('chat-send-btn') as HTMLButtonElement,
    },
};
