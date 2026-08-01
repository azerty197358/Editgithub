import type { VFile } from '@/types';

interface BundleResult {
  html: string;
  error: string | null;
}

const CDN_REACT = 'https://esm.sh/react@18.3.1';
const CDN_REACT_DOM = 'https://esm.sh/react-dom@18.3.1';
const CDN_REACT_DOM_CLIENT = 'https://esm.sh/react-dom@18.3.1/client';

function isModule(path: string): boolean {
  return /\.(jsx?|tsx?)$/i.test(path);
}

function usesTailwind(files: Record<string, VFile>): boolean {
  if (files['tailwind.config.js'] || files['tailwind.config.ts']) return true;
  for (const f of Object.values(files)) {
    if (f.path.includes('css') && f.content.includes('@tailwind')) return true;
  }
  return true;
}

function getEntryHtml(files: Record<string, VFile>): string {
  const idx = files['index.html'];
  if (idx) return idx.content;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Preview</title></head><body><div id="root"></div></body></html>`;
}

function findEntryPoint(files: Record<string, VFile>): string | null {
  const candidates = ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'main.tsx', 'main.jsx', 'src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx'];
  for (const c of candidates) {
    if (files[c] && files[c].status !== 'deleted') return c;
  }
  for (const [path, file] of Object.entries(files)) {
    if (file.status !== 'deleted' && /\.(tsx|jsx)$/i.test(path)) return path;
  }
  return null;
}

export function bundlePreview(files: Record<string, VFile>): BundleResult {
  const entryHtml = getEntryHtml(files);
  const entryPoint = findEntryPoint(files);

  if (!entryPoint) {
    return {
      html: entryHtml,
      error: 'No entry point found (e.g. src/main.tsx or src/App.tsx).',
    };
  }

  const modules: { path: string; code: string }[] = [];
  const cssFiles: string[] = [];

  for (const [path, file] of Object.entries(files)) {
    if (file.status === 'deleted') continue;
    if (path.endsWith('.css')) {
      cssFiles.push(file.content);
    } else if (isModule(path)) {
      modules.push({ path, code: file.content });
    }
  }

  const tailwind = usesTailwind(files);
  const inlineCSS = cssFiles.join('\n');

  const modulesJson = JSON.stringify(
    modules.reduce((acc, m) => {
      acc[m.path] = m.code;
      acc[m.path.replace(/^src\//, '')] = m.code;
      acc['./' + m.path.replace(/^src\//, '')] = m.code;
      acc['@/' + m.path.replace(/^src\//, '')] = m.code;
      acc['@/' + m.path] = m.code;
      return acc;
    }, {} as Record<string, string>)
  );

  const titleMatch = entryHtml.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : 'Preview';

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
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; }
#root { width: 100%; min-height: 100vh; }
</style>
<script src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"></script>
</head>
<body>
<div id="root"></div>
<script type="importmap">
{
  "imports": {
    "react": "${CDN_REACT}",
    "react-dom": "${CDN_REACT_DOM}",
    "react-dom/client": "${CDN_REACT_DOM_CLIENT}",
    "lucide-react": "https://esm.sh/lucide-react@1.16.0",
    "clsx": "https://esm.sh/clsx@2.1.1",
    "tailwind-merge": "https://esm.sh/tailwind-merge@2.3.0",
    "motion/react": "https://esm.sh/motion@11.11.17/react",
    "recharts": "https://esm.sh/recharts@2.12.7",
    "canvas-confetti": "https://esm.sh/canvas-confetti@1.9.4"
  }
}
</script>
<script type="module">
const __modules = ${modulesJson};
const __entryPoint = "${entryPoint}";
const __cache = new Map();

function __resolvePath(specifier, referrer) {
  if (specifier.startsWith('http') || specifier.startsWith('https:')) return specifier;
  if (specifier === 'react' || specifier === 'react-dom' || specifier === 'react-dom/client' || specifier.includes('esm.sh')) return specifier;

  let clean = specifier;
  if (clean.startsWith('@/')) {
    clean = clean.slice(2);
  } else if (clean.startsWith('./') || clean.startsWith('../')) {
    const parts = referrer ? referrer.split('/') : [];
    parts.pop();
    const segments = clean.split('/');
    for (const seg of segments) {
      if (seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    clean = parts.join('/');
  }

  const candidates = [
    clean,
    'src/' + clean,
    clean + '.tsx',
    clean + '.ts',
    clean + '.jsx',
    clean + '.js',
    'src/' + clean + '.tsx',
    'src/' + clean + '.ts',
    'src/' + clean + '.jsx',
    'src/' + clean + '.js'
  ];

  for (const c of candidates) {
    if (__modules[c]) return c;
  }
  return specifier;
}

function __transformCode(code, path) {
  const transformed = Babel.transform(code, {
    presets: ['react', 'typescript'],
    filename: path,
    plugins: [
      function({ types: t }) {
        return {
          visitor: {
            ImportDeclaration(nodePath) {
              const source = nodePath.node.source.value;
              const resolved = __resolvePath(source, path);
              if (resolved !== source) {
                if (!resolved.startsWith('http')) {
                  nodePath.node.source.value = __getModuleBlobUrl(resolved);
                } else {
                  nodePath.node.source.value = resolved;
                }
              } else if (!source.startsWith('http') && !source.startsWith('.')) {
                nodePath.node.source.value = 'https://esm.sh/' + source;
              }
            },
            ExportNamedDeclaration(nodePath) {
              if (nodePath.node.source) {
                const source = nodePath.node.source.value;
                const resolved = __resolvePath(source, path);
                if (!resolved.startsWith('http') && !resolved.startsWith('.')) {
                  nodePath.node.source.value = __getModuleBlobUrl(resolved);
                } else if (resolved.startsWith('http')) {
                  nodePath.node.source.value = resolved;
                }
              }
            },
            ExportAllDeclaration(nodePath) {
              const source = nodePath.node.source.value;
              const resolved = __resolvePath(source, path);
              if (!resolved.startsWith('http') && !resolved.startsWith('.')) {
                nodePath.node.source.value = __getModuleBlobUrl(resolved);
              } else if (resolved.startsWith('http')) {
                nodePath.node.source.value = resolved;
              }
            }
          }
        };
      }
    ]
  }).code;
  return transformed;
}

function __getModuleBlobUrl(path) {
  if (__cache.has(path)) return __cache.get(path);
  const rawCode = __modules[path];
  if (!rawCode) {
    console.warn('Module not found:', path);
    return path;
  }
  const js = __transformCode(rawCode, path);
  const blob = new Blob([js], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  __cache.set(path, url);
  return url;
}

async function __run() {
  try {
    let entry = __entryPoint;
    if (!__modules[entry]) {
      entry = Object.keys(__modules)[0];
    }
    if (!entry || !__modules[entry]) {
      document.getElementById('root').innerHTML = '<div style="padding:2rem;text-align:center;color:#64748b;">No React entry component found.</div>';
      return;
    }

    const entryUrl = __getModuleBlobUrl(entry);
    await import(entryUrl);
  } catch (err) {
    console.error('Preview execution error:', err);
    document.getElementById('root').innerHTML = \`
      <div style="padding:2rem;font-family:system-ui;color:#ef4444;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:1rem;">
        <h3 style="margin:0 0 0.5rem;font-size:16px;font-weight:bold;">Preview Runtime Error</h3>
        <pre style="white-space:pre-wrap;font-size:12px;margin:0;overflow:auto;">\${err.message || String(err)}</pre>
      </div>\`;
  }
}

__run();
</script>
</body>
</html>`;

  return { html, error: null };
}
