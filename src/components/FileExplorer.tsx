import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, File, FileCode, FilePlus, FileText, Folder, FolderOpen } from 'lucide-react';
import { useVfs } from '@/store/vfs';
import type { VFile } from '@/types';

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: VFile;
}

function buildTree(paths: VFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };
  for (const f of paths) {
    const parts = f.path.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      let next = cur.children.find((c) => c.name === part && c.isDir === !isLast);
      if (!next) {
        next = { name: part, path: parts.slice(0, i + 1).join('/'), isDir: !isLast, children: [], file: isLast ? f : undefined };
        cur.children.push(next);
      }
      cur = next;
    }
  }
  // sort: dirs first, then files, alphabetical
  function sort(n: TreeNode) {
    n.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sort);
  }
  sort(root);
  return root;
}

function iconFor(name: string) {
  if (/\.(tsx?|jsx?|mjs|cjs)$/i.test(name)) return FileCode;
  if (/\.(json|ya?ml|toml|ini|env)$/i.test(name)) return FileCode;
  if (/\.(md|mdx|txt)$/i.test(name)) return FileText;
  return File;
}

function statusColor(status: VFile['status']): string | undefined {
  if (status === 'new') return 'var(--success)';
  if (status === 'modified') return 'var(--warning)';
  if (status === 'deleted') return 'var(--error)';
  return undefined;
}

export function FileExplorer() {
  const { files, activeFile, setActive } = useVfs();
  const tree = useMemo(() => buildTree(Object.values(files)), [files]);

  if (Object.keys(files).length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-xs" style={{ color: 'var(--text-mute)' }}>
          No files loaded. Clone a repo or ask the AI to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-1.5">
      {tree.children.map((child) => (
        <TreeRow key={child.path} node={child} depth={0} activeFile={activeFile} onPick={setActive} />
      ))}
    </div>
  );
}

function TreeRow({ node, depth, activeFile, onPick }: { node: TreeNode; depth: number; activeFile: string | null; onPick: (p: string) => void }) {
  const [open, setOpen] = useState(depth < 1);

  if (node.isDir) {
    return (
      <div>
        <button
          className="w-full flex items-center gap-1 px-2 py-1 text-xs hover:bg-[var(--bg-elev-2)] transition-colors"
          style={{ paddingLeft: depth * 12 + 8 }}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={13} style={{ color: 'var(--text-mute)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-mute)' }} />}
          {open ? <FolderOpen size={13} style={{ color: 'var(--primary)' }} /> : <Folder size={13} style={{ color: 'var(--primary)' }} />}
          <span className="truncate" style={{ color: 'var(--text)' }}>{node.name}</span>
        </button>
        {open && node.children.map((c) => (
          <TreeRow key={c.path} node={c} depth={depth + 1} activeFile={activeFile} onPick={onPick} />
        ))}
      </div>
    );
  }

  const Icon = iconFor(node.name);
  const isActive = activeFile === node.path;
  const color = statusColor(node.file?.status ?? 'unchanged');
  const isNew = node.file?.status === 'new';

  return (
    <button
      className="w-full flex items-center gap-1.5 px-2 py-1 text-xs transition-colors"
      style={{
        paddingLeft: depth * 12 + 22,
        background: isActive ? 'var(--primary-dim)' : 'transparent',
        color: isActive ? 'var(--text)' : 'var(--text-dim)',
      }}
      onClick={() => onPick(node.path)}
    >
      {isNew ? <FilePlus size={13} style={{ color: 'var(--success)' }} /> : <Icon size={13} style={{ color: color ?? 'var(--text-mute)' }} />}
      <span className="truncate" style={{ color: color ?? (isActive ? 'var(--text)' : 'var(--text-dim)') }}>{node.name}</span>
      {color && <span className="ml-auto text-[9px] font-bold uppercase" style={{ color }}>{node.file?.status === 'new' ? '+' : node.file?.status === 'modified' ? 'M' : 'D'}</span>}
    </button>
  );
}
