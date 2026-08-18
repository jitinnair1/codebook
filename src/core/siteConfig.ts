// src/core/siteConfig.ts
import rawSiteConfig from '../../site.toml';

export interface SiteConfig {
    title?: string;
    subtitle?: string;
    headline?: string;
    description?: string;
    keywords?: string;
    project_url?: string;
    author_url?: string;
    logo_emoji?: string;
    logo_image?: string;
    og_image?: string;
    default_language?: string;
    languages?: string[];
    [key: string]: any;
}

export const siteConfig: SiteConfig = rawSiteConfig || {};

export const SITE_TITLE: string = siteConfig.title || 'codebook';
export const SITE_SLUG: string =
    SITE_TITLE.toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'codebook';
export const SITE_SUBTITLE: string = siteConfig.subtitle || '';

export default siteConfig;
