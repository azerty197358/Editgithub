import type { VFile } from '@/types';

/**
 * Bundle the VFS files into a self-contained HTML document that can be
 * rendered in an iframe via srcdoc. Transforms JSX/TSX using Babel standalone
 * loaded from CDN inside the iframe. This mirrors Bolt.new's live preview.
 */

interface BundleResult {
  html: string;
  error: string | null;
}

const CDN_REACT = 'https://esm.sh/react@18.3.1';
const CDN_REACT_DOM = 'https://esm.sh/react-dom@18.3.1';

/** Determine if a file is a component/module that needs transformation */
function isModule(path: string): boolean {
  return /\.(jsx?|tsx?)$/i.test(path);
}

/** Check if the project uses Tailwind by looking for tailwind config or import */
function usesTailwind(files: Record<string, VFile>): boolean {
  if (files['tailwind.config.js'] || files['tailwind.config.ts']) return true;
  for (const f of Object.values(files)) {
    if (f.path.endsWith('index.css') && f.content.includes('@tailwind')) return true;
    if (f.path.endsWith('.css') && f.content.includes('@tailwind')) return true;
  }
  return false;
}

/** Extract the entry HTML file (index.html) or generate one */
function getEntryHtml(files: Record<string, VFile>): string {
  const idx = files['index.html'];
  if (idx) return idx.content;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Preview</title></head><body><div id="root"></div></body></html>`;
}

/** Find the entry point file (main.tsx, main.jsx, App.tsx, App.jsx) */
function findEntryPoint(files: Record<string, VFile>): string | null {
  const candidates = ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'main.tsx', 'main.jsx'];
  for (const c of candidates) {
    if (files[c]) return c;
  }
  // Find any App component
  const appCandidates = ['src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx'];
  for (const c of appCandidates) {
    if (files[c]) return c;
  }
  return null;
}

/** Transform import paths to use esm.sh CDN or relative iframe paths */
function transformImports(code: string): string {
  return code
    // React imports -> esm.sh
    .replace(/from\s+['"]react['"]/g, `from "${CDN_REACT}"`)
    .replace(/from\s+['"]react-dom['"]/g, `from "${CDN_REACT_DOM}"`)
    .replace(/from\s+['"]react-dom\/client['"]/g, `from "${CDN_REACT_DOM}/client"`)
    // Remove CSS imports (Tailwind is injected separately)
    .replace(/import\s+['"][^'"]+\.css['"];?\s*/g, '')
    // Remove static asset imports
    .replace(/import\s+\w+\s+from\s+['"][^'"]+\.(png|jpe?g|svg|gif|webp)['"];?\s*/g, 'const $1 = "";')
    // Transform relative imports: ./foo or ../foo -> try esm.sh for packages, keep relative for local
    .replace(/from\s+['"](\.\/[^'"]+)['"]/g, (match, p1) => {
      // Local file import — strip extension, append .js for iframe module resolution
      const clean = p1.replace(/\.(tsx?|jsx?)$/i, '');
      return `from "./${clean.replace(/^\.\//, '')}.js"`;
    })
    .replace(/from\s+['"](\.\.\/[^'"]+)['"]/g, (match, p1) => {
      const clean = p1.replace(/\.(tsx?|jsx?)$/i, '');
      return `from "../${clean.replace(/^\.\.\//, '')}.js"`;
    })
    // Bare package imports -> esm.sh
    .replace(/from\s+['"]((?!https?:)[a-z@][^'"]*)['"]/g, (match, p1) => {
      // Skip if already a URL or relative path
      if (p1.startsWith('.') || p1.startsWith('http')) return match;
      return `from "https://esm.sh/${p1}"`;
    });
}

/** Strip TypeScript-specific syntax that Babel can't handle without TS preset */
function stripTypeScript(code: string): string {
  return code
    // Remove type annotations: const x: Type = -> const x =
    .replace(/:\s*[A-Z][\w<>[\]|&,\s.]*?(?=\s*[=,);])/g, '')
    // Remove interface declarations
    .replace(/^\s*interface\s+\w+\s*\{[^}]*\}\s*$/gm, '')
    // Remove type imports
    .replace(/^\s*import\s+type\s+.*$/gm, '')
    .replace(/,\s*type\s+\w+/g, '')
    // Remove `as Type` assertions
    .replace(/\s+as\s+[A-Z][\w<>[\]|&.]*/g, '')
    // Remove generic type parameters on function calls: foo<T>( -> foo(
    .replace(/<[\w,\s]+>(?=\()/g, '')
    // Remove `export type` declarations
    .replace(/^\s*export\s+type\s+.*$/gm, '')
    .replace(/^\s*type\s+\w+\s*=.*$/gm, '');
}

/** Build a map of all module files with transformed content */
function buildModules(files: Record<string, VFile>): Map<string, string> {
  const modules = new Map<string, string>();
  for (const [path, file] of Object.entries(files)) {
    if (file.status === 'deleted') continue;
    if (!isModule(path)) continue;
    let code = file.content;
    // Strip TypeScript syntax
    if (/\.tsx?$/i.test(path)) {
      code = stripTypeScript(code);
    }
    // Transform imports
    code = transformImports(code);
    modules.set(path, code);
  }
  return modules;
}

/** Build the complete HTML document with all modules inlined as script tags */
export function bundlePreview(files: Record<string, VFile>): BundleResult {
  const entryHtml = getEntryHtml(files);
  const entryPoint = findEntryPoint(files);

  if (!entryPoint) {
    return {
      html: entryHtml,
      error: null,
    };
  }

  const modules = buildModules(files);
  const tailwind = usesTailwind(files);

  // Collect CSS files
  const cssFiles: string[] = [];
  for (const [path, file] of Object.entries(files)) {
    if (file.status === 'deleted') continue;
    if (path.endsWith('.css') && !file.content.includes('@tailwind')) {
      cssFiles.push(file.content);
    }
  }

  // Build module map for the iframe: path -> transformed code
  // We inject all modules as <script type="module"> blocks with import maps
  // Create an import map that maps relative module paths to blob URLs
  // Instead, we'll inline all modules using a custom module loader
  const moduleEntries: string[] = [];
  for (const [path, code] of modules) {
    // Escape for embedding in JS string
    const escaped = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    moduleEntries.push(`"${path}": \`${escaped}\``);
  }

  // Build the entry module code
  const entryCode = modules.get(entryPoint) || '';
  const escapedEntry = entryCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

  // Also collect non-module JS files that might be needed
  const inlineCSS = cssFiles.join('\n');

  // Parse entry HTML to extract title and body structure
  const titleMatch = entryHtml.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : 'Preview';

  // Build the complete HTML for the iframe
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
${tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
<style>${inlineCSS}</style>
<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
</style>
</head>
<body>
<div id="root"></div>
<script type="importmap">
{
  "imports": {
    "react": "${CDN_REACT}",
    "react-dom": "${CDN_REACT_DOM}",
    "react-dom/client": "${CDN_REACT_DOM}/client"
  }
}
</script>
<script type="module">
// Inline module registry — all project modules pre-loaded
const __modules = {
${moduleEntries.join(',\n')}
};

// Custom module resolver: resolves relative imports to inlined modules
async function __resolve(specifier, referrer) {
  if (specifier.startsWith('http')) return specifier;
  if (specifier === 'react') return 'react';
  if (specifier === 'react-dom') return 'react-dom';
  if (specifier === 'react-dom/client') return 'react-dom/client';

  // Resolve relative path
  let resolved = specifier;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    if (referrer) {
      const refDir = referrer.includes('/') ? referrer.slice(0, referrer.lastIndexOf('/') + 1) : '';
      resolved = new URL(specifier, 'http://local/' + refDir).pathname.slice(1);
    } else {
      resolved = specifier.replace(/^\\.\\//, '');
    }
  }

  // Try exact match, then with extensions
  if (__modules[resolved]) return resolved;
  for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
    const withExt = resolved.replace(/\\.(jsx?|tsx?)$/i, '') + ext;
    if (__modules[withExt]) return withExt;
    if (__modules[resolved + ext]) return resolved + ext;
  }
  // Try as bare specifier -> esm.sh
  return 'https://esm.sh/' + specifier;
}

