import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { parse } from "toml";
import { resolve, relative } from "node:path";

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
      if ((source.endsWith(".md") || source.endsWith(".ml")) && importer) {
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

function tomlPlugin(): Plugin {
  const cache = new Map<string, string>();

  return {
    name: "vite-toml-plugin",
    enforce: "pre" as const,
    async resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith(".toml") || !importer) return;
      const resolved = await this.resolve(source, importer);
      if (resolved) {
        const virtualId = resolved.id + "\0__toml__";
        cache.set(virtualId, resolved.id);
        return { id: virtualId, moduleSideEffects: true };
      }
    },
    load(id: string) {
      if (id.endsWith("__toml__")) {
        const realPath = cache.get(id) || id.replace(/\0__toml__$/, "");
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

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: ["src/main.ts"],
    },
    target: "esnext",
    minify: true,
  },
  define: {
    BUILD_DATE: JSON.stringify(buildDate),
  },
  plugins: [rawTextPlugin(), tomlPlugin()],
});
