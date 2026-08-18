export const layoutElements = {
    // Problem description
    description: {
        desktop: document.getElementById('ex-desc-desktop') as HTMLElement,
    },

    // Sidebar
    sidebar: {
        list: document.getElementById('sidebar-list') as HTMLElement,
        toggle: document.getElementById('sidebar-toggle') as HTMLButtonElement,
        nav: document.getElementById('sidebar-nav') as HTMLElement,
    },

    // Problem and editor panels
    problemAndChatPanel: document.getElementById('problem-and-chat-panel') as HTMLElement,
    editorConsolePanel: document.getElementById('editor-and-console-panel') as HTMLElement,
    console: document.getElementById('console-output') as HTMLElement,
    status: document.getElementById('status') as HTMLElement,
    statusDot: document.getElementById('status-dot') as HTMLElement,

    // Navigation and tabs
    nav: {
        prev: document.getElementById('nav-prev') as HTMLButtonElement,
        next: document.getElementById('nav-next') as HTMLButtonElement,
    },
    tabs: {
        problem: document.getElementById('tab-problem') as HTMLButtonElement,
        code: document.getElementById('tab-code') as HTMLButtonElement,
    },

    // Resize handles and panes
    resize: {
        paneProblem: document.getElementById('problem-and-chat-panel') as HTMLElement,
        paneConsole: document.getElementById('pane-console') as HTMLElement,
        dragHDesktop: document.getElementById('drag-h-desktop') as HTMLElement,
        dragVConsole: document.getElementById('drag-v-console') as HTMLElement,
    },

    // Progress bar container
    progressContainer: document.getElementById('progress-container') as HTMLElement,
};
