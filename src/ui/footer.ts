import { siteConfig } from "../core/siteConfig";

export function renderFooter() {
    const footer = document.getElementById("footer");
    if (!footer) return;
    const projectUrl = siteConfig.project_url || 'https://github.com';
    footer.innerHTML = `
        <div class="flex flex-wrap justify-center items-center gap-4 sm:gap-8">
            <span class="text-xs text-fg-muted">
                <a href="${projectUrl}" target="_blank">Star on GitHub</a>
            </span>
            <span class="text-xs text-fg-muted">
                <a href="${projectUrl}/issues" target="_blank">Report an Error</a>
            </span>
            <span id="build-date" class="w-full sm:w-auto text-xs text-fg-muted order-last text-center">
              Last updated on ${BUILD_DATE}
            </span>
        </div>
    `;
}