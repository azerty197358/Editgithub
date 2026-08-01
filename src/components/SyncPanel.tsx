import { useMemo, useState } from 'react';
import { GitCommit, Loader2, RotateCcw, Upload, CheckCircle2, AlertCircle, FileEdit, FilePlus, Trash2, PackageCheck } from 'lucide-react';
import { useVfs } from '@/store/vfs';
import { useSettings } from '@/store/settings';
import { pushChanges, stageChanges } from '@/lib/github';
import type { RepoInfo } from '@/types';

interface Props {
  repo: RepoInfo | null;
  onPushed: () => void;
  onNeedSettings: () => void;
}

export function SyncPanel({ repo, onPushed, onNeedSettings }: Props) {
  const { files, discardFile, discardAll, markCommitted } = useVfs();
  const { settings } = useSettings();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [staged, setStaged] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [manualRepoUrl, setManualRepoUrl] = useState('');

  const changed = useMemo(
    () => Object.values(files).filter((f) => f.status !== 'unchanged'),
    [files]
  );

  const counts = useMemo(() => {
    let added = 0, modified = 0, deleted = 0;
    for (const f of changed) {
      if (f.status === 'new') added++;
      else if (f.status === 'modified') modified++;
      else if (f.status === 'deleted') deleted++;
    }
    return { added, modified, deleted };
  }, [changed]);

  function resolveRepo(): { owner: string; repo: string; branch: string } | null {
    if (repo) return { owner: repo.owner, repo: repo.repo, branch: repo.branch };
    const url = manualRepoUrl.trim();
    if (!url) return null;
    const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:$|[/?#])/i);
    if (!m) return null;
    return { owner: m[1], repo: m[2], branch: 'main' };
  }

  async function commit() {
    setErr(null); setOk(null);
    const target = resolveRepo();
    if (!target) { setErr(repo ? 'Clone a repository first.' : 'Enter a GitHub repository URL above.'); return; }
    if (!settings.githubToken) { onNeedSettings(); return; }
    if (!message.trim()) { setErr('Enter a commit message.'); return; }
    if (changed.length === 0) { setErr('No changes to commit.'); return; }
    setBusy(true);
    try {
      await stageChanges(settings.githubToken, target.owner, target.repo, target.branch, Object.values(files));
      setStaged(true);
      setOk(`Staged ${changed.length} file(s). Ready to push.`);
    } catch (e) {
      const err = e as { message?: string };
      setErr(err.message || JSON.stringify(e));
    } finally {
      setBusy(false);
    }
  }

  async function push() {
    setErr(null); setOk(null);
    const target = resolveRepo();
    if (!target) { setErr(repo ? 'Clone a repository first.' : 'Enter a GitHub repository URL above.'); return; }
    if (!settings.githubToken) { onNeedSettings(); return; }
    if (!message.trim()) { setErr('Enter a commit message.'); return; }
    if (changed.length === 0) { setErr('No changes to push.'); return; }
    setBusy(true);
    try {
      await pushChanges(settings.githubToken, target.owner, target.repo, target.branch, Object.values(files), message.trim());
      markCommitted();
      setStaged(false);
      setOk(`Pushed to ${target.owner}/${target.repo}:${target.branch}`);
      setMessage('');
      onPushed();
    } catch (e) {
      const err = e as { message?: string };
      setErr(err.message || JSON.stringify(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="flex items-center gap-2">
          <GitCommit size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Changes</span>
        </div>
        {changed.length > 0 && (
          <button className="btn btn-ghost text-xs !py-1" onClick={discardAll} disabled={busy}>
            <RotateCcw size={12} /> Discard all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {changed.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-mute)' }}>No uncommitted changes.</p>
          </div>
        ) : (
          <div className="py-1">
            {changed.map((f) => (
              <div key={f.path} className="group flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-elev-2)] transition-colors">
                {f.status === 'new' && <FilePlus size={13} style={{ color: 'var(--success)' }} />}
                {f.status === 'modified' && <FileEdit size={13} style={{ color: 'var(--warning)' }} />}
                {f.status === 'deleted' && <Trash2 size={13} style={{ color: 'var(--error)' }} />}
                <span className="flex-1 truncate mono text-xs" style={{ color: 'var(--text-dim)' }}>{f.path}</span>
                <button className="btn btn-ghost !p-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => discardFile(f.path)} title="Discard changes to this file">
                  <RotateCcw size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(counts.added > 0 || counts.modified > 0 || counts.deleted > 0) && (
        <div className="px-3 py-1.5 border-t flex items-center gap-3 text-[11px]" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev-2)', color: 'var(--text-mute)' }}>
          {counts.added > 0 && <span style={{ color: 'var(--success)' }}>+{counts.added} added</span>}
          {counts.modified > 0 && <span style={{ color: 'var(--warning)' }}>~{counts.modified} modified</span>}
          {counts.deleted > 0 && <span style={{ color: 'var(--error)' }}>-{counts.deleted} deleted</span>}
        </div>
      )}

      <div className="p-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-mute)' }}>
          <Upload size={11} /> {repo ? <>Push to <span className="mono" style={{ color: 'var(--text-dim)' }}>{repo.owner}/{repo.repo}:{repo.branch}</span></> : 'Push to GitHub'}
        </div>

        {!repo && (
          <input
            className="input text-xs mb-2"
            placeholder="https://github.com/owner/repo"
            value={manualRepoUrl}
            onChange={(e) => setManualRepoUrl(e.target.value)}
          />
        )}

        <textarea
          className="input text-xs mb-2 resize-none"
          rows={2}
          placeholder="Commit message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn btn-ghost text-xs"
            onClick={commit}
            disabled={busy || changed.length === 0 || staged}
            title="Stage changes (prepare for push)"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : staged ? <CheckCircle2 size={14} /> : <GitCommit size={14} />}
            {staged ? 'Staged' : 'Commit Changes'}
          </button>
          <button
            className="btn btn-primary text-xs"
            onClick={push}
            disabled={busy || changed.length === 0}
            title="Commit and push to GitHub"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Push to GitHub
          </button>
        </div>
        {staged && (
          <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
            <PackageCheck size={13} /> Changes staged. Click "Push to GitHub" to publish.
          </p>
        )}
        {err && <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: 'var(--error)' }}><AlertCircle size={13} className="mt-0.5 shrink-0" />{err}</p>}
        {ok && <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: 'var(--success)' }}><CheckCircle2 size={13} />{ok}</p>}
      </div>
    </div>
  );
}
