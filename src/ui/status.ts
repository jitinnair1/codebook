export const status = {
    element: document.getElementById('status') as HTMLElement,
    dot: document.getElementById('status-dot') as HTMLElement,

    setLoading(message = "Loading...") {
        if (this.element) {
            this.element.textContent = message;
            this.element.className = "text-xs font-mono text-yellow-500 text-right max-w-24 md:max-w-40 truncate";
        }
        if (this.dot) {
            this.dot.className = "w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0";
        }
    },

    setRunning() {
        if (this.element) {
            this.element.textContent = "Running...";
            this.element.className = "text-yellow-500 text-xs font-mono animate-pulse text-right max-w-24 md:max-w-40 truncate";
        }
        if (this.dot) {
            this.dot.className = "w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0";
        }
    },

    setPassed() {
        if (this.element) {
            this.element.textContent = "PASSED";
            this.element.className = "text-green-500 font-bold text-xs text-right max-w-24 md:max-w-40 truncate";
        }
        if (this.dot) {
            this.dot.className = "w-2 h-2 rounded-full bg-green-500 shrink-0";
        }
    },

    setFailed() {
        if (this.element) {
            this.element.textContent = "FAILED";
            this.element.className = "text-red-500 font-bold text-xs text-right max-w-24 md:max-w-40 truncate";
        }
        if (this.dot) {
            this.dot.className = "w-2 h-2 rounded-full bg-red-500 shrink-0";
        }
    },

    setError(message = "ERROR") {
        if (this.element) {
            this.element.textContent = message;
            this.element.className = "text-red-600 font-bold text-xs text-right max-w-24 md:max-w-40 truncate";
        }
        if (this.dot) {
            this.dot.className = "w-2 h-2 rounded-full bg-red-600 shrink-0";
        }
    },

    setReady() {
        if (this.element) {
            this.element.textContent = "Ready";
            this.element.className = "text-green-600 text-xs font-mono text-right max-w-24 md:max-w-40 truncate";
        }
        if (this.dot) {
            this.dot.className = "w-2 h-2 rounded-full bg-green-600 shrink-0";
        }
    }
};

