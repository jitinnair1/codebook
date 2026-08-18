import { siteConfig, SITE_TITLE } from '../core/siteConfig';
import { elements } from '../core/elements';

export function initBranding() {
    const { title, subtitle, headline, logo_image, logo_emoji } = siteConfig;
    const resolvedTitle = title || SITE_TITLE;

    document.title = headline || (subtitle ? `${resolvedTitle} | ${subtitle}` : resolvedTitle);

    if (elements.branding.logo) {
        if (logo_image) {
            elements.branding.logo.innerHTML = `<img src="${logo_image}" alt="Logo" class="h-8 w-auto" />`;
        } else if (logo_emoji) {
            elements.branding.logo.textContent = logo_emoji;
        }
    }

    if (elements.branding.title) {
        elements.branding.title.textContent = resolvedTitle;
    }
    if (elements.branding.subtitle && subtitle) {
        elements.branding.subtitle.textContent = subtitle;
    }
}

