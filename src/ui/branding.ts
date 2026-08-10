import siteConfig from '../../site.toml';
import { elements } from '../core/elements';

export function initBranding() {
    document.title = siteConfig.headline || siteConfig.title;

    if (elements.branding.logo) {
        if (siteConfig.logo_image) {
            elements.branding.logo.innerHTML = `<img src="${siteConfig.logo_image}" alt="Logo" class="h-8 w-auto" />`;
        } else {
            elements.branding.logo.textContent = siteConfig.logo_emoji || "📓";
        }
    }

    if (elements.branding.title) elements.branding.title.textContent = siteConfig.title;
    if (elements.branding.subtitle) elements.branding.subtitle.textContent = siteConfig.subtitle;
}
