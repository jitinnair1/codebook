export const elements = {
    //problem descriptions (mobile and desktop)
    description: {
        desktop: document.getElementById('ex-desc-desktop') as HTMLElement,
        mobile: document.getElementById('ex-desc-mobile') as HTMLElement,
    },

    //sidebar
    sidebar: {
        list: document.getElementById('sidebar-list') as HTMLElement,
        toggle: document.getElementById('sidebar-toggle') as HTMLButtonElement,
        nav: document.getElementById('sidebar-nav') as HTMLElement,
    },

    //editor and console
    editorConsolePanel: document.getElementById('editor-and-console-panel') as HTMLElement,
    console: document.getElementById('console-output') as HTMLElement,
    status: document.getElementById('status') as HTMLElement,

    //buttons
    runBtn: document.getElementById('run-btn') as HTMLButtonElement,
    resetBtn: document.getElementById('reset-btn') as HTMLButtonElement,
    clearConsoleBtn: document.getElementById('clear-console-btn') as HTMLButtonElement,
    shortcutsBtn: document.getElementById('shortcuts-btn') as HTMLButtonElement,
    resetProgressBtn: document.getElementById('reset-progress-btn') as HTMLButtonElement,
    languageSelectorContainer: document.getElementById('language-selector-container') as HTMLElement,

    //shortcuts modal
    shortcuts: {
        modal: document.getElementById('shortcuts-modal') as HTMLElement,
        closeBtn: document.getElementById('close-shortcuts-btn') as HTMLButtonElement,
        list: document.getElementById('shortcuts-list') as HTMLElement,
    },

    //reset progress modal
    resetProgress: {
        modal: document.getElementById('reset-progress-modal') as HTMLElement,
        closeBtn: document.getElementById('close-reset-progress-btn') as HTMLButtonElement,
        cancelBtn: document.getElementById('cancel-reset-progress-btn') as HTMLButtonElement,
        confirmBtn: document.getElementById('confirm-reset-progress-btn') as HTMLButtonElement,
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
        paneProblem: document.getElementById('ex-desc-desktop') as HTMLElement,
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
    }
};
