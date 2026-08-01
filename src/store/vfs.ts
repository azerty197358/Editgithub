import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { VFile, ParsedAction } from '@/types';
import { defaultWorkspaceFiles } from '@/lib/workspace';
import { applySearchReplace } from '@/lib/parser';

interface VfsStore {
  files: Record<string, VFile>;
  repoPath: string;
  activeFile: string | null;
  setActive: (path: string | null) => void;
  loadFiles: (files: VFile[], repoPath: string) => void;
  applyAction: (a: ParsedAction) => void;
  applyActions: (actions: ParsedAction[]) => void;
  writeFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  discardFile: (path: string) => void;
  discardAll: () => void;
  markCommitted: () => void;
  reset: () => void;
  seedDefault: () => void;
}

function setStatus(vf: VFile): VFile {
  if (vf.binary) return { ...vf, status: 'unchanged' };
  if (vf.originalContent === vf.content) return { ...vf, status: 'unchanged' };
  return { ...vf, status: 'modified' };
}

export const useVfs = create<VfsStore>((set) => ({
  files: {},
  repoPath: '',
  activeFile: null,

  setActive: (path) => set({ activeFile: path }),

  loadFiles: (incoming, repoPath) => {
    const files: Record<string, VFile> = {};
    for (const f of incoming) {
      files[f.path] = { ...f, originalContent: f.content, status: 'unchanged' };
    }
    const firstCode = Object.keys(files).find((p) => /\.(ts|tsx|js|jsx|md|json|py|go|rs|css|html|vue|svelte)$/i.test(p));
    set({ files, repoPath, activeFile: firstCode ?? null });
  },

  applyAction: (a) =>
    set((s) => {
      const files = { ...s.files };
      if (a.type === 'delete') {
        if (files[a.path]) files[a.path] = { ...files[a.path], status: 'deleted', content: '' };
        return { files };
      }
      const existing = files[a.path];
      const body = a.content ?? '';
      const original = existing?.originalContent ?? body;
      files[a.path] = {
        path: a.path,
        content: body,
        originalContent: original,
        status: existing ? (original === body ? 'unchanged' : 'modified') : 'new',
      };
      return { files, activeFile: a.path };
    }),

  applyActions: (actions) =>
    set((s) => {
      const files = { ...s.files };
      let active = s.activeFile;
      for (const a of actions) {
        if (a.type === 'delete') {
          if (files[a.path]) files[a.path] = { ...files[a.path], status: 'deleted', content: '' };
          continue;
        }
        const existing = files[a.path];

        // SEARCH/REPLACE mode: apply blocks to existing content
        if (a.searchReplace && a.searchReplace.length > 0 && existing) {
          const res = applySearchReplace(existing.content, a.searchReplace);
          if (res && res.failedBlock === -1) {
            files[a.path] = setStatus({ ...existing, content: res.result });
          }
          if (!active || !files[active]) active = a.path;
          continue;
        }

        const body = a.content ?? '';
        const original = existing?.originalContent ?? body;
        files[a.path] = {
          path: a.path,
          content: body,
          originalContent: original,
          status: existing ? (original === body ? 'unchanged' : 'modified') : 'new',
        };
        if (!active || !files[active]) active = a.path;
      }
      return { files, activeFile: active };
    }),

  writeFile: (path, content) =>
    set((s) => {
      const existing = s.files[path];
      if (!existing) {
        return {
          files: {
            ...s.files,
            [path]: { path, content, originalContent: content, status: 'new' },
          },
          activeFile: path,
        };
      }
      const updated = setStatus({ ...existing, content });
      return { files: { ...s.files, [path]: updated } };
    }),

  deleteFile: (path) =>
    set((s) => {
      if (!s.files[path]) return s;
      return { files: { ...s.files, [path]: { ...s.files[path], status: 'deleted', content: '' } } };
    }),

  discardFile: (path) =>
    set((s) => {
      const f = s.files[path];
      if (!f) return s;
      const files = { ...s.files };
      if (f.status === 'new') {
        delete files[path];
      } else {
        files[path] = { ...f, content: f.originalContent, status: 'unchanged' };
      }
      return { files };
    }),

  discardAll: () =>
    set((s) => {
      const files: Record<string, VFile> = {};
      for (const [p, f] of Object.entries(s.files)) {
        if (f.status === 'new') continue;
        files[p] = { ...f, content: f.originalContent, status: 'unchanged' };
      }
      return { files };
    }),

  markCommitted: () =>
    set((s) => {
      const files: Record<string, VFile> = {};
      for (const [p, f] of Object.entries(s.files)) {
        files[p] = { ...f, originalContent: f.content, status: 'unchanged' };
      }
      return { files };
    }),

  reset: () => set({ files: {}, repoPath: '', activeFile: null }),

  seedDefault: () =>
    set((s) => {
      if (Object.keys(s.files).length > 0) return s;
      const files: Record<string, VFile> = {};
      for (const wf of defaultWorkspaceFiles) {
        files[wf.path] = { path: wf.path, content: wf.content, originalContent: wf.content, status: 'unchanged' };
      }
      const firstCode = Object.keys(files).find((p) => /\.(tsx|jsx|ts|js)$/i.test(p)) ?? 'src/App.jsx';
      return { files, repoPath: '', activeFile: firstCode };
    }),
}));

let _id = 0;
export function genId(): string {
  return nanoid(10) + (++_id).toString(36);
}
