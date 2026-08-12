import siteConfig from '../../site.toml';
import { elements } from '../core/elements';

export function initBranding() {
    const { title, subtitle, headline, logo_image, logo_emoji } = siteConfig;

    document.title = headline || (subtitle ? `${title} | ${subtitle}` : title);

    if (elements.branding.logo) {
        if (logo_image) {
            elements.branding.logo.innerHTML = `<img src="${logo_image}" alt="Logo" class="h-8 w-auto" />`;
        } else {
            elements.branding.logo.textContent = logo_emoji;
        }
    }

    if (elements.branding.title) elements.branding.title.textContent = title;
    if (elements.branding.subtitle) elements.branding.subtitle.textContent = subtitle;
}
