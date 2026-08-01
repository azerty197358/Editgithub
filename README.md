# OpenCode — Browser-Based AI Coding Assistant

A fully client-side AI coding assistant inspired by bolt.new / bolt.diy, designed to deploy entirely on Vercel's free tier. Bring your own API key — no backend required.

![OpenCode](https://img.shields.io/badge/Vercel-Ready-000?logo=vercel&logoColor=white) ![Client-side](https://img.shields.io/badge/100%25-Client--Side-3b82f6) ![BYOK](https://img.shields.io/badge/API-Bring%20Your%20Own%20Key-10b981)

## Features

### Architecture (Vercel-Ready)
- **100% client-side** — no server, no functions. Deploys instantly on Vercel free tier.
- **In-memory Virtual File System (VFS)** powered by Zustand. Files live in browser memory and can be edited, diffed, and pushed.
- Built with Vite + React + TypeScript + Tailwind CSS.

### LLM Integration (Bring Your Own Key)
- **OpenRouter** — access Claude, GPT-4o, Gemini, Llama, DeepSeek and more with one key.
- **Google AI Studio** — free tier for Gemini 2.5 Flash / Pro.
- **Ollama (local)** — point at your local Ollama server with a custom base URL.
- Token streaming for all three providers.
- All keys stored locally in the browser (localStorage), never sent anywhere except the chosen provider.

### GitHub Integration
- Enter a **GitHub Personal Access Token** in Settings (needs `repo` scope).
- **Clone** any public or private repo into the browser VFS (text files only, up to ~180KB each).
- Browse the full file tree, open and edit files in Monaco.
- Let the AI analyze, modify, and create files.
- **Commit & Push** changes back to a branch via the GitHub REST API (git trees / commits / refs) — no git binary needed.

### UI / UX
- Split-screen layout:
  - **Left:** Chat interface with streaming AI responses + settings access.
  - **Right:** File explorer sidebar, Monaco code editor, Diff view, and a Sync panel.
- Tabs to switch between **Editor**, **Diff** (unified diff of all changes), and **Sync** (commit & push).
- Resizable explorer panel, collapsible chat.
- Dark, focused design with JetBrains Mono for code and Inter for UI.

### AI Instructions & File Parsing
- A system prompt instructs the AI to emit file changes in a structured format:
  - XML-like tags: `<file path="src/Foo.tsx">…</file>`
  - Or fenced blocks with a path: ` ```tsx path="src/Foo.tsx" ``` `
  - Delete: `<delete path="src/old.ts" />`
- A frontend parser reads these tags, applies updates to the VFS, and marks each file as **new / modified / deleted** for the GitHub sync panel.

## Getting Started

```bash
npm install
npm run dev
```

Open the app, click **Settings**, and add:
1. Your AI provider key (OpenRouter or Google AI Studio) — or an Ollama URL.
2. A GitHub Personal Access Token with `repo` scope.

Then clone a repo or just ask the AI to create something from scratch.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it on [vercel.com](https://vercel.com) — it auto-detects Vite.
3. Deploy. No environment variables needed (keys are user-supplied in the UI).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Vite + React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand (VFS, chat, settings) |
| Editor | Monaco (@monaco-editor/react) |
| Markdown | react-markdown + remark-gfm |
| Diff | diff (jsdiff) |
| GitHub | REST API via fetch |
| LLMs | OpenRouter / Gemini / Ollama (SSE streaming) |

## Privacy

All API keys and GitHub tokens are stored in your browser's localStorage and sent only to the provider you select. This app has no server and stores nothing centrally.

## License

MIT
