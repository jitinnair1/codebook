/**
 * src/core/clipboard.ts
 * Sanitized clipboard utility to prevent Trojan Source attacks,
 * hidden BiDi control character injection, and terminal ANSI exploits.
 */

/**
 * Strips dangerous bidirectional override characters (Trojan Source attacks),
 * invisible zero-width characters, ANSI terminal escapes, and non-printable control characters.
 */
export function sanitizeForClipboard(text: string): string {
    if (!text) return '';

    return text
        // Strip ANSI terminal escape sequences
        .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
        // Strip Unicode bidirectional override and isolate characters (\u202A-\u202E, \u2066-\u2069, \u200E-\u200F)
        .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
        // Strip zero-width invisible characters (\u200B-\u200D, \uFEFF)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // Strip other non-printable ASCII control characters except \t (\x09), \n (\x0A), \r (\x0D)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Safely writes text to the system clipboard after stripping malicious control characters.
 */
export async function copyToClipboardSafe(text: string): Promise<boolean> {
    try {
        const sanitized = sanitizeForClipboard(text);
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(sanitized);
            return true;
        } else {
            // Fallback for older browsers or non-secure contexts
            const textarea = document.createElement('textarea');
            textarea.value = sanitized;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            textarea.style.top = '-999999px';
            textarea.setAttribute('readonly', '');
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            return successful;
        }
    } catch (err) {
        console.error('[clipboard] Failed to copy text safely:', err);
        return false;
    }
}
