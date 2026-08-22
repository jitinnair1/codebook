// scripts/vendor-assets.mjs
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const TS_VERSION = '6.0.3';
const TS_CDN_BASE = `https://cdn.jsdelivr.net/npm/typescript@${TS_VERSION}/lib/`;

const TS_LIB_FILES = [
  'typescript.min.js',
  'lib.d.ts',
  'lib.es5.d.ts',
  'lib.es2015.d.ts',
  'lib.es2015.core.d.ts',
  'lib.es2015.collection.d.ts',
  'lib.es2015.iterable.d.ts',
  'lib.es2015.promise.d.ts',
  'lib.es2015.symbol.d.ts',
  'lib.es2015.symbol.wellknown.d.ts',
  'lib.es2020.d.ts',
  'lib.es2022.d.ts',
  'lib.es2022.full.d.ts',
  'lib.dom.d.ts',
  'lib.webworker.d.ts',
  'lib.decorators.d.ts',
  'lib.decorators.legacy.d.ts',
];

const PYTHON_PACKAGES = [
  'typing_extensions',
  'mypy_extensions',
  'pathspec',
  'mypy',
];

async function downloadFile(url, destPath) {
  console.log(`  Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  writeFileSync(destPath, Buffer.from(buffer));
}

// 1. Copy Pyodide assets from node_modules/pyodide
async function vendorPyodide() {
  console.log('\n[1/3] Vendoring Pyodide assets from node_modules/pyodide...');
  const pyodideSrc = resolve(projectRoot, 'node_modules/pyodide');
  const pyodideDest = resolve(projectRoot, 'public/pyodide');

  if (!existsSync(pyodideSrc)) {
    console.error('  ERROR: node_modules/pyodide not found. Run `npm install` first.');
    return;
  }

  if (!existsSync(pyodideDest)) {
    mkdirSync(pyodideDest, { recursive: true });
  }

  const files = readdirSync(pyodideSrc);
  for (const file of files) {
    if (
      file.endsWith('.wasm') ||
      file.endsWith('.zip') ||
      file.endsWith('.mjs') ||
      file.endsWith('.js') ||
      file.endsWith('.json') ||
      file.endsWith('.d.ts')
    ) {
      const srcFile = join(pyodideSrc, file);
      const destFile = join(pyodideDest, file);
      copyFileSync(srcFile, destFile);
      console.log(`  Copied: ${file}`);
    }
  }
  console.log('✓ Pyodide assets vendored successfully to public/pyodide');
}

// 2. Vendor TypeScript assets
async function vendorTypeScript() {
  console.log(`\n[2/3] Vendoring TypeScript ${TS_VERSION} compiler & lib declarations...`);
  const tsDest = resolve(projectRoot, 'public/typescript');

  if (!existsSync(tsDest)) {
    mkdirSync(tsDest, { recursive: true });
  }

  for (const file of TS_LIB_FILES) {
    const url = `${TS_CDN_BASE}${file}`;
    const destPath = join(tsDest, file);
    try {
      await downloadFile(url, destPath);
    } catch (err) {
      console.warn(`  Warning: Could not download ${file}:`, err.message);
    }
  }
  console.log('✓ TypeScript assets vendored successfully to public/typescript');
}

async function getPyPIWheelUrl(pkgName) {
  const metaUrl = `https://pypi.org/pypi/${pkgName}/json`;
  const res = await fetch(metaUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch PyPI metadata for ${pkgName}: HTTP ${res.status}`);
  }
  const data = await res.json();
  const wheel = data.urls.find(
    (u) => u.packagetype === 'bdist_wheel' && (u.filename.includes('none-any') || u.filename.includes('py3-none-any'))
  ) || data.urls.find((u) => u.packagetype === 'bdist_wheel');

  if (!wheel) {
    throw new Error(`No suitable wheel found for ${pkgName} on PyPI`);
  }
  return { url: wheel.url, fileName: wheel.filename };
}

// 3. Vendor Python/Mypy Wheels
async function vendorPythonWheels() {
  console.log('\n[3/3] Vendoring Python/Mypy wheel packages from PyPI...');
  const wheelsDest = resolve(projectRoot, 'public/wheels');

  if (!existsSync(wheelsDest)) {
    mkdirSync(wheelsDest, { recursive: true });
  }

  for (const pkg of PYTHON_PACKAGES) {
    try {
      const { url, fileName } = await getPyPIWheelUrl(pkg);
      const destPath = join(wheelsDest, fileName);
      console.log(`  Package: ${pkg} -> ${fileName}`);
      await downloadFile(url, destPath);
    } catch (err) {
      console.warn(`  Warning: Could not download wheel for ${pkg}:`, err.message);
    }
  }
  console.log('✓ Python/Mypy wheels vendored successfully to public/wheels');
}

async function main() {
  console.log('=== Vendoring Compiler & Language Assets ===');
  await vendorPyodide();
  await vendorTypeScript();
  await vendorPythonWheels();
  console.log('\n=== All assets vendored successfully! ===\n');
}

main().catch((err) => {
  console.error('Fatal error during asset vendoring:', err);
  process.exit(1);
});
