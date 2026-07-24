# Plan: Remove bun, migrate to Vite + Node

## Current bun usage

| File | What bun provides | Replacement |
|------|------------------|-------------|
| `scripts/build.ts` | `import { build } from "bun"` — Bun's JS bundler | Vite's programmatic API (`vite.build()`) |
| `server.ts` | `import { serve } from "bun"` — Bun's HTTP server | Node built-in `node:http` + `node:fs` (zero extra deps) |
| `dev.ts` | `import { $ } from "bun"` + `Bun.spawn()` — shell execution & process spawning | Node `child_process.spawn()` |
| `tsconfig.json` | `"types": ["bun-types"]` — Bun global type declarations | Remove; use `@types/node` |
| `package.json` scripts | `bun run`, `bunx --bun` | `node` / `npx` |
| `package.json` devDeps | `"bun-types": "^1.3.7"` | `"@types/node"`, `"vite"` |

## Step-by-step migration

### 1. Install dependencies

```bash
npm install -D vite @types/node
npm uninstall bun-types
```

### 2. Create `vite.config.ts`

```ts
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: ["public/index.html", "src/main.ts"],
    },
  },
  resolve: {
    alias: {
      // Preserve .md, .ml, .toml loaders via Vite plugins or default handling
    },
  },
  plugins: [
    // Custom plugin to handle .toml imports (Vite doesn't have a toml loader by default)
    tomlPlugin(),
  ],
});
```

### 3. Handle `.toml` loader

Vite doesn't ship with a `.toml` loader. Two options:
- **A)** Use a plugin like `vite-plugin-toml`
- **B)** Inline a small plugin that uses `fs` + `toml` parsing to load `.toml` files as modules

Add whichever approach to `vite.config.ts`.

### 4. Replace `scripts/build.ts`

Replace Bun's `build()` call with Vite's programmatic API:

```ts
import { build } from "vite";
import { defineConfig } from "vite";

const buildDate = new Date().toLocaleDateString(undefined, {
  year: "numeric",
  month: "long",
  day: "2-digit",
});

await build(
  defineConfig({
    build: {
      outDir: "dist",
      emptyOutDir: false, // don't delete index.html etc.
      rollupOptions: {
        input: ["src/main.ts"],
      },
    },
    define: {
      BUILD_DATE: JSON.stringify(buildDate),
    },
  })
);

console.log(`[build] bundled src/main.ts with BUILD_DATE="${buildDate}"`);
```

### 5. Replace `server.ts`

Replace Bun's `serve()` with Node built-in `http` + `fs` — zero extra dependencies:

```ts
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

const port = parseInt(process.env.PORT || "8080");

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://localhost:${port}`);
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  filePath = `./dist${filePath}`;

  if (existsSync(filePath)) {
    const ext = extname(filePath);
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    res.writeHead(200);
    res.end(readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Serving files from ${process.cwd()}/dist`);
});
```

### 6. Replace `dev.ts`

Replace Bun's `$` and `Bun.spawn()` with Node `child_process.spawn()`:

```ts
import { spawn } from "node:child_process";
import { watch } from "node:fs";

let child: ReturnType<typeof spawn> | null = null;

async function restart() {
  if (child) {
    child.kill();
    child = null;
  }

  await new Promise<void>((resolve, reject) => {
    const build = spawn("node", ["scripts/build-node.mjs"], {
      stdio: "inherit",
    });
    build.on("close", (code) => {
      if (code !== 0) reject();
      else resolve();
    });
  });

  child = spawn("node", ["server.ts"], { stdio: "inherit" });
}

await restart();

const SRC_DIR = "src";
const PUBLIC_DIR = "public";

watch(SRC_DIR, { recursive: true }, () => setTimeout(restart, 300));
watch(PUBLIC_DIR, { recursive: true }, () => setTimeout(restart, 300));

process.on("SIGINT", () => {
  if (child) child.kill();
  process.exit(0);
});
```

**Note:** With Vite HMR, the dev server will be replaced by `vite` command entirely — this file may become unnecessary. See step 8.

### 7. Update `tsconfig.json`

- Remove `"types": ["bun-types"]` from `compilerOptions`
- Add `"@types/node"` to `compilerOptions.types` (or rely on node16+ module resolution)
- Change `"moduleResolution"` from `"bundler"` to `"bundler"` (keep as-is, works with Vite)

### 8. Replace `package.json` scripts with Vite

```json
{
  "scripts": {
    "clean": "rm -rf dist",
    "check": "tsgo --noEmit",
    "build:dist": "mkdir -p dist && cp -r public/* dist/",
    "build:css": "npx -- @tailwindcss/cli -i ./src/input.css -o ./dist/style.css --minify",
    "build:html": "node scripts/inject-meta.mjs",
    "build": "npm run clean && npm run check && npm run build:dist && npm run build:css && vite build && npm run build:html",
    "dev": "vite",
    "serve": "node server.mjs"
  }
}
```

Key changes:
- `dev` → runs `vite` directly (provides HMR, dev server, and bundling)
- `build` → runs `vite build` instead of `bun scripts/build.ts`
- `build:html` → renamed to `.mjs` extension for Node ESM
- `serve` → renamed to `.mjs` extension

### 9. Rename `scripts/inject-meta.ts` → `scripts/inject-meta.mjs`

The file already uses only Node builtins (`fs`, `path`). Just rename and ensure ESM-compatible imports (use `import` syntax, which it already does).

### 10. Update `src/declarations.d.ts` / `src/env.d.ts`

These module declarations for `.md`, `.ml`, `.toml` are fine as-is. Vite supports these with the right plugins. No changes needed.

### 11. Remove bun-specific references

- Remove `bun-types` from `devDependencies` in `package.json`
- Remove `"bun-specific"` comment from `tsconfig.json`

## Final state

| Area | Before (bun) | After (Vite + Node) |
|------|-------------|---------------------|
| Bundler | Bun's `build()` | Vite |
| Dev server | `dev.ts` (Bun spawn + watch) | `vite` (built-in HMR) |
| Prod server | `server.ts` (Bun `serve()`) | `server.mjs` (Node built-in `http` + `fs`) |
| CSS build | `bunx --bun @tailwindcss/cli` | `npx -- @tailwindcss/cli` |
| Meta injection | `bun scripts/inject-meta.ts` | `node scripts/inject-meta.mjs` |
| Type declarations | `bun-types` | `@types/node` |
| Runtime | Bun only | Node 20+ |

## Files to create/modify

**Create:**
- `vite.config.ts`
- `scripts/inject-meta.mjs` (rename from `.ts`)
- `server.mjs` (rename from `.ts`, rewritten)

**Modify:**
- `package.json` (scripts + dependencies)
- `tsconfig.json` (remove bun-types)
- `scripts/build.ts` (rewrite to use Vite API, or remove if Vite handles everything)

**Remove:**
- `dev.ts` (replaced by `vite` dev server)
- `bun-types` from devDependencies
