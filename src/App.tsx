import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Sparkles, Code2, GitCompare, GitBranch, Github, PanelLeftClose, PanelLeft, History, Database, Eye } from 'lucide-react';
import { SettingsModal } from '@/components/SettingsModal';
import { ChatPanel } from '@/components/ChatPanel';
import { CloneBar } from '@/components/CloneBar';
import { FileExplorer } from '@/components/FileExplorer';
import { CodeEditor } from '@/components/CodeEditor';
import { DiffView } from '@/components/DiffView';
import { SyncPanel } from '@/components/SyncPanel';
import { CommitHistory } from '@/components/CommitHistory';
import { DatabasePanel } from '@/components/DatabasePanel';
import { PreviewPanel } from '@/components/PreviewPanel';
import { useVfs } from '@/store/vfs';
import { useSettings } from '@/store/settings';
import type { RepoInfo } from '@/types';

type RightTab = 'editor' | 'preview' | 'diff' | 'sync' | 'history' | 'database';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('editor');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [, setResizing] = useState(false);

  const { files, activeFile, seedDefault } = useVfs();
  const { settings } = useSettings();
  const changedCount = Object.values(files).filter((f) => f.status !== 'unchanged').length;

  useEffect(() => { seedDefault(); }, [seedDefault]);

  // auto-switch to diff when there are changes and AI applied them, if user is on editor
  function handleCloned(r: RepoInfo) {
    setRepo(r);
    setRightTab('editor');
  }

  function startResize() {
    setResizing(true);
    const move = (e: MouseEvent) => {
      const w = Math.min(420, Math.max(180, e.clientX - 480));
      setExplorerWidth(w);
    };
    const up = () => {
      setResizing(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  const hasGithub = !!settings.githubToken;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-dim)' }}>
            <Sparkles size={16} style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tracking-tight">OpenCode</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elev-3)', color: 'var(--text-mute)' }}>BYOK</span>
          </div>
          {repo && (
            <a href={repo.url} target="_blank" rel="noreferrer" className="ml-3 flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors hover:bg-[var(--bg-elev-3)]" style={{ color: 'var(--text-dim)' }}>
              <Github size={12} />
              <span className="mono">{repo.owner}/{repo.repo}</span>
              <GitBranch size={11} style={{ color: 'var(--text-mute)' }} />
              <span style={{ color: 'var(--text-mute)' }}>{repo.branch}</span>
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!hasGithub && (
            <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}>
              Add GitHub token
            </span>
          )}
          <button className="btn btn-ghost text-xs" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon size={15} /> Settings
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat */}
        {leftPanelOpen && (
          <div className="w-[480px] shrink-0 flex flex-col border-r min-h-0" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev)' }}>
            <ChatPanel repo={repo} onNeedSettings={() => setSettingsOpen(true)} />
          </div>
        )}

        {/* Toggle left panel */}
        <button
          className="w-5 shrink-0 flex items-center justify-center border-r transition-colors hover:bg-[var(--bg-elev-2)]"
          style={{ borderColor: 'var(--border-soft)', color: 'var(--text-mute)' }}
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          title={leftPanelOpen ? 'Hide chat' : 'Show chat'}
        >
          {leftPanelOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>

        {/* Right: Explorer + Editor/Diff/Sync */}
        <div className="flex-1 flex min-h-0">
          {/* Explorer */}
          <div className="shrink-0 flex flex-col border-r min-h-0" style={{ width: explorerWidth, borderColor: 'var(--border-soft)', background: 'var(--bg-elev)' }}>
            <CloneBar onCloned={handleCloned} onNeedSettings={() => setSettingsOpen(true)} />
            <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Files</span>
              {Object.keys(files).length > 0 && <span className="text-[10px]" style={{ color: 'var(--text-mute)' }}>{Object.keys(files).length}</span>}
            </div>
            <FileExplorer />
          </div>

          {/* Resize handle */}
          <div
            className="w-1 shrink-0 cursor-col-resize transition-colors hover:bg-[var(--primary)]"
            style={{ background: 'var(--border-soft)' }}
            onMouseDown={startResize}
          />

          {/* Main right area */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tabs */}
            <div className="h-9 shrink-0 flex items-center px-2 gap-1 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev)' }}>
              <Tab active={rightTab === 'editor'} onClick={() => setRightTab('editor')} icon={<Code2 size={13} />} label={activeFile ? activeFile.split('/').pop() || 'Editor' : 'Editor'} />
              <Tab active={rightTab === 'preview'} onClick={() => setRightTab('preview')} icon={<Eye size={13} />} label="Preview" />
              <Tab active={rightTab === 'diff'} onClick={() => setRightTab('diff')} icon={<GitCompare size={13} />} label="Diff" badge={changedCount > 0 ? changedCount : undefined} />
              <Tab active={rightTab === 'sync'} onClick={() => setRightTab('sync')} icon={<GitBranch size={13} />} label="Sync" badge={changedCount > 0 ? changedCount : undefined} />
              {repo && <Tab active={rightTab === 'history'} onClick={() => setRightTab('history')} icon={<History size={13} />} label="History" />}
              <Tab active={rightTab === 'database'} onClick={() => setRightTab('database')} icon={<Database size={13} />} label="Database" />
              {activeFile && rightTab === 'editor' && (
                <span className="ml-auto text-[11px] mono truncate max-w-[300px]" style={{ color: 'var(--text-mute)' }}>{activeFile}</span>
              )}
            </div>

            <div className="flex-1 min-h-0 flex">
              {rightTab === 'editor' && <CodeEditor />}
              {rightTab === 'preview' && <PreviewPanel />}
              {rightTab === 'diff' && <DiffView />}
              {rightTab === 'sync' && (
                <div className="w-[380px] shrink-0 border-r flex flex-col min-h-0" style={{ borderColor: 'var(--border-soft)' }}>
                  <SyncPanel repo={repo} onPushed={() => setRightTab('history')} onNeedSettings={() => setSettingsOpen(true)} />
                </div>
              )}
              {rightTab === 'sync' && (
                <div className="flex-1 min-h-0">
                  <DiffView />
                </div>
              )}
              {rightTab === 'history' && (
                <div className="flex-1 min-h-0">
                  {repo ? (
                    <CommitHistory repo={repo} onNeedSettings={() => setSettingsOpen(true)} onRestored={() => setRightTab('editor')} />
                  ) : (
                    <div className="flex-1 flex items-center justify-center p-6 text-center">
                      <p className="text-xs" style={{ color: 'var(--text-mute)' }}>Clone a repository to view its commit history.</p>
                    </div>
                  )}
                </div>
              )}
              {rightTab === 'database' && (
                <div className="flex-1 min-h-0">
                  <DatabasePanel onNeedSettings={() => setSettingsOpen(true)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function Tab({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
      style={{
        background: active ? 'var(--bg-elev-3)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
      }}
    >
      {icon}
      <span className="truncate max-w-[140px]">{label}</span>
      {badge !== undefined && (
        <span className="px-1.5 py-0 rounded text-[10px] font-bold" style={{ background: active ? 'var(--primary)' : 'var(--bg-elev-3)', color: active ? '#fff' : 'var(--text-dim)' }}>{badge}</span>
      )}
    </button>
  );
}
