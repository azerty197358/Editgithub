import type { ChatMessage, Settings, StreamCallbacks } from '@/types';

const SYSTEM_PROMPT = `You are OpenCode, an expert AI coding assistant that operates inside the user's browser.
You have full read/write access to the virtual file system (VFS). You can scan, read, create, and modify
any file in the project — including src/, config files (package.json, vite.config), and assets.

## MANDATORY 4-STEP AUTONOMOUS EXECUTION LOOP

For ANY request involving code changes, you MUST follow this exact workflow:

### Step 1 — READ & NAVIGATE
Before proposing changes, READ the relevant files in the workspace. State which files you are examining
and quote the key sections you found. You must understand the existing code structure, imports, patterns,
and conventions before touching anything. If you need to see a file that isn't in your context, say so.

### Step 2 — PLAN
Output a detailed multi-step implementation plan under a "## Action Plan" heading. Break the work into
clear, ordered, numbered steps. Each step should name the file(s) it touches and what it changes.

### Step 3 — EXECUTE
Output code changes file-by-file, using the correct file tags (described below). Move smoothly from one
file to the next. Complete each file block fully before starting the next. Do NOT leave partial blocks.

### Step 4 — TEST & VERIFY
After all file blocks, output a "## Verification" section. State what you changed, confirm the code is
syntactically valid (balanced brackets, closed tags, correct imports), and note any edge cases.
If you spot an error in your own output, immediately output a corrected file block to fix it.

This loop is NON-NEGOTIABLE. Skipping any step is forbidden.

## Editing Protocol — SEARCH/REPLACE (MANDATORY)

When modifying an EXISTING file, you MUST use the Search & Replace format inside <file> tags.
It is FORBIDDEN to rewrite an entire existing file for standard line modifications — always
target only the lines that need to change.

\`\`\`
<file path="src/App.jsx">
<<<<<<< SEARCH
export function App() {
  return <h1>Hello</h1>;
}
=======
export function App() {
  return <h1>Welcome to My App</h1>;
}
>>>>>>> REPLACE
</file>
\`\`\`

Rules for SEARCH/REPLACE:
1. The SEARCH block must be EXACT text that currently exists in the file — copy it verbatim.
2. The REPLACE block contains the new code that replaces the matched text.
3. You can output multiple SEARCH/REPLACE blocks in one <file> tag for different parts of the same file.
4. Leave the rest of the file completely untouched.

## EXCEPTIONS — Full file rewrite is ONLY allowed when:
- Creating a BRAND NEW file that does not yet exist in the workspace.
- The existing file is fundamentally broken / corrupted and needs a complete rewrite.
- The user EXPLICITLY requests a full rewrite.

For these exceptions, output the complete file content inside <file> tags WITHOUT SEARCH/REPLACE markers:

<file path="src/pages/About.jsx">
// complete file content
</file>

## Deleting files
<delete path="src/old/Removed.ts" />

## Rules
1. Always include the path attribute with forward slashes. Paths are relative to the project root.
2. After file blocks, give a SHORT plain-language summary of what changed and why.
3. If the user asks a question that doesn't require code changes, just answer normally — no file blocks.
4. Keep explanations concise. Let the code do the talking.
5. When using SEARCH/REPLACE, the SEARCH text must match EXACTLY (whitespace, indentation, newlines).
6. For new files, always output the complete file with all necessary imports.`;

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

interface PreparedRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export const OPENROUTER_FALLBACK: CatalogModel[] = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200000, free: false, promptPrice: 0.000003, completionPrice: 0.000015 },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000, free: false, promptPrice: 0.00000015, completionPrice: 0.0000006 },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', context_length: 64000, free: false, promptPrice: 0.00000027, completionPrice: 0.0000011 },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', context_length: 131000, free: false, promptPrice: 0.00000023, completionPrice: 0.0000004 },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (free)', context_length: 1048576, free: true, promptPrice: 0, completionPrice: 0 },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (free)', context_length: 131000, free: true, promptPrice: 0, completionPrice: 0 },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (free)', context_length: 64000, free: true, promptPrice: 0, completionPrice: 0 },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B (free)', context_length: 32768, free: true, promptPrice: 0, completionPrice: 0 },
];

interface CatalogModel {
  id: string;
  name: string;
  context_length: number;
  free: boolean;
  promptPrice: number;
  completionPrice: number;
}

export const GEMINI_MODELS: CatalogModel[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (AI Studio)', context_length: 1048576, free: false, promptPrice: 0, completionPrice: 0 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (AI Studio)', context_length: 1048576, free: false, promptPrice: 0, completionPrice: 0 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (AI Studio)', context_length: 1048576, free: false, promptPrice: 0, completionPrice: 0 },
];

