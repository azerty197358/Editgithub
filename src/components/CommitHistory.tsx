import { useCallback, useEffect, useState } from 'react';
import { History, Loader2, RotateCcw, ChevronDown, ChevronRight, ExternalLink, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { useSettings } from '@/store/settings';
import { useVfs } from '@/store/vfs';
import { listCommits, restoreAtCommit } from '@/lib/github';
import type { CommitInfo, RepoInfo } from '@/types';

interface Props {
  repo: RepoInfo;
  onNeedSettings: () => void;
  onRestored: (sha: string) => void;
}

export function CommitHistory({ repo, onNeedSettings, onRestored }: Props) {
  const { settings } = useSettings();
  const { loadFiles } = useVfs();
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async (p: number, append: boolean) => {
    if (!settings.githubToken) { onNeedSettings(); return; }
    if (append) setLoadingMore(true); else setLoading(true);
    setErr(null);
    try {
      const batch = await listCommits(settings.githubToken, repo.owner, repo.repo, repo.branch, p, 30);
      if (batch.length < 30) setHasMore(false);
      setCommits((prev) => (append ? [...prev, ...batch] : batch));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [settings.githubToken, repo, onNeedSettings]);

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.owner, repo.repo, repo.branch]);

  async function restore(c: CommitInfo) {
    setErr(null); setOk(null);
    if (!settings.githubToken) { onNeedSettings(); return; }
    setRestoring(c.sha);
    try {
      const result = await restoreAtCommit(settings.githubToken, repo.owner, repo.repo, c);
      loadFiles(result.files, repo.url);
      setOk(`Restored ${result.files.length} files from ${c.shortSha}`);
      onRestored(c.sha);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoring(null);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-mute)' }} />
      </div>
    );
  }

  if (err && commits.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle size={20} style={{ color: 'var(--error)' }} className="mb-2" />
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{err}</p>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-xs" style={{ color: 'var(--text-mute)' }}>No commits found on this branch.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-soft)' }}>
        <History size={14} style={{ color: 'var(--primary)' }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Commit History</span>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--text-mute)' }}>{commits.length} loaded</span>
      </div>

      {ok && (
        <div className="px-3 py-2 flex items-center gap-1.5 text-xs fade-in" style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--success)' }}>
          <CheckCircle2 size={13} /> {ok}
        </div>
      )}
      {err && commits.length > 0 && (
        <div className="px-3 py-2 flex items-start gap-1.5 text-xs" style={{ color: 'var(--error)' }}>
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {err}
        </div>
      )}

      {/* Commit list */}
      <div className="flex-1 overflow-y-auto">
        {commits.map((c, idx) => {
          const isOpen = expanded === c.sha;
          const isHead = idx === 0;
          return (
            <div key={c.sha} className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="group flex items-start gap-2 px-3 py-2 hover:bg-[var(--bg-elev-2)] transition-colors">
                <button
                  className="mt-0.5 shrink-0 btn-ghost btn !p-0.5"
                  onClick={() => setExpanded(isOpen ? null : c.sha)}
                >
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isHead && <span className="chip shrink-0" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>HEAD</span>}
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{c.subject}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: 'var(--text-mute)' }}>
                    <span className="flex items-center gap-0.5"><User size={10} /> {c.author}</span>
                    <span className="mono">{c.shortSha}</span>
                    <span>{formatDate(c.date)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="btn btn-soft text-xs !py-1 !px-2"
                    onClick={() => restore(c)}
                    disabled={restoring === c.sha}
                    title={`Restore files to ${c.shortSha}`}
                  >
                    {restoring === c.sha ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    <span className="hidden sm:inline">Restore</span>
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-2.5 pl-9 fade-in">
                  {c.message.split('\n').length > 1 && (
                    <pre className="text-[11px] whitespace-pre-wrap mb-2 mono" style={{ color: 'var(--text-dim)' }}>{c.message.split('\n').slice(1).join('\n').trim()}</pre>
                  )}
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-mute)' }}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors">
                      <ExternalLink size={10} /> View on GitHub
                    </a>
                    <span className="mono">{c.sha}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loadingMore && (
          <div className="flex items-center justify-center py-3">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-mute)' }} />
          </div>
        )}

        {hasMore && !loadingMore && commits.length > 0 && (
          <button
            className="w-full py-2.5 text-xs transition-colors hover:bg-[var(--bg-elev-2)]"
            style={{ color: 'var(--text-dim)' }}
            onClick={() => { const next = page + 1; setPage(next); load(next, true); }}
          >
            Load more commits
          </button>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
