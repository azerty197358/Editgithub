import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ChatMessage, ParsedAction } from '@/types';

interface ChatStore {
  messages: ChatMessage[];
  busy: boolean;
  abort: (() => void) | null;
  add: (msg: ChatMessage) => void;
  update: (id: string, patch: Partial<ChatMessage>) => void;
  remove: (id: string) => void;
  setBusy: (b: boolean, abort?: () => void) => void;
  clear: () => void;
}

export const useChat = create<ChatStore>((set) => ({
  messages: [],
  busy: false,
  abort: null,
  add: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  update: (id, patch) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  remove: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
  setBusy: (b, abort) => set({ busy: b, abort: abort ?? null }),
  clear: () => set({ messages: [] }),
}));

export function newUserMsg(content: string): ChatMessage {
  return { id: nanoid(10), role: 'user', content, ts: Date.now() };
}

export function newAssistantMsg(): ChatMessage {
  return { id: nanoid(10), role: 'assistant', content: '', ts: Date.now(), pending: true };
}

export function fileOpsFromActions(actions: ParsedAction[], existing: Set<string>): FileOp[] {
  return actions.map((a) => ({
    type: a.type === 'delete' ? 'delete' : existing.has(a.path) ? 'modify' : 'create',
    path: a.path,
    preview: (a.content ?? '').slice(0, 120),
  }));
}

interface FileOp {
  type: 'create' | 'modify' | 'delete';
  path: string;
  preview?: string;
}
