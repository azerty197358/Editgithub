import { useState } from 'react';
import { GitBranch, Loader2, Download, CheckCircle2, AlertCircle, FolderGit2 } from 'lucide-react';
import { useSettings } from '@/store/settings';
import { useVfs } from '@/store/vfs';
import { cloneRepo, listBranches, parseRepoUrl } from '@/lib/github';
import type { RepoInfo } from '@/types';

interface Props {
  onCloned: (repo: RepoInfo) => void;
  onNeedSettings: () => void;
}

export function CloneBar({ onCloned, onNeedSettings }: Props) {
  const { settings } = useSettings();
  const { loadFiles } = useVfs();
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  async function handleClone() {
    setErr(null);
    if (!url.trim()) { setErr('Enter a repo URL or owner/repo.'); return; }
    if (!settings.githubToken) { onNeedSettings(); return; }
    setLoading(true);
    setStatus('Fetching repository metadata...');
    try {
      const result = await cloneRepo(settings.githubToken, url.trim(), branch || undefined);
      loadFiles(result.files, result.repo.url);
      setStatus(`Loaded ${result.files.length} files from ${result.repo.owner}/${result.repo.repo}`);
      onCloned(result.repo);
      // also fetch branches for the dropdown
      listBranches(settings.githubToken, result.repo.owner, result.repo.repo).then(setBranches).catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  async function loadBranches() {
    if (!url.trim() || !settings.githubToken) return;
    const parsed = parseRepoUrl(url);
    if (!parsed) return;
    try {
      const b = await listBranches(settings.githubToken, parsed.owner, parsed.repo);
      setBranches(b);
    } catch { /* ignore */ }
  }

  return (
    <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev-2)' }}>
      <div className="flex items-center gap-2 mb-2">
        <FolderGit2 size={14} style={{ color: 'var(--primary)' }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Clone Repository</span>
      </div>
      <div className="flex gap-2">
        <input
          className="input mono text-xs"
          placeholder="owner/repo or github.com/owner/repo"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setErr(null); }}
          onBlur={loadBranches}
          spellCheck={false}
        />
        <button className="btn btn-primary text-xs" onClick={handleClone} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Clone
        </button>
      </div>
      {branches.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <GitBranch size={12} style={{ color: 'var(--text-mute)' }} />
          <select className="input !py-1 text-xs flex-1" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">default branch</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}
      {err && <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: 'var(--error)' }}><AlertCircle size={13} className="mt-0.5 shrink-0" />{err}</p>}
      {status && !err && (
        <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
          <CheckCircle2 size={13} /> {status}
        </p>
      )}
    </div>
  );
}