// Module cache
const __cache = new Map();

async function __import(specifier, referrer) {
  const resolved = await __resolve(specifier, referrer);
  if (resolved === 'react') return await import('${CDN_REACT}');
  if (resolved === 'react-dom') return await import('${CDN_REACT_DOM}');
  if (resolved === 'react-dom/client') return await import('${CDN_REACT_DOM}/client');
  if (resolved.startsWith('http')) return await import(resolved);

  // Local module
  if (__cache.has(resolved)) return __cache.get(resolved);

  const code = __modules[resolved];
  if (!code) throw new Error('Module not found: ' + specifier + ' (resolved: ' + resolved + ')');

  // Transform JSX using Babel
  const transformed = Babel.transform(code, {
    presets: ['react'],
    filename: resolved,
  }).code;

  // Create blob URL and import it
  const blob = new Blob([transformed], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);

  // Wrap to provide __import as the import function
  const wrapped = transformed
    .replace(/from\\s+["']\\.\\/[^"']+["']/g, (m) => m) // keep for now
    .replace(/import\\s+([^;]+);/g, (m) => m);

  // Use dynamic import with blob
  const mod = await import(url);
  __cache.set(resolved, mod);
  return mod;
}

// Override static imports with a different approach:
// We use Babel to transform everything to use __import() dynamically
const __entryCode = \`${escapedEntry}\`;

// Transform the entry module: convert static imports to dynamic
const __transformed = Babel.transform(__entryCode, {
  presets: [['react', { runtime: 'classic' }]],
  plugins: [],
  filename: '${entryPoint}',
}).code;

// Replace all static import statements with dynamic imports
// and all export statements with module.exports
async function __runEntry() {
  try {
    // Use blob URL approach for the entry too
    const code = __transformed;
    // Create a blob and import it
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await import(url);
  } catch (err) {
    document.getElementById('root').innerHTML =
      '<div style="padding:2rem;font-family:system-ui;color:#ef4444;">' +
      '<h2 style="margin:0 0 0.5rem;">Preview Error</h2>' +
      '<pre style="white-space:pre-wrap;font-size:13px;">' +
      (err.message || String(err)) + '</pre></div>';
    console.error(err);
  }
}

// Load Babel then run
if (typeof Babel === 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@babel/standalone@7.24.7/babel.min.js';
  script.onload = __runEntry;
  script.onerror = () => {
    document.getElementById('root').innerHTML =
      '<div style="padding:2rem;color:#ef4444;">Failed to load Babel transformer. Check your connection.</div>';
  };
  document.head.appendChild(script);
} else {
  __runEntry();
}
</script>
</body>
</html>`;

  return { html, error: null };
}
