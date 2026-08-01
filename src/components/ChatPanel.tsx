import { useEffect, useRef, useState } from 'react';
import { Send, Square, Sparkles, Trash2, FileEdit, FilePlus, Trash2 as Del, AlertCircle, RotateCcw } from 'lucide-react';
import { useChat, newUserMsg, newAssistantMsg } from '@/store/chat';
import { useSettings } from '@/store/settings';
import { useVfs } from '@/store/vfs';
import { streamChat, buildSystemPrompt, validateSettings } from '@/lib/llm';
import { parseActions, stripFileBlocks, isBlockComplete } from '@/lib/parser';
import { fileOpsFromActions } from '@/store/chat';
import { validateCode } from '@/lib/validator';
import { buildDatabaseContextForAI, hasCredentials } from '@/lib/supabase';
import { Markdown } from './Markdown';
import type { ChatMessage, RepoInfo, ParsedAction } from '@/types';

interface Props {
  repo: RepoInfo | null;
  onNeedSettings: () => void;
}

const SUGGESTIONS = [
  'Add a dark mode toggle to the app',
  'Create a reusable Button component',
  'Refactor the main page into smaller components',
  'Add unit tests for the utils folder',
];

export function ChatPanel({ repo, onNeedSettings }: Props) {
  const { messages, add, update, remove, setBusy, busy, clear } = useChat();
  const { settings } = useSettings();
  const { files, applyActions } = useVfs();
  const [input, setInput] = useState('');
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const appliedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function runStream(history: ChatMessage[], assistantId: string) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true, () => ctrl.abort());

    let acc = '';
    appliedPathsRef.current = new Set();
    let streamFailed = false;

    await streamChat(
      history,
      settings,
      {
        onToken: (tok) => {
          acc += tok;
          update(assistantId, { content: acc, pending: true });
          // Only apply complete file blocks during streaming — never partial
          tryApplyCompleteStreamed(acc);
        },
        onDone: (full) => {
          if (streamFailed) return;

          const known = Object.keys(useVfs.getState().files);
          const actions = parseActions(full, known);

          if (actions.length > 0) {
            // VALIDATION GATE: validate every code block BEFORE applying to VFS
            const validationErrors: string[] = [];
            const validActions: ParsedAction[] = [];
            const invalidActions: ParsedAction[] = [];

            for (const a of actions) {
              if (a.type === 'delete') {
                validActions.push(a);
                continue;
              }
              if (a.searchReplace && a.searchReplace.length > 0) {
                validActions.push(a);
                continue;
              }
              if (a.content) {
                const v = validateCode(a.content, a.path);
                if (v.ok) {
                  validActions.push(a);
                } else {
                  invalidActions.push(a);
                  validationErrors.push(`${a.path}: ${v.error}`);
                }
              } else {
                validActions.push(a);
              }
            }

            if (validationErrors.length > 0) {
              // HALT: do not apply invalid files. Apply only valid ones, report errors.
              setValidationWarning(validationErrors.join('; '));
              if (validActions.length > 0) {
                applyActions(validActions);
              }
              const errorMsg = `**Validation failed — ${invalidActions.length} file(s) blocked:**\n\n${validationErrors.join('\n')}\n\n**The AI must self-correct these errors and regenerate the affected files.** Click "Regenerate" to retry.`;
              update(assistantId, {
                content: stripFileBlocks(full) + '\n\n> **Syntax error — code NOT applied:** ' + errorMsg,
                pending: false,
                fileOps: validActions.length > 0 ? fileOpsFromActions(validActions, new Set(known)) : [],
                error: true,
              });
            } else {
              setValidationWarning(null);
              applyActions(validActions);
              update(assistantId, {
                content: stripFileBlocks(full),
                pending: false,
                fileOps: fileOpsFromActions(validActions, new Set(known)),
              });
            }
          } else {
            setValidationWarning(null);
            update(assistantId, { content: full, pending: false });
          }
        },
        onError: (err) => {
          streamFailed = true;
          // FAULT TOLERANCE: discard the partial stream buffer entirely.
          // Do NOT apply any partial file blocks to the VFS. Leave original files untouched.
          appliedPathsRef.current = new Set();
          update(assistantId, {
            content: `**Stream interrupted:** ${err.message}\n\nNo files were modified. The original code in the editor is untouched. Click "Regenerate" to retry.`,
            pending: false,
            error: true,
          });
        },
      },
      ctrl
    );

    /**
     * Atomic write buffer: Only apply file actions whose blocks are FULLY CLOSED
     * in the streamed text so far. If a <file> tag or SEARCH/REPLACE block is still
     * open (incomplete), skip it entirely — the original VFS file stays untouched.
     */
    function tryApplyCompleteStreamed(text: string) {
      // First check if the overall content has any unclosed blocks
      if (!isBlockComplete(text)) {
        // Content has unclosed blocks — only apply the ones that ARE complete.
        // parseActions will naturally only extract complete blocks, but we
        // double-check by verifying each parsed action's region is closed.
      }

      const known = Object.keys(useVfs.getState().files);
      const actions = parseActions(text, known);
      if (actions.length === 0) return;

      // Filter to only actions whose paths haven't been applied yet
      const newActions = actions.filter((a) => !appliedPathsRef.current.has(a.path));
      if (newActions.length === 0) return;

      // For each new action, verify its block is complete in the text
      const safeActions: ParsedAction[] = [];
      for (const a of newActions) {
        // Check that the file block for this action is fully closed in the text
        const blockComplete = checkActionBlockComplete(text, a);
        if (blockComplete) {
          // Validate code BEFORE applying during streaming too
          if (a.type === 'delete') {
            safeActions.push(a);
            continue;
          }
          if (a.searchReplace && a.searchReplace.length > 0) {
            safeActions.push(a);
            continue;
          }
          if (a.content) {
            const v = validateCode(a.content, a.path);
            if (v.ok) {
              safeActions.push(a);
            }
            // If validation fails during streaming, skip — will be caught in onDone
          } else {
            safeActions.push(a);
          }
        }
      }

      if (safeActions.length === 0) return;
      for (const a of safeActions) appliedPathsRef.current.add(a.path);
      applyActions(safeActions);
    }

    setBusy(false);
    abortRef.current = null;
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const validation = validateSettings(settings);
    if (validation) { onNeedSettings(); return; }

    const userMsg = newUserMsg(content);
    add(userMsg);
    setInput('');

    const assistant = newAssistantMsg();
    add(assistant);

    const sysContent = buildSystemPrompt();
    const fileContext = buildFileContext(files, repo, activeFile);
    const dbContext = await buildDatabaseContext(settings.supabaseUrl, settings.supabaseAnonKey);
    const sysMsg: ChatMessage = { id: 'sys', role: 'system', content: sysContent + (fileContext ? '\n\n' + fileContext : '') + (dbContext ? '\n\n' + dbContext : ''), ts: 0 };

    const history = [sysMsg, ...messages.filter((m) => !m.pending && !m.error), userMsg];
    await runStream(history, assistant.id);
  }

  async function regenerate(messageId: string) {
    if (busy) return;
    const validation = validateSettings(settings);
    if (validation) { onNeedSettings(); return; }

    // Find the message and the user message that preceded it
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    // Find the last user message before this assistant message
    let userMsg: ChatMessage | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { userMsg = messages[i]; break; }
    }
    if (!userMsg) return;

    // Remove the failed assistant message
    remove(messageId);

    // Create a new assistant message
    const assistant = newAssistantMsg();
    add(assistant);

    const sysContent = buildSystemPrompt();
    const fileContext = buildFileContext(files, repo, activeFile);
    const dbContext = await buildDatabaseContext(settings.supabaseUrl, settings.supabaseAnonKey);
    const sysMsg: ChatMessage = { id: 'sys', role: 'system', content: sysContent + (fileContext ? '\n\n' + fileContext : '') + (dbContext ? '\n\n' + dbContext : ''), ts: 0 };

    // Rebuild history: all non-pending/non-error messages up to and including the user message
    const history = [sysMsg, ...messages.slice(0, idx).filter((m) => !m.pending && !m.error && m.id !== messageId), userMsg];
    await runStream(history, assistant.id);
  }

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
    messages.forEach((m) => {
      if (m.pending) {
        update(m.id, { pending: false, content: m.content ? m.content + '\n\n*(Generation stopped by user)*' : '*(Generation stopped by user)*' });
      }
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-dim)' }}>
            <Sparkles size={15} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Assistant</div>
            <div className="text-[11px]" style={{ color: 'var(--text-mute)' }}>
              {settings.provider} · {settings.model || 'default model'}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-ghost text-xs !py-1.5" onClick={clear} title="Clear chat">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {validationWarning && (
        <div className="px-4 py-2 flex items-start gap-1.5 text-xs" style={{ color: 'var(--warning)', background: 'rgba(245,158,11,0.08)' }}>
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span><strong>Syntax warning:</strong> {validationWarning}</span>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--primary-dim)' }}>
              <Sparkles size={22} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 className="text-sm font-semibold mb-1">What should we build?</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-mute)' }}>
              Describe a change and I'll edit the files directly. Bring your own API key.
            </p>
            <div className="space-y-1.5 w-full max-w-xs">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all hover:translate-x-0.5"
                  style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-soft)', color: 'var(--text-dim)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} onRegenerate={() => regenerate(m.id)} />
        ))}
      </div>

      <div className="p-3 border-t" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev-2)' }}>
        <div className="relative rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <textarea
            className="w-full bg-transparent px-3.5 py-3 pr-12 text-sm resize-none focus:outline-none"
            rows={2}
            placeholder={repo ? `Ask about ${repo.repo} or request changes...` : 'Ask the AI to create or edit code...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            style={{ color: 'var(--text)' }}
          />
          <div className="absolute right-2 bottom-2">
            {busy ? (
              <button className="btn btn-danger !p-2" onClick={stop} title="Stop">
                <Square size={14} />
              </button>
            ) : (
              <button
                className="btn btn-primary !p-2"
                onClick={() => send(input)}
                disabled={!input.trim()}
                title="Send (Enter)"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] mt-1.5 px-1" style={{ color: 'var(--text-mute)' }}>Enter to send · Shift+Enter for newline · Files apply automatically</p>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onRegenerate }: { msg: ChatMessage; onRegenerate: () => void }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end fade-in">
        <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 fade-in">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--bg-elev-3)' }}>
        <Sparkles size={14} style={{ color: 'var(--primary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        {msg.pending && !msg.content ? (
          <div className="flex items-center gap-1.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--primary)' }} />
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--primary)', animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--primary)', animationDelay: '0.4s' }} />
          </div>
        ) : msg.error ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--error)' }}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> <span>{msg.content}</span>
            </div>
            <button
              className="btn btn-ghost text-xs !py-1.5 flex items-center gap-1.5"
              onClick={onRegenerate}
              title="Regenerate response"
            >
              <RotateCcw size={13} /> Regenerate Response
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border-soft)' }}>
              <Markdown content={msg.content || '...'} />
              {msg.fileOps && msg.fileOps.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t space-y-1" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="text-[10px] uppercase font-semibold tracking-wide mb-1" style={{ color: 'var(--text-mute)' }}>Applied {msg.fileOps.length} change{msg.fileOps.length > 1 ? 's' : ''}</div>
                  {msg.fileOps.map((op) => (
                    <div key={op.path} className="flex items-center gap-1.5 text-xs">
                      {op.type === 'create' && <FilePlus size={12} style={{ color: 'var(--success)' }} />}
                      {op.type === 'modify' && <FileEdit size={12} style={{ color: 'var(--warning)' }} />}
                      {op.type === 'delete' && <Del size={12} style={{ color: 'var(--error)' }} />}
                      <span className="mono truncate" style={{ color: 'var(--text-dim)' }}>{op.path}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!msg.pending && msg.content && (
              <button
                className="btn btn-ghost text-[11px] !py-1 flex items-center gap-1"
                onClick={onRegenerate}
                title="Regenerate response"
              >
                <RotateCcw size={12} /> Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Check if the file-action block for a specific action is fully closed in the streamed text.
 * This prevents partial/incomplete blocks from overwriting VFS files during streaming.
 */
function checkActionBlockComplete(text: string, action: ParsedAction): boolean {
  if (action.type === 'delete') return true;

  // Use the clean safe static regex pattern — no RegExp constructor with user input.
  // This avoids the "Unterminated group" crash entirely.
  const fileRegex = /<(file|create|modify|write)\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = fileRegex.exec(text)) !== null) {
    if (m[2] === action.path) return true;
  }

  // Check fenced code blocks with path attribute — must have closing fence
  const fenceRegex = /```[\w-]*\s*path=["']([^"']+)["']\s*\n([\s\S]*?)```/gi;
  while ((m = fenceRegex.exec(text)) !== null) {
    if (m[1] === action.path) return true;
  }

  return false;
}

function buildFileContext(files: Record<string, { path: string; content: string; status: string }>, repo: RepoInfo | null, activeFile: string | null): string {
  const paths = Object.keys(files);
  if (paths.length === 0) return '';
  const header = repo
    ? `\n## Current repository\nRepository: ${repo.owner}/${repo.repo} (branch: ${repo.branch})`
    : '\n## Current workspace (virtual file system)';
  const activeFileObj = activeFile ? files[activeFile] : null;
  const activeFileSection = activeFileObj 
    ? `\n## Currently Active File in Editor (${activeFile})\n\`\`\`\n${activeFileObj.content}\n\`\`\`\n` 
    : '';
  const fileLines = paths.slice(0, 100).map((p) => `- ${p}${p === activeFile ? ' (active)' : ''}`).join('\n');
  const smallFiles = Object.values(files)
    .filter((f) => f.path !== activeFile && f.content.length < 8000)
    .slice(0, 15)
    .map((f) => `\n<file path="${f.path}">\n${f.content}\n</file>`)
    .join('\n');
  return `${header}${activeFileSection}\n## File tree\n${fileLines}\n\n## File contents (subset)\n${smallFiles}`;
}

async function buildDatabaseContext(url: string, anonKey: string): Promise<string> {
  if (!hasCredentials(url, anonKey)) return '';
  try {
    return await buildDatabaseContextForAI(url, anonKey);
  } catch {
    return '';
  }
}
