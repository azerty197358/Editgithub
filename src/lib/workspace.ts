interface WorkspaceFile {
  path: string;
  content: string;
}

export const defaultWorkspaceFiles: WorkspaceFile[] = [
  {
    path: 'package.json',
    content: `{
  "name": "my-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.2"
  }
}
`,
  },
  {
    path: 'src/App.jsx',
    content: `import { useState } from 'react';
import { Home } from './pages/Home';

export default function App() {
  const [dark, setDark] = useState(false);

  return (
    <div className={dark ? 'dark' : ''} style={{ minHeight: '100vh', background: dark ? '#0f172a' : '#f8fafc', transition: 'background 0.3s' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: dark ? '#fff' : '#0f172a' }}>My App</h1>
        <button
          onClick={() => setDark(!dark)}
          style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </nav>
      <Home dark={dark} />
    </div>
  );
}
`,
  },
  {
    path: 'src/pages/Home.jsx',
    content: `export function Home({ dark }) {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 1.5rem' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', color: dark ? '#fff' : '#0f172a' }}>
        Welcome to My App
      </h2>
      <p style={{ fontSize: '1.125rem', lineHeight: 1.6, color: dark ? '#cbd5e1' : '#475569' }}>
        This is the home page. Ask the AI assistant to add features, components, or styles here.
      </p>
    </main>
  );
}
`,
  },
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.jsx',
    content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  },
  {
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
  },
  {
    path: 'README.md',
    content: `# My App

A React app built with Vite. Use the AI assistant to edit files, add components, and push changes to GitHub.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
  },
];