export { type CatalogModel };

export function defaultModelFor(p: Settings['provider']): string {
  if (p === 'gemini') return 'gemini-2.5-flash';
  if (p === 'ollama') return '';
  return 'deepseek/deepseek-chat';
}

function prepareOpenRouter(messages: ChatMessage[], s: Settings): PreparedRequest {
  const model = s.model || 'anthropic/claude-3.5-sonnet';
  const clean = messages.filter((m) => m.content.trim().length > 0 || m.role === 'system');
  return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.openrouterKey}`,
      'X-Title': 'OpenCode',
    },
    body: {
      model,
      messages: clean.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    },
  };
}

function prepareGemini(messages: ChatMessage[], s: Settings): PreparedRequest {
  const model = s.model || 'gemini-2.5-flash';
  const sys = messages.find((m) => m.role === 'system');

  // Gemini requires strictly alternating user/model roles, starting with user,
  // and rejects empty content. Normalize: merge consecutive same-role messages,
  // drop empty messages, and ensure the conversation starts with a user turn.
  const convo = messages.filter((m) => m.role !== 'system' && m.content.trim().length > 0);
  const merged: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const m of convo) {
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += '\n\n' + m.content;
    } else {
      merged.push({ role, parts: [{ text: m.content }] });
    }
  }
  // Gemini requires the first turn to be 'user'
  if (merged.length > 0 && merged[0].role !== 'user') {
    merged.unshift({ role: 'user', parts: [{ text: 'Continue.' }] });
  }

  const body: Record<string, unknown> = { contents: merged };
  if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${s.geminiKey}`,
    headers: { 'Content-Type': 'application/json' },
    body,
  };
}

function prepareOllama(messages: ChatMessage[], s: Settings): PreparedRequest {
  const model = s.model || s.ollamaModel || 'llama3.1';
  const base = s.ollamaBaseUrl.replace(/\/$/, '');
  const clean = messages.filter((m) => m.content.trim().length > 0 || m.role === 'system');
  return {
    url: `${base}/api/chat`,
    headers: { 'Content-Type': 'application/json' },
    body: {
      model,
      messages: clean.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    },
  };
}

function prepare(messages: ChatMessage[], s: Settings): PreparedRequest {
  switch (s.provider) {
    case 'gemini':
      return prepareGemini(messages, s);
    case 'ollama':
      return prepareOllama(messages, s);
    default:
      return prepareOpenRouter(messages, s);
  }
}

export function validateSettings(s: Settings): string | null {
  if (s.provider === 'openrouter' && !s.openrouterKey) return 'OpenRouter API key is required.';
  if (s.provider === 'gemini' && !s.geminiKey) return 'Google AI Studio API key is required.';
  if (s.provider === 'ollama' && !s.ollamaBaseUrl) return 'Ollama base URL is required.';
  return null;
}

async function readSSE(resp: Response, s: Settings, cb: StreamCallbacks): Promise<string> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let token = '';
      if (s.provider === 'gemini') {
        if (line.startsWith('data:')) {
          const json = line.slice(5).trim();
          if (json === '[DONE]') continue;
          try {
            const obj = JSON.parse(json);
            const parts = obj?.candidates?.[0]?.content?.parts;
            if (parts) for (const p of parts) if (p.text) token += p.text;
          } catch { /* skip */ }
        }
      } else if (s.provider === 'ollama') {
        try {
          const obj = JSON.parse(line);
          if (obj.message?.content) token = obj.message.content;
          if (obj.done) continue;
        } catch { /* skip */ }
      } else {
        // OpenRouter (OpenAI SSE)
        if (line.startsWith('data:')) {
          const json = line.slice(5).trim();
          if (json === '[DONE]') continue;
          try {
            const obj = JSON.parse(json);
            const delta = obj?.choices?.[0]?.delta?.content;
            if (delta) token = delta;
          } catch { /* skip */ }
        }
      }
      if (token) {
        full += token;
        cb.onToken(token);
      }
    }
  }
  return full;
}

export async function streamChat(
  messages: ChatMessage[],
  settings: Settings,
  cb: StreamCallbacks,
  ctrl?: AbortController
): Promise<void> {
  const err = validateSettings(settings);
  if (err) { cb.onError(new Error(err)); return; }

  const req = prepare(messages, settings);
  const controller = ctrl ?? new AbortController();

  try {
    const resp = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`${resp.status} ${resp.statusText} — ${txt.slice(0, 200)}`);
    }

    if (!resp.body) throw new Error('No response stream.');
    const full = await readSSE(resp, settings, cb);
    cb.onDone(full);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      // User-initiated abort — silent
      return;
    }
    cb.onError(e instanceof Error ? e : new Error(String(e)));
  }
}
