import { useMemo } from 'react';
import { createPatch } from 'diff';
import { useVfs } from '@/store/vfs';
import type { VFile } from '@/types';

export function DiffView({ file: override }: { file?: VFile }) {
  const { files, activeFile } = useVfs();

  const changed = useMemo(
    () => Object.values(files).filter((f) => f.status !== 'unchanged'),
    [files]
  );

  if (changed.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: '#0b0e14' }}>
        <p className="text-sm" style={{ color: 'var(--text-mute)' }}>No changes yet. Edit files or ask the AI to modify code.</p>
      </div>
    );
  }

  const file = override ?? (activeFile && files[activeFile]?.status !== 'unchanged' ? files[activeFile] : null) ?? changed[0];

  return (
    <div className="flex-1 overflow-auto" style={{ background: '#0b0e14' }}>
      <DiffContent file={file} />
    </div>
  );
}

function DiffContent({ file }: { file: VFile }) {
  const patch = useMemo(
    () => createPatch(file.path, file.originalContent, file.content, '', ''),
    [file.path, file.originalContent, file.content]
  );
  const lines = patch.split('\n');

  if (file.status === 'deleted') {
    return (
      <div className="py-2">
        <Header file={file} />
        <div className="px-3 py-4 text-sm" style={{ color: 'var(--error)' }}>File will be deleted on commit.</div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <Header file={file} />
      {lines.map((line, i) => {
        if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('Index') || line.startsWith('===')) return null;
        if (line.startsWith('@@')) {
          return <div key={i} className="px-3 py-0.5 mono text-xs" style={{ color: 'var(--primary)', background: 'var(--primary-dim)' }}>{line}</div>;
        }
        const added = line.startsWith('+');
        const removed = line.startsWith('-');
        const cls = added ? 'diff-added' : removed ? 'diff-removed' : '';
        return (
          <div key={i} className={`px-3 py-0 mono text-xs flex ${cls}`} style={{ minHeight: '19px' }}>
            <span style={{ color: 'var(--text-mute)', marginRight: 8, userSelect: 'none', width: '1ch' }}>{added ? '+' : removed ? '-' : ' '}</span>
            <span className="whitespace-pre">{line.slice(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Header({ file }: { file: VFile }) {
  return (
    <div className="px-3 py-2 mb-1 text-xs font-semibold sticky top-0" style={{ background: 'var(--bg-elev)', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)' }}>
      {file.status === 'new' ? 'New file' : file.status === 'deleted' ? 'Deleted' : 'Modified'}: <span className="mono" style={{ color: 'var(--text)' }}>{file.path}</span>
    </div>
  );
}
