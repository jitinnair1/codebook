import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { readFileSync, copyFileSync, existsSync } from "node:fs";
import { parse } from "toml";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";

const buildDate = new Date().toLocaleDateString(undefined, {
  year: "numeric",
  month: "long",
  day: "2-digit",
});

function rawTextPlugin(): Plugin {
  const cache = new Map<string, string>();

  return {
    name: "vite-raw-text",
    enforce: "pre",
    async resolveId(source, importer) {
      if (source.endsWith(".md") && !source.includes('?') && importer) {
        const resolved = await this.resolve(source, importer);
        if (resolved) {
          const virtualId = resolved.id + "\0__raw__";
          cache.set(virtualId, resolved.id);
          return { id: virtualId, moduleSideEffects: true };
        }
      }
    },
    load(id) {
      if (id.endsWith("__raw__")) {
        const realPath = cache.get(id) || id.replace(/\0__raw__$/, "");
        try {
          const content = readFileSync(realPath, "utf-8");
          return `export default ${JSON.stringify(content)};`;
        } catch (e) {
          console.error(`[raw-text] Failed to load ${realPath}:`, e);
          return `export default "";`;
        }
      }
      return null;
    },
  };
}

function yamlPlugin(): Plugin {
  const cache = new Map<string, string>();

  return {
    name: "vite-yaml-plugin",
    enforce: "pre" as const,
    async resolveId(source: string, importer: string | undefined) {
      if ((!source.endsWith(".yaml") && !source.endsWith(".yml")) || !importer) return;
      const resolved = await this.resolve(source, importer);
      if (resolved) {
        const virtualId = resolved.id + "\0__yaml__";
        cache.set(virtualId, resolved.id);
        return { id: virtualId, moduleSideEffects: true };
      }
    },
    load(id: string) {
      if (id.endsWith("__yaml__")) {
        const realPath = cache.get(id) || id.replace(/\0__yaml__$/, "");
        try {
          const content = readFileSync(realPath, "utf-8");
          const data = parseYaml(content);
          return `export default ${JSON.stringify(data)};`;
        } catch (e) {
          console.error(`[yaml-plugin] Failed to load ${realPath}:`, e);
          return `export default {};`;
        }
      }
      return null;
    },
  };
}

const DEFAULT_SITE_CONFIG = {
  title: "codebook",
  subtitle: "by wrongfirst",
  logo_emoji: "📓",
};

function getSiteConfig(): Record<string, any> {
  let tomlPath = resolve(import.meta.dirname, "site.toml");
  if (!existsSync(tomlPath)) {
    tomlPath = resolve(import.meta.dirname, "site.toml.example");
  }
  try {
    const content = readFileSync(tomlPath, "utf-8");
    return { ...DEFAULT_SITE_CONFIG, ...parse(content) };
  } catch (e) {
    console.error("[getSiteConfig] Failed to load site.toml:", e);
    return { ...DEFAULT_SITE_CONFIG };
  }
}

function tomlPlugin(): Plugin {
  const cache = new Map<string, string>();

  return {
    name: "vite-toml-plugin",
    enforce: "pre" as const,
    async resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith(".toml") || !importer) return;
      const resolved = await this.resolve(source, importer);
      if (resolved && existsSync(resolved.id)) {
        const virtualId = resolved.id + "\0__toml__";
        cache.set(virtualId, resolved.id);
        return { id: virtualId, moduleSideEffects: true };
      } else if (source.endsWith("site.toml")) {
        const fallbackPath = resolve(import.meta.dirname, "site.toml.example");
        const virtualId = fallbackPath + "\0__toml__";
        cache.set(virtualId, fallbackPath);
        return { id: virtualId, moduleSideEffects: true };
      }
    },
    load(id: string) {
      if (id.endsWith("__toml__")) {
        const realPath = cache.get(id) || id.replace(/\0__toml__$/, "");
        if (realPath.endsWith("site.toml") || realPath.endsWith("site.toml.example")) {
          const data = getSiteConfig();
          return `export default ${JSON.stringify(data)};`;
        }
        try {
          const content = readFileSync(realPath, "utf-8");
          const data = parse(content);
          return `export default ${JSON.stringify(data)};`;
        } catch (e) {
          console.error(`[toml-plugin] Failed to load ${realPath}:`, e);
          return `export default {};`;
        }
      }
      return null;
    },
  };
}

function htmlMetaPlugin(): Plugin {
  return {
    name: "vite-html-meta",
    transformIndexHtml(html) {
      try {
        const siteConfig = getSiteConfig();
        const { title, subtitle, headline, description, keywords, og_image, logo_emoji } = siteConfig;

        const pageTitle = headline || (subtitle ? `${title} | ${subtitle}` : title);

        let res = html;
        res = res.replace(/(<h1 id="header-title"[^>]*>).*?(<\/h1>)/s, `$1${title}$2`);
        res = res.replace(/(<p id="header-subtitle"[^>]*>).*?(<\/p>)/s, `$1${subtitle}$2`);
        res = res.replace(/(<div [^>]*id="header-logo"[^>]*>).*?(<\/div>)/s, `$1${logo_emoji}$2`);
        res = res.replace(/<title>.*<\/title>/, `<title>${pageTitle}</title>`);
        res = res.replace("</head>", `  <meta property="og:title" content="${pageTitle}">\n</head>`);
        if (description) {
          res = res.replace("</head>", `  <meta name="description" content="${description}">\n</head>`);
          res = res.replace("</head>", `  <meta property="og:description" content="${description}">\n</head>`);
        }
        if (keywords) {
          res = res.replace("</head>", `  <meta name="keywords" content="${keywords}">\n</head>`);
        }
        if (og_image) {
          res = res.replace("</head>", `  <meta property="og:image" content="${og_image}">\n</head>`);
          res = res.replace("</head>", `  <meta name="twitter:card" content="summary_large_image">\n</head>`);
        }
        return res;
      } catch (e) {
        console.error("[html-meta] Failed to inject meta tags from site.toml:", e);
        return html;
      }
    },
  };
}

export default defineConfig({
  base: "./",
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,

    target: "esnext",
    minify: true,
  },
  define: {
    BUILD_DATE: JSON.stringify(buildDate),
  },
  plugins: [tailwindcss(), rawTextPlugin(), yamlPlugin(), tomlPlugin(), htmlMetaPlugin()],
});
