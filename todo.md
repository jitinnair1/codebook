# Todo: Migrate from Bun to Vite + Node

## Phase 1: Install dependencies

- [ ] Run: `npm install -D vite @types/node`
- [ ] Run: `npm uninstall bun-types`

**Check:** `npm ls vite @types/node` shows installed versions; `bun-types` no longer in `node_modules`

---

## Phase 2: Create Vite configuration

- [ ] Create `vite.config.ts` with:
  - `root: "."`
  - `build.outDir: "dist"`, `build.emptyOutDir: true`
  - `build.rollupOptions.input: ["src/main.ts"]`
  - Custom plugin to handle `.toml`, `.md`, and `.ml` imports (raw text loading)
  - `define: { BUILD_DATE: ... }` — will be set at build time via CLI arg or script

**Check:** `npx vite build` runs without errors and produces `dist/` output

---

## Phase 3: Delete `scripts/build.ts`

- [ ] Remove `scripts/build.ts` — Vite's `build()` (via `vite build` CLI) replaces it entirely

**Check:** No references to `scripts/build.ts` remain in `package.json` or other files

---

## Phase 4: Replace `server.ts` with Node built-in

- [ ] Create `server.mjs` using Node `http` + `fs` builtins
  - Parse `--port` from CLI args (preserve current behavior)
  - Serve static files from `./dist/`
  - Map file extensions to MIME types
  - Return 404 for missing files
  - Log port and base directory on start

**Check:** `node server.mjs --port 8080` starts server; `curl localhost:8080` returns index.html

---

## Phase 5: Replace `dev.ts` — use Vite dev server

- [ ] Delete `dev.ts` — replaced by `vite` dev server (built-in HMR, live reload, bundling)
- [ ] No custom rebuild/watch logic needed — Vite handles it

**Check:** `npx vite` starts dev server on port 5173; hot-reloads on file changes

---

## Phase 6: Handle `.toml` imports in `inject-meta.ts`

- [ ] Install TOML parser: `npm install toml`
- [ ] Rename `scripts/inject-meta.ts` → `scripts/inject-meta.mjs`
- [ ] Replace `import siteConfig from "../site.toml"` with `import { parse } from "toml"` + `fs.readFileSync` to parse the TOML file manually
- [ ] Ensure ESM-compatible imports throughout

**Check:** `node scripts/inject-meta.mjs` runs successfully and injects meta tags into `dist/index.html`

---

## Phase 7: Update `tsconfig.json`

- [ ] Remove `"bun-types"` from `compilerOptions.types` — replace with `"@types/node"` (or remove `types` entirely if `moduleResolution: "bundler"` auto-discovers it)
- [ ] Remove `"dev.ts"` from `include` array
- [ ] Keep `"moduleResolution": "bundler"` — works with Vite
- [ ] Keep `"module": "Preserve"` — Vite handles module resolution

**Check:** `npx tsgo --noEmit` (or `npx tsc --noEmit`) passes with no errors

---

## Phase 8: Update `package.json` scripts

- [ ] Update scripts to:
  ```json
  {
    "clean": "rm -rf dist",
    "check": "tsgo --noEmit",
    "build:dist": "mkdir -p dist && cp -r public/* dist/",
    "build:css": "npx -- @tailwindcss/cli -i ./src/input.css -o ./dist/style.css --minify",
    "build:html": "node scripts/inject-meta.mjs",
    "build": "npm run clean && npm run check && npm run build:dist && npm run build:css && vite build && npm run build:html",
    "dev": "vite",
    "serve": "node server.mjs"
  }
  ```
- [ ] Remove `bun-types` from `devDependencies` (if still present after Phase 1)
- [ ] Add `toml` to `devDependencies` (if not added in Phase 6)

**Check:** `npm run build` completes end-to-end; `npm run dev` starts Vite dev server; `npm run serve` starts Node server

---

## Phase 9: Clean up type declarations

- [ ] Review `src/declarations.d.ts` and `src/env.d.ts` — `.toml`, `.md`, `.ml` module declarations should remain (Vite respects them with the custom plugin from Phase 2)
- [ ] No changes needed unless the custom plugin changes how modules are resolved

**Check:** TypeScript compilation (`npm run check`) passes with no unresolved module errors

---

## Phase 10: Final verification

- [ ] `npm run build` — full production build succeeds
- [ ] `node server.mjs --port 8080` + browse to `localhost:8080` — app loads and works
- [ ] `npm run dev` — Vite dev server with HMR works
- [ ] Exercise editor loads, runs code, and navigates between exercises
- [ ] No `bun` references remain in `package.json`, `tsconfig.json`, or source files
- [ ] `bun.lock` can be deleted (no longer needed)

**Check:** All above pass; `grep -r "bun" --include="*.json" --include="*.ts" --include="*.mjs" .` returns no results (excluding `node_modules/` and `.git/`)
